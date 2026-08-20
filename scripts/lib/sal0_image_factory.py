#!/usr/bin/env python3
"""Generate puzzle art from the asset manifests, one prompt at a time.

WHY THIS IS NOT THE GEMINI CLI. The CLI is a text agent — it cannot produce an
image file at all, and no amount of prompting changes that. Images come from a
different endpoint on the Generative Language API, so this calls that directly.
The CLI and this script share only the API key.

WHAT IT WILL NOT DO:

  * It never prints, logs, or copies the API key. It reads it from
    ~/.gemini/.env, outside this repository, and holds it only in memory.
  * It never writes an image into the repository. The manifests say "prompts
    only, no generated files committed here" and that rule is load-bearing —
    binary art in git history is unremovable and the rights question is not
    settled. Output goes to a gitignored directory.
  * It never overwrites an image that already exists, so an interrupted run
    resumes instead of re-billing every prompt.

Every image is written with a sidecar .json recording the prompt, model, and
timestamp. That is not bookkeeping — an image shipped to a classroom needs to
be traceable to what produced it, and "which model made this" becomes
unanswerable within a week if nobody writes it down.

    python3 scripts/lib/sal0_image_factory.py --list
    python3 scripts/lib/sal0_image_factory.py --pack cosmic-critters --dry-run
    python3 scripts/lib/sal0_image_factory.py --pack cosmic-critters
    python3 scripts/lib/sal0_image_factory.py --all --limit 10
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ASSET_DIR = REPO / "docs" / "coordination" / "assets"
OUT_DIR = REPO / "generated-art"          # gitignored; see module docstring
KEY_FILE = Path.home() / ".gemini" / ".env"

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash-image"

# Free tier is rate-limited. Pausing between calls is cheaper than being
# throttled and retrying, and far cheaper than a partial run nobody notices.
PAUSE_SECONDS = 6.0


def read_key() -> str | None:
    """Read the key without ever surfacing it."""
    env = os.environ.get("GEMINI_API_KEY")
    if env:
        return env.strip()
    if not KEY_FILE.exists():
        return None
    for line in KEY_FILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*(?:export\s+)?GEMINI_API_KEY\s*=\s*(.+)\s*$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    return None


def load_prompts(pack: str | None) -> list[dict]:
    out = []
    for path in sorted(ASSET_DIR.glob("*.manifest.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if pack and data.get("pack") != pack:
            continue
        for asset in data.get("assets", []):
            out.append({
                "pack": data.get("pack", path.stem),
                "id": asset["id"],
                "type": asset.get("type", "unknown"),
                "prompt": asset["prompt"],
            })
    return out


def call_api(key: str, model: str, prompt: str, timeout: int = 120) -> tuple[bytes | None, str]:
    """Return (image_bytes, error). Never raises for an API-level failure."""
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_ROOT}/models/{model}:generateContent",
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        # Redact defensively: an error body should never carry the key onward.
        return None, f"HTTP {e.code}: {detail.replace(key, '<key>')}"
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"

    for cand in payload.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"]), ""
    return None, "the response contained no image data"


def available_models(key: str) -> list[str]:
    """What this key can actually reach. Guessing a model name wastes a run."""
    req = urllib.request.Request(f"{API_ROOT}/models", headers={"x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []
    return [m["name"].split("/")[-1] for m in data.get("models", [])
            if "image" in m["name"].lower()]


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate puzzle art from the asset manifests.")
    ap.add_argument("--pack", help="one pack (default: every pack)")
    ap.add_argument("--all", action="store_true", help="every pack")
    ap.add_argument("--limit", type=int, default=0, help="stop after N images")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="show what would be generated")
    ap.add_argument("--list", action="store_true", help="list packs and prompt counts")
    args = ap.parse_args()

    if args.list:
        packs: dict[str, int] = {}
        for p in load_prompts(None):
            packs[p["pack"]] = packs.get(p["pack"], 0) + 1
        print()
        for name, n in sorted(packs.items()):
            done = len(list((OUT_DIR / name).glob("*.png"))) if (OUT_DIR / name).exists() else 0
            print(f"  {name:<18}{n:>3} prompts{done:>5} generated")
        print()
        return 0

    if not args.pack and not args.all:
        print("  choose --pack <name> or --all (see --list)", file=sys.stderr)
        return 2

    prompts = load_prompts(args.pack)
    if not prompts:
        print(f"  no prompts found for pack {args.pack!r}", file=sys.stderr)
        return 2

    todo = []
    for p in prompts:
        dest = OUT_DIR / p["pack"] / f"{p['id']}.png"
        if dest.exists():
            continue          # resumable: never re-bill a prompt already done
        todo.append((p, dest))
    if args.limit:
        todo = todo[: args.limit]

    print()
    print(f"  {len(prompts)} prompts, {len(prompts) - len(todo)} already generated, {len(todo)} to do")

    if args.dry_run:
        for p, dest in todo[:12]:
            print(f"    would write {dest.relative_to(REPO)}")
        if len(todo) > 12:
            print(f"    ... and {len(todo) - 12} more")
        print()
        return 0

    key = read_key()
    if not key:
        print()
        print("  NO API KEY. Nothing was generated and nothing was billed.")
        print(f"  Expected GEMINI_API_KEY in the environment or {KEY_FILE}")
        print("  Save one with:  bash ~/.sal0mander/gemini-key.sh")
        print()
        return 1

    made, failed = 0, 0
    for i, (p, dest) in enumerate(todo, 1):
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"  [{i}/{len(todo)}] {p['id']}", flush=True)

        image, err = call_api(key, args.model, p["prompt"])
        if image is None:
            failed += 1
            print(f"      failed — {err}")
            if "not found" in err.lower() or "404" in err:
                models = available_models(key)
                print(f"      image models this key can reach: {', '.join(models) or 'none found'}")
                print("      re-run with --model <one of those>")
                break
            if failed >= 3:
                # Three consecutive-ish failures is a broken configuration, not
                # bad luck. Continuing would burn quota producing nothing.
                print("      stopping after 3 failures — this is configuration, not chance")
                break
            continue

        dest.write_bytes(image)
        # Provenance beside the file, because "which model made this" becomes
        # unanswerable within a week and the rights question needs an answer.
        dest.with_suffix(".json").write_text(json.dumps({
            "id": p["id"], "pack": p["pack"], "type": p["type"],
            "model": args.model, "prompt": p["prompt"],
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "rights_note": "Generated output. Verify the provider's commercial-use terms "
                           "before shipping to a classroom.",
        }, indent=2) + "\n", encoding="utf-8")
        made += 1
        print(f"      wrote {dest.relative_to(REPO)} ({len(image) // 1024} KB)")
        if i < len(todo):
            time.sleep(PAUSE_SECONDS)

    print()
    print(f"  generated {made}, failed {failed}")
    print(f"  output: {OUT_DIR}  (gitignored — images are never committed)")
    print()
    return 0 if made and not failed else (1 if failed else 0)


if __name__ == "__main__":
    sys.exit(main())
