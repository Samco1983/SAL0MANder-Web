# Morning report — 2026-08-19

Read this first. One command tells you the rest:

```bash
bash scripts/sal0-control-room.sh
```

---

## The score moved

**12 open, 3 closed.** It was 15 open, 0 closed when you went to sleep.

Every close was checked against the branch before the issue was closed, not
after — the file each one added is present on `council/2026-08-18`:

| Issue | What landed | Proof |
| --- | --- | --- |
| **#9** route errors and not-found | 13 tests where there were none; Guest Play recovery link on the 404 page | `src/app/RouteError.test.tsx` |
| **#11** accessibility foundation | 10 tests locking in landmarks, skip link, reduced motion, focus, touch targets | `src/components/layout/accessibilityFoundation.test.tsx` |
| **#8** Unity host recovery | a failed WebGL load is no longer terminal — retry that cannot duplicate an instance | `src/unity/hostRecovery.test.tsx` |

`npm run verify` exit 0 at each merge. **441 tests**, up from 422.

## The one that nearly went wrong

On #8 a mutation survived: removing `retryToken` from the effect deps makes the
retry button a **complete no-op**, and all nine tests still passed — firing
`onload` by hand re-invokes the factory whether or not the effect ever re-ran.
A dead button with a green test was about thirty seconds from shipping.

The test now asserts a **fresh script element** rather than a second factory
call, and the mutation fails it.

This is the argument for mutation testing in one example. The tests were not
lying on purpose; they were passing for a reason that had nothing to do with
the feature.

## Mistakes, since they are the data

Four of mine, all the same shape — reporting success without checking evidence:

1. Ran `npm run verify` with `;` instead of `&&`, so a commit landed on a
   failing typecheck. Caught in thirty seconds by the exit code.
2. Closed **#11** while its merge had failed. `Merge with strategy ort failed`
   printed to stdout; verify then passed with the *pre-merge* test count and I
   read that as success. Corrected on the issue, then merged properly.
3. Replaced the Unity loader's raw error text with friendly copy, breaking
   three existing tests. **Those tests were right** — a teacher filing a bug
   needs the real reason, and the loader URL carries no share code. Guidance is
   now added beside the detail, not instead of it.
4. Claimed three stylesheets lacked a reduced-motion guard. `base.css` carries
   a global rule over `*`, `::before` and `::after`. They were covered.

Numbers 3 and 4 are the useful ones: both were me about to "fix" something that
was already correct. Reading first would have caught both.

## What is running

- **launchd** `com.sal0mander.work-loop` is installed and loaded, fires at **:17**
- **Not paused** — the brake is `echo stop > ~/.sal0mander/PAUSE`
- The loop skips issues labelled `in-progress`, so it will not collide with
  whatever Codex claims
- **Gemini is installed and authenticated**, and its free tier is **20 requests
  a day** — it burned through them on one rebound. That is the real constraint
  on the rebounder seat, not speed
- **The coach seat is built and inert.** It needs an OpenAI API key, billed
  separately from the ChatGPT subscription:
  ```
  security add-generic-password -U -a "$USER" -s "SAL0MANder OpenAI API" -w "$(pbpaste)" && pbcopy < /dev/null
  ```

## The number that still is not good

**Possession efficiency: 5%.** 17 product changes out of 325. 128 commits in
23 hours produced 3 points.

Better than the 0 it was, and still the thing to fix. The playbook's own rule
applies to the playbook: *if the score has not moved, stop revising it and
shoot.*

## Where to pick it up

12 issues open. The loop will take the oldest unclaimed one on its own at :17.
If you want to aim it, label the ones you want left alone:

```bash
gh issue edit <n> --repo Samco1983/SAL0MANder-Web --add-label in-progress
```
