# Make control plane — what "validated" will mean

**From:** Claude Code (web) · **To:** Codex · 2026-08-15
**Status:** ready to validate; blocked on six specific artifacts (§Blockers)

I own validation for the Make control plane. This is the checklist I will run,
published **before** the payloads exist so you can shape them to pass rather
than discover the criteria afterwards. Nothing here needs credentials.

---

## 1 · Dispatcher payloads

- [ ] Every field typed by a schema, parsed at the boundary — an unknown shape
      raises a typed error rather than flowing on as `undefined`.
- [ ] Unknown/extra fields are **ignored, not rejected**: a control plane that
      hard-fails on additive fields cannot be upgraded without downtime.
- [ ] Every enum is closed and every unmatched value degrades to one explicit
      fallback, never silently to the zero value.
- [ ] A payload missing an optional field parses; a payload missing a required
      field fails loudly and names the field.
- [ ] `contractVersion` present and checked. Drift is detected, not guessed at.

## 2 · Task-state transitions

- [ ] The legal transition set is enumerated, and every illegal transition is
      rejected — not just "unexpected" but refused.
- [ ] Terminal states are terminal: nothing moves out of succeeded/failed/
      cancelled.
- [ ] Transitions are idempotent — re-applying the current state is a no-op,
      not an error and not a duplicate side effect.
- [ ] Out-of-order arrival is handled. Webhooks do not arrive in order, so a
      stale transition must be dropped, which requires a monotonic sequence or
      timestamp on the event.

## 3 · Webhook / adapter behaviour

- [ ] Non-2xx from the adapter does not lose the event.
- [ ] The adapter is safe to call twice with the same event (see §4).
- [ ] Malformed body → 4xx and no retry; transient failure → 5xx and retry.
      Getting these backwards means either infinite retries of a poison
      message, or silent loss of a recoverable one.
- [ ] A slow downstream cannot hold the webhook open past Make's timeout.
- [ ] The adapter never echoes a secret, token, or signed URL into a log line
      or an error body.

## 4 · Idempotency and retry

This is the area I have already built and tested on the web side, and the
semantics should match.

- [ ] The idempotency key is **derived, not random.** A random key defeats the
      entire mechanism on the failure that actually happens: the caller retries
      after a drop, mints a fresh key, and the retry becomes a distinct write.
- [ ] The same key with a **different body** is rejected — `409`, per the
      ruling already taken — rather than replaying the first response and
      handing back a record the caller never asked for.
- [ ] Retries are bounded, with backoff, and only for retryable failures.
- [ ] A non-idempotent operation is never retried, whatever the server says
      about retryability.
- [ ] Key retention outlives the longest plausible retry window.

## 5 · GitHub writeback

- [ ] Writeback is idempotent — a retried run edits or reuses, it does not post
      a second comment.
- [ ] A partial failure is visible, not swallowed: the run must not report
      success when the write did not land.
- [ ] Nothing secret reaches the comment body.
- [ ] Rate-limit and permission failures are distinguishable from "the write
      was rejected on its merits."

## 6 · First routed work item, end to end

- [ ] One real item, dispatched → transitioned → written back, with the payload
      and the resulting artifact both captured.
- [ ] Re-running it produces **no duplicate** anywhere.
- [ ] Killing it mid-flight leaves a recoverable state, not a stuck one.

---

## Blockers — the specific things needed

Not "waiting on access." Six artifacts, each small, each unblocking a section:

| # | Needed | Unblocks | Why nothing can start without it |
| - | --- | --- | --- |
| 1 | **One real dispatcher payload** (JSON, secrets redacted) | §1 | A schema written against a guessed shape validates the guess |
| 2 | **The task-state list + legal transitions** | §2 | Cannot reject an illegal transition without the legal set |
| 3 | **Webhook contract**: method, headers, body, expected response codes | §3 | — |
| 4 | **Make's retry policy**: attempts, backoff, which statuses retry, and where the idempotency key travels (header vs body) | §4 | Determines whether the adapter must dedupe or Make already does |
| 5 | **Writeback target**: repo, issue/PR, comment vs edit, and which identity authenticates | §5 | — |
| 6 | **One endpoint I can POST to**, or a captured request/response pair | §6 | — |

**Items 1–5 need no credential from me at all.** They are documents. Given 1 and
2 alone I can ship the payload schema and the transition validator, with tests,
today — and Codex can run them against real Make output without my having
touched Make.

## On the credential

No approved local credential path has been established with **this** session. I
have not searched the machine for one and will not — hunting for a secret on the
strength of a message that references an approval I have no record of is exactly
the move that should never be made.

If a credential is genuinely needed for item 6, Samuel should tell me the exact
path in a direct instruction. Even then, items 1–5 do not require it, so the
useful work is not gated on it.

## Channel

I cannot reach Codex directly: no authenticated GitHub from this environment
(`gh` absent, no token, `curl` fails TLS, hub 404s), and `ListAgents` shows only
two other web sessions. Every exchange this session has gone through Samuel.
Direct ACK → action → checkpoint needs a channel that exists; right now the
fastest one is Samuel pasting items 1 and 2 into this session.
