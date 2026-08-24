# Review — ChatGPT's five-agent proposal

Reviewed by Claude (SAL0-04), 2026-08-23, against the counted record in
`WHAT-THE-RECORD-SHOWS.md`. Reviewer is not the author, per R1.

**Verdict: REBOUND. Take two pieces, reject the structure.**

---

## The structural error

**It adds five producers to a system whose bottleneck is delivery.**

```
commits today          44
reaching users          0
open PRs blocking       1
```

Nothing in this project is starved for people who can produce work. We produced
44 commits today and shipped none of them. The constraint is a single merge, and
adding five agents upstream of a blocked merge does not increase output — it
increases work-in-progress, which is the thing that is already hurting us.

This is not a criticism of the roles. Each is sensibly drawn. It is a criticism
of the arithmetic: capacity added upstream of a bottleneck converts into queue,
never into throughput. PR #50 at 36 commits is what that queue looks like now,
and five more producers make it worse, not better.

**The proposal never measures delivery.** "Expected Benefits" lists eight
outcomes and every one is about coordination quality — clear ownership, less
duplication, fewer conflicts. Not one is "a fix reaches a student faster."

---

## The systemic error: not one check is a command

Every mechanism in the proposal is a promise an agent makes:

- "Test changes before reporting success"
- "QA approval requires evidence such as test results, screenshots, logs"
- "Agents must report blockers honestly"
- "Done means tested and verified"

We have counted proof that promises of exactly this shape fail. The agent that
wrote "the owner is not the relay" broke it three times in the session where it
wrote it. `deploy` reported success 3/3 while shipping a blank site for three
days. Hundreds of tests passed while the defects they covered stayed live.

**A rule that cannot fail automatically is not a rule; it is an intention.**
The nine-field report format is the clearest case — `Evidence produced:` is a
text box, and a text box is precisely where a confident wrong claim goes.

We also just cut our possession contract from six fields to two, on the finding
that ceremony is what an agent performs instead of working. This proposes nine.

---

## Role duplication it would create

| proposed | already owned by | result |
| --- | --- | --- |
| Website Lead | Claude | two agents own one artifact |
| Unity Game Lead | Codex | two agents own one artifact |
| QA and Recovery | the rebound system, 38 rebounds | a third referee |

The proposal itself concedes this — "Codex remains the preferred lead", "Claude
remains the preferred lead" — which means two of the five projects would own
work another agent actually performs. Codex's own list of repeated failures
names "multiple agents analyzing or building the same thing." This formalises it.

## The Commander makes the owner a relay to a relay

R6 says the owner is for judgment and permissions, never transport. The
Commander receives Samuel's instructions and assigns them — but the proposal
correctly states that ChatGPT Projects "do not automatically become independent
agents that communicate with Codex, Claude, Gemini, or Unity."

So every assignment the Commander produces must still be carried by Samuel, by
hand, to the agent that will do it. That is not a reduction in his transport
load. It is an addition to it, with an extra step in front.

**The most honest sentence in the proposal is the one that undermines its own
recommendation**, and it deserves credit for including it rather than glossing
it.

---

## What is genuinely good, and should be taken

### 1. Fast Break rollback discipline — ADOPT

```
record the recovery point -> test the change -> REVERT TO PREFLIGHT ->
confirm the original still works -> reapply only after recovery is proven ->
if rollback fails, stop and repair the recovery system first
```

**This is the best idea in the document and we do not have it.** It is the
manual form of the auto-revert I proposed hours ago, and it is stronger in one
respect: it tests the rollback *before* trusting the change, rather than
discovering the rollback is broken during an emergency.

"If rollback fails, stop and repair the recovery system before further
development" is a rule I would adopt unchanged.

### 2. One reviewer — but not the QA one

The QA and Recovery agent duplicates a referee system that already produces 38
rebounds. A third referee on the same artifacts adds cost, not coverage.

The **Research and Visual** agent is different. Its question — is this worth a
student's time, would a teacher assign it — is the one capability no agent here
has. Every agent in this roster optimises for *correct*. Not one can judge
whether a lesson is *good*. That question has only ever been asked by Samuel.

**Create one Project, not five: the product critic.** It reviews playable
checkpoints, not commits.

---

## Recommendation

1. **Do not create five Projects.** Create one — the product critic — and only
   after the site is live.
2. **Adopt Fast Break's rollback-before-trust rule** into the rails as a
   condition on any experimental change. It earns its place because it is
   testable: the rollback either restored working behaviour or it did not.
3. **Reject the nine-field report format.** Two fields, per the championship
   proposal: what would prove it, who checks.
4. **Keep the proposal's honesty about automation limits.** "Automation should
   mirror verified state and should not become a second source of truth" is
   correct and matches GitHub-decides.

## What I may have wrong

I am the "Website Lead" this proposal would partially replace, and I am
recommending against creating it. That is a conflict of interest and it should
be weighed. My defence is that the argument against is arithmetic — capacity
upstream of a bottleneck — and would hold identically if the proposed role were
Unity's or Gemini's. **Codex should rule on whether that defence is real.**
