#!/usr/bin/env python3
"""
SAL0MANder desk buttons — the terminal path, with a lid on it.

One window, four buttons, no browser. This exists because the web console spent
an evening unreachable while the exact same commands ran fine locally, and the
difference between those two states was a Cloudflare tunnel, a Make webhook, and
a school Wi-Fi filter — none of which have anything to do with the work.

Every button here shells out to an `npm run mission:*` script in this repo. That
is deliberate: this file adds no logic of its own, so it cannot drift from what
the terminal does. If a button disagrees with the terminal, the button is wrong.

Nothing here launches a mission, clears the brake, or touches a credential.
Those are owner actions and they stay in a terminal where the output is fully
visible.

Run:
    npm run mission:buttons
    python3 scripts/sal0-desk-buttons.py
"""

from __future__ import annotations

import queue
import subprocess
import threading
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont
from tkinter.scrolledtext import ScrolledText

REPO = Path(__file__).resolve().parent.parent

# (label, npm script, one-line description shown under the title bar)
BUTTONS = [
    ("FAST BREAK", "mission:next",
     "The next thing to work on. Local git only - no network, nothing to be locked out of."),
    ("CHAMPIONSHIP", "mission:championship",
     "The scoreboard: 12 conditions, what is won and what is blocking. Reads the GitHub API."),
    ("CONTROL ROOM", "mission:control-room",
     "One-screen status of everything."),
    ("WORKER STATUS", "mission:desktop:status",
     "Is the unattended loop running, and is the brake on?"),
]

BG = "#12141a"
PANEL = "#1b1f28"
INK = "#e8eaf0"
MUTED = "#8b93a7"
ACCENT = "#7c9c6a"
GOOD = "#7bc47f"
BAD = "#e06a5a"
BUSY = "#d9a441"


class PillButton:
    """
    A button built from a Frame and a Label instead of tk.Button.

    On macOS, Tk renders tk.Button with the native Aqua style, which IGNORES
    `bg` but still APPLIES `fg`. On a dark theme that produces pale text on the
    pale native button — a control that is present, clickable, and completely
    invisible. Frame and Label honour both colours on every platform, so the
    button is drawn rather than negotiated with the OS.
    """

    def __init__(self, parent: tk.Widget, text: str, command) -> None:
        self.command = command
        self.enabled = True

        self.frame = tk.Frame(parent, bg=PANEL, highlightthickness=1,
                              highlightbackground="#2f3646", highlightcolor="#2f3646")
        self.label = tk.Label(self.frame, text=text, bg=PANEL, fg=INK,
                              font=("Helvetica Neue", 13, "bold"), pady=15,
                              cursor="pointinghand")
        self.label.pack(fill="both", expand=True)

        for widget in (self.frame, self.label):
            widget.bind("<Button-1>", self._click)
            widget.bind("<Enter>", self._enter)
            widget.bind("<Leave>", self._leave)

    def pack(self, **kwargs) -> None:
        self.frame.pack(**kwargs)

    def _click(self, _event) -> None:
        if self.enabled:
            self.command()

    def _enter(self, _event) -> None:
        if self.enabled:
            self._paint(ACCENT, BG)

    def _leave(self, _event) -> None:
        if self.enabled:
            self._paint(PANEL, INK)

    def _paint(self, bg: str, fg: str) -> None:
        self.frame.configure(bg=bg)
        self.label.configure(bg=bg, fg=fg)

    def set_enabled(self, enabled: bool) -> None:
        self.enabled = enabled
        self._paint(PANEL, INK if enabled else "#4a5165")
        self.label.configure(cursor="pointinghand" if enabled else "arrow")


