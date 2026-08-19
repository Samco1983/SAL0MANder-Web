# Prompts that force an agent to show its data

Written after a session in which Claude asserted `codex` was not installed
(false — it was unreachable from one shell) and asserted `npm run verify`
passed (false — a grep hid the error). Both claims read as verified fact. Both
would have been caught by demanding raw output instead of a summary.

Paste the **evidence rules** at the top of any prompt below.

---

## The evidence rules — paste this block first

```
EVIDENCE RULES. Follow these or your answer is worse than nothing.

1. For every factual claim, paste the exact command you ran AND its raw
   output. Not your summary of the output. The output.
2. Label every claim VERIFIED, INFERRED, or UNVERIFIED.
   VERIFIED = I ran it just now and pasted the result.
   INFERRED = reasoning from something else.
   UNVERIFIED = I could not check it.
3. Report the environment you ran in: `whoami`, `pwd`, `echo $PATH`, and how
   you were invoked. Agents on this Mac do NOT see the same tools, so "it is
   installed" is only true for the shell that checked.
4. When you cannot check something, write UNVERIFIED and why. Do not fill the
   gap with a plausible answer.
5. Name one thing that would prove you wrong. If nothing could, say so plainly.
6. If you are repeating something from an earlier session, a memory, or a doc,
   say so and cite the file. Do not present remembered context as a fresh check.
7. Check the exit code, not the text. A command whose output contains the word
   "warning" may still have failed.
```

---

## For Codex — the automations and the money

```
Answer under the EVIDENCE RULES above.

1. List every automation you have for SAL0MANder. For each: its id, its
   schedule, whether it is ACTIVE or PAUSED, and paste the config you read it
   from.
2. For the nudge monitor: show me its output from the last 24 hours. Not a
   summary — what did it actually say, run by run? Then answer: name one
   concrete thing that changed in the repo or in a decision BECAUSE it ran.
   If nothing did, say that.
3. What has that automation cost in the last 7 days? If you cannot see spend,
   say UNVERIFIED and tell me exactly where I would look.
4. Its thread file is ~80MB and grows every run. What is the cost trend per
   run over the last 30 days — flat, rising, how fast? Show your numbers.
5. There are now two pause switches: ~/.sal0mander/PAUSE (Claude's supervisor)
   and docs/coordination/MISSION_CONTROL_PAUSE (yours). Which one actually
   stops everything? Prove it. Then pick ONE and say which.
6. Your preflight says `codex` is OK. Claude's shell cannot find it at all.
   Show `command -v codex` and `echo $PATH` from your environment. Then answer:
   would a launchd job at 03:00 find it? launchd uses a minimal PATH.
7. What are you unable to see from where you run? List it.
```

---

## For Claude — the claims from this session

```
Answer under the EVIDENCE RULES above.

1. List every factual claim you made this session about what is installed,
   running, or scheduled on this Mac. For each, re-check it NOW and mark it
   CONFIRMED, WRONG, or STILL UNVERIFIED. Paste the commands.
2. You said both work-producing automations are switched off and only the
   attendance one runs. Re-verify. Paste the evidence.
3. You built a lock, preflight, failure attribution and cost logging. For each:
   has it ever run in a real scheduled context, or only when you invoked it by
   hand? Say which. Do not call hand-run code proven.
4. `npm run council:costs` reports $0.00. Is that because nothing has cost
   anything, or because nothing has been recorded? Answer precisely.
5. What in your own work would you bet against? Name the weakest piece.
```

---

## The five questions that pay for themselves

Ask these of any agent, any week:

1. **Show me the last 24 hours of what you produced.** Not status — output.
2. **Name one thing that changed because you ran.** If nothing, the schedule is
   burning money.
3. **What did it cost?** If you cannot see it, where do I look?
4. **What can you NOT see from where you run?**
5. **What would prove you wrong?**

Question 2 is the one that catches a healthy-looking loop that does nothing. It
is the question neither agent volunteered for a week.
