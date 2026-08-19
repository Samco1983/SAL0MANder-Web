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

## Live claims

Format — one line, newest at the top:

```
<UTC opened> · <AGENT> · <CALL> · <path or area> · UNTIL <UTC> · <why>
```

<!-- claims below -->

2026-08-19T04:20:00Z · SAL0-04 Claude · YOURS · scripts/sal0-next-task.sh · UNTIL 2026-08-19T04:20:00Z · done editing, picker moved to scripts/lib/sal0_pick_blocker.py — it is free
2026-08-19T04:20:00Z · SAL0-04 Claude · TRAIL ME · docs/coordination/ · UNTIL 2026-08-19T08:00:00Z · moving fast on coordination docs tonight; verify behind me, I will be sloppy