class DeskButtons:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.lines: queue.Queue[str | None] = queue.Queue()
        self.running = False
        self.buttons: list[PillButton] = []

        root.title("SAL0MANder Mission Control")
        root.configure(bg=BG)
        root.geometry("880x660")
        root.minsize(680, 480)

        mono = tkfont.nametofont("TkFixedFont").copy()
        mono.configure(size=12)

        header = tk.Frame(root, bg=BG)
        header.pack(fill="x", padx=18, pady=(16, 8))
        tk.Label(header, text="MISSION CONTROL", bg=BG, fg=INK,
                 font=("Helvetica Neue", 20, "bold")).pack(anchor="w")
        tk.Label(header, text="The terminal path. No browser, no Cloudflare, no Make.",
                 bg=BG, fg=MUTED, font=("Helvetica Neue", 12)).pack(anchor="w")

        pad = tk.Frame(root, bg=BG)
        pad.pack(fill="x", padx=18, pady=(4, 10))
        for index, (label, script, blurb) in enumerate(BUTTONS):
            pad.columnconfigure(index, weight=1)
            cell = tk.Frame(pad, bg=BG)
            cell.grid(row=0, column=index, sticky="nsew", padx=(0 if index == 0 else 8, 0))
            button = PillButton(cell, label, lambda s=script, l=label: self.run(s, l))
            button.pack(fill="x")
            self.buttons.append(button)
            tk.Label(cell, text=blurb, bg=BG, fg=MUTED, wraplength=190, justify="left",
                     font=("Helvetica Neue", 10)).pack(anchor="w", pady=(6, 0))

        self.status = tk.Label(root, text="Ready.", bg=BG, fg=MUTED, anchor="w",
                               font=("Helvetica Neue", 12))
        self.status.pack(fill="x", padx=18, pady=(6, 4))

        self.out = ScrolledText(root, bg=PANEL, fg=INK, insertbackground=INK,
                                relief="flat", bd=0, font=mono, wrap="word",
                                padx=14, pady=12)
        self.out.pack(fill="both", expand=True, padx=18, pady=(0, 14))
        self.out.configure(state="disabled")
        self.out.tag_configure("good", foreground=GOOD)
        self.out.tag_configure("bad", foreground=BAD)
        self.out.tag_configure("muted", foreground=MUTED)

        self.write(f"Repo: {REPO}\n", "muted")
        self.write("Pick a button. Output is the command's real output, "
                   "including its exit code.\n", "muted")

        self.root.after(80, self.drain)

    # -- output ------------------------------------------------------------

    def write(self, text: str, tag: str | None = None) -> None:
        self.out.configure(state="normal")
        self.out.insert("end", text, tag or "")
        self.out.see("end")
        self.out.configure(state="disabled")

    def drain(self) -> None:
        """Pull worker output on the UI thread. Tk is not thread-safe."""
        try:
            while True:
                item = self.lines.get_nowait()
                if item is None:
                    self.finish()
                else:
                    text, tag = item if isinstance(item, tuple) else (item, None)
                    self.write(text, tag)
        except queue.Empty:
            pass
        self.root.after(80, self.drain)

    # -- running -----------------------------------------------------------

    def run(self, script: str, label: str) -> None:
        if self.running:
            return
        self.running = True
        for button in self.buttons:
            button.set_enabled(False)
        self.status.configure(text=f"Running {script} ...", fg=BUSY)
        self.out.configure(state="normal")
        self.out.delete("1.0", "end")
        self.out.configure(state="disabled")
        self.write(f"$ npm run {script}\n\n", "muted")
        threading.Thread(target=self.worker, args=(script, label), daemon=True).start()

    def worker(self, script: str, label: str) -> None:
        """Runs off the UI thread. Talks back only through the queue."""
        try:
            process = subprocess.Popen(
                ["npm", "run", "--silent", script],
                cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1,
            )
        except FileNotFoundError:
            self.lines.put(("npm not found on PATH. Open this from a shell that has node.\n", "bad"))
            self.lines.put(None)
            return

        assert process.stdout is not None
        for line in process.stdout:
            self.lines.put(line)
        code = process.wait()

        # The exit code is reported, always, and never inferred from whether the
        # output looked encouraging. A command that printed a cheerful summary
        # and exited non-zero has failed, and this window says so.
        if code == 0:
            self.lines.put((f"\n{label} finished. exit 0\n", "good"))
        else:
            self.lines.put((f"\n{label} FAILED. exit {code}\n", "bad"))
        self.lines.put(None)

    def finish(self) -> None:
        self.running = False
        for button in self.buttons:
            button.set_enabled(True)
        self.status.configure(text="Ready.", fg=MUTED)


def main() -> None:
    root = tk.Tk()
    DeskButtons(root)
    try:
        root.createcommand("tk::mac::ReopenApplication", root.deiconify)
    except tk.TclError:
        pass  # Not on macOS, or no Aqua. Harmless.
    root.mainloop()


if __name__ == "__main__":
    main()
