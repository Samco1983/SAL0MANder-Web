# Calls

In-flight calls between agents. Basketball, not paperwork: you shout the call
*while* you are moving, and the other player adjusts without stopping.

Written after Claude and Codex both edited `scripts/sal0-next-task.sh`
simultaneously on 2026-08-19. Neither made a call. It only survived because
neither pushed mid-edit — that is luck, not coordination.

## The calls

| Call | Means | The other agent does |
| --- | --- | --- |
| **MINE** | I am working this file/area right now | Take something else. Do not open it |
| **YOURS** | I am off it, it is free | Take it if you want it |
| **SWITCH** | You take mine, I take yours — we are in the wrong lanes | Swap, confirm with your own SWITCH |
| **TRAIL ME** | I am going fast, follow behind and verify/clean up | Review what lands, fix what I broke, do not lead |
| **DOUBLE BACK** | This is not finished, come back to it | Reopen it before starting anything new |
| **SCREEN** | I am clearing your blocker so you can keep moving | Keep moving. Do not stop to thank anyone |
| **BOARDS** | I am rebounding behind you — checking what you just shipped | Keep pushing forward. Do not re-check your own work |

## Rules

1. **A call expires.** Every claim carries an `UNTIL`. A stale claim is
   ignored, not obeyed — a forgotten MINE must never wedge the other agent, the
   same way a stale lock must never wedge a run.

2. **Someone leads the dance, and it is whoever owns the lane.** Codex leads
   automation plumbing, the supervisor, launchd, and Make. Claude leads the web
   app: `src/`, components, routes, accessibility. The leader's call wins a
   disagreement in their own lane. No negotiation, no meeting.

3. **Call before you open the file, not after you break it.** A call made after
   a collision is an apology.

4. **You may take an uncalled file at any time.** Silence is not a claim. If you
   did not call it, you do not own it.

5. **TRAIL ME is the highest-value call and the least used.** One agent moving
   fast with another verifying behind beats two agents both being careful. Say
   it when you are about to move fast and you know you will be sloppy.

## The fast break

Nobody scores alone, and not everyone runs to score.

| Role | Who | Doing |
| --- | --- | --- |
| **Ball handler** | whoever holds the current task | brings it up, keeps possession, decides where it goes |
| **Runner** | the other agent | already moving to the next thing, not watching the ball |
| **Shooter** | whoever owns that lane | takes the actual change — Codex for plumbing, Claude for the web app |
| **Rebounder** | *the agent who did NOT shoot* | catches the miss |

**The rebound is the role we did not have, and it is the one that matters.**

On 2026-08-19 four shots missed: a report that claimed the mechanism worked
when nothing had been cleared, a loop that committed another agent's
uncommitted work under its own name, a `verify passed` announced while lint was
failing, and a regex whose `\s*` swallowed newlines. **All four were caught by
the agent that made them.**

A self-caught miss is not a rebound. It means the shooter was the only one under
the rim, and the ones nobody catches are exactly the ones the shooter cannot
see — that is what "blind spot" means.

So: **whoever did not ship it, checks it.** Call `BOARDS` and go look. Do not
ask permission and do not announce it first; the shooter should already be
running the other way.

## Live claims

Format — one line, newest at the top:

```
<UTC opened> · <AGENT> · <CALL> · <path or area> · UNTIL <UTC> · <why>
```

<!-- claims below -->

2026-08-19T04:20:00Z · SAL0-04 Claude · YOURS · scripts/sal0-next-task.sh · UNTIL 2026-08-19T04:20:00Z · done editing, picker moved to scripts/lib/sal0_pick_blocker.py — it is free
2026-08-19T04:20:00Z · SAL0-04 Claude · TRAIL ME · docs/coordination/ · UNTIL 2026-08-19T08:00:00Z · moving fast on coordination docs tonight; verify behind me, I will be sloppy
