# `CHECK STATUS` — Tier 1 evidence-derived check-in, build spec

**From:** Claude Code (web) · **To:** owner / Codex · 2026-08-18
**Status:** specified, not built — no Make access, no GitHub credential here
**Authority:** `docs/DECISIONS.md` **D-023**

Reports what the system has **committed**. Calls no agent, accepts no
self-reported field, and never infers a value it could not read.

---

## 0 · The two rules everything else serves

1. **No AI agent is invoked and no model authors a field.** Every cell traces to
   a commit, a file in a commit, or an Issue #1 comment. A run with all four
   lanes unreachable produces four `UNKNOWN` rows — it never produces prose.
2. **A gap is labelled, not filled.** No field is carried forward from the
   previous run, no field is inferred from a neighbouring field, and "no
   evidence" never renders as "no blocker". `UNKNOWN` is a successful output.

This does not close **W-9**. Routing and queueing are verified; **agent
invocation is not.** The dashboard states that on every run (§6).

---

## 1 · Lanes and their evidence surfaces

Two lanes, per **D-024**. Both always populated — no permanently `UNKNOWN` rows.

| Lane | Owner | Repo · branch | Docs read | Issue |
| --- | --- | --- | --- | --- |
| Website / Guest Play | Claude | `Samco1983/SAL0MANder-Web` · `main` | `docs/coordination/STATUS.md`, `OPEN-ITEMS.md` | #1 |
| Game / Teacher Studio | Codex | `Samco1983/Sal0mander-Jigsaw-Puzzle` · `main` | `docs/coordination/CURRENT_STATE.md`, `P1_PROCESS.md` | #1 |

**Not lanes, and deliberately absent** (D-024): ChatGPT is advisory, Gemini is
the reader/interface, and "Unity AI visual QA" is a task assigned to Codex or
the owner. None of them commit, so none can be verified, and a row that can only
ever read `UNKNOWN` teaches its reader to ignore rows — the opposite of a
failsafe.

Issue #1 is on `Sal0mander-Jigsaw-Puzzle` and is the **only** write target.

---

## 2 · Field derivation — exact rules

| Column | Source | Rule when the source is missing |
| --- | --- | --- |
| **Lane / Owner** | static config (§3, module 2) | never missing |
| **Verified status** | first `STATUS:` line inside the newest dated entry of the lane's status doc | `UNKNOWN — no STATUS line` |
| **Latest evidence** | `GET /repos/{o}/{r}/commits?sha={branch}&per_page=1` → short sha + first line of message | `UNKNOWN — no commit read` |
| **Blocker** | the `BLOCKERS` section of that same newest entry, verbatim | `UNKNOWN — no BLOCKERS section`. **`None` is a real value and must not collapse to `UNKNOWN`.** |
| **Next action** | the `NEXT` section; else the first unresolved item in the lane's open-items file | `UNKNOWN — no NEXT recorded` |
| **Freshness** | newest of {commit date, last-commit date of the doc, newest Issue #1 comment for that lane} | `UNKNOWN` |

**Freshness bands**, computed against run time in UTC:

| Band | Age of newest evidence |
| --- | --- |
| `FRESH` | ≤ 24 h |
| `AGING` | 24–72 h |
| `STALE` | > 72 h |
| `UNKNOWN` | nothing readable |

`STALE` is a statement about *evidence age only*. It does not mean a lane is
stopped, and the dashboard says so in its footer — the inverse mistake (reading
a quiet lane as a stalled one) has already been made once in this project.

---

## 3 · Module-by-module Make flow

Scenario **`sal0-check-status`**. Read-only against GitHub except the single
dashboard comment.

| # | Module | Notes |
| - | --- | --- |
| 1 | **Webhooks → Custom webhook** `sal0-check-status` | Or a scheduler. No body required. |
| 2 | **Tools → Set variable** `lanes` | The §1 table as a JSON array: `lane`, `owner`, `repo`, `branch`, `docPath`, `openItemsPath`. Config lives here, not in module filters. |
| 3 | **Flow control → Iterator** over `{{2.lanes}}` | One pass per lane. |
| 4 | **HTTP → Make a request** — latest commit | `GET https://api.github.com/repos/{{3.repo}}/commits?sha={{3.branch}}&per_page=1`. Parse response = yes. Error handler **Resume** → `{}` so one unreachable repo cannot fail the run. |
| 5 | **HTTP → Make a request** — status doc | `GET https://api.github.com/repos/{{3.repo}}/contents/{{3.docPath}}?ref={{3.branch}}` with header `Accept: application/vnd.github.raw`. **Use the raw Accept header** — it returns plain text and avoids base64 decoding entirely. Error handler **Resume** → `{}`. |
| 6 | **Tools → Set multiple variables** — parse | `entry` = `{{get(split(5.data; "\n---\n"); 2)}}` (newest entry; element 1 is the file header). Then `match()` per §2 against `entry`. Any empty result stays empty — no defaults. |
| 7 | **Tools → Array aggregator** (source: 3) | Collects all lanes. Guarantees one bundle even if every lane errored. |
| 8 | **Tools → Set variable** `body` | Compose the §6 markdown from `{{7.array}}`. |
| 9 | **Data store → Get a record** `sal0_dashboard`, key `issue1_comment_id` | The pointer to the one comment. |
| 10 | **Router** | Route A: record exists → **11**. Route B (fallback) → **12**. |
| 11 | **HTTP** `PATCH /repos/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/comments/{{9.commentId}}` | Body `{"body": "{{8.body}}"}`. Error handler **Resume** on 404 → falls through to 12, so a deleted comment self-heals. |
| 12 | **HTTP** `POST /repos/Samco1983/Sal0mander-Jigsaw-Puzzle/issues/1/comments` → **Data store → Add/replace a record** storing the returned `id` | Creates the dashboard once, then never again. |
| 13 | **Webhooks → Webhook response** `200`, body = `{{8.body}}` | The one summary back to the caller. |

**Before 12 creates a comment**, list Issue #1 comments once and reuse any whose
body contains the marker `<!-- sal0-checkin-dashboard v1 -->`. The marker is the
real identity of the dashboard; the data-store id is only a cache. Without it, a
lost record silently starts a second dashboard — which is the "two command
centres" failure D-022 exists to prevent, reintroduced by a cache miss.

---

## 4 · Credential

One fine-grained PAT, held **only** in the Make connection:

- `Contents: read` + `Metadata: read` on `SAL0MANder-Web` and `Sal0mander-Jigsaw-Puzzle`
- `Issues: write` on `Sal0mander-Jigsaw-Puzzle` **only**
- nothing else, no `workflow` scope — Tier 2 is out of scope (D-023)

Not stored in this repo, not in any `VITE_` variable, never echoed into the
dashboard body or an error line. Issue #1 is world-readable if that repo is
public: the dashboard carries commit shas and doc text, and must carry nothing
else.

---

## 5 · What Tier 1 cannot see, stated up front

**The web lane's evidence is currently local-only.** Verified 2026-08-18 in this
working copy:

- `gate1-web-readiness` — **no upstream**; `77a7ba4`, `9ca8acc`, `d459035` exist
  on this machine only.
- `main` — **ahead 21, behind 1** of `origin/main`.

So on its first run Tier 1 will read `origin/main` and report the web lane as
`STALE`, correctly and misleadingly at once: the evidence really is old, the
lane really is not. **Pushing is an owner decision and has not been taken**, so
this spec assumes `main` and states the consequence rather than working around
it. Any lane whose work is not pushed has the same property.

This is the honest boundary of the whole design: Tier 1 reports the state of the
*record*, and the record is only as current as what has been pushed.

---

## 6 · Dashboard output

```markdown
<!-- sal0-checkin-dashboard v1 -->
## SAL0MANder — agent check-in

**Last synchronized:** 2026-08-18T14:02:11Z · evidence-derived, no agent was invoked

| Lane | Owner | Verified status | Latest evidence | Blocker | Next action | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| Web / Guest Play | Claude | … | `abc1234` — … | None | … | `FRESH` · 2 h |
| Unity gameplay | Codex | … | `bc216f1` — P1-A: improve Student Play legibility | … | … | `AGING` · 31 h |
| Unity AI / visual QA | Unity AI | `UNKNOWN — no STATUS line` | `UNKNOWN — no commit read` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| Gemini | Gemini | `UNKNOWN — no STATUS line` | `UNKNOWN — no commit read` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |

---
Derived from committed evidence only: git history, coordination docs, and comments on this issue.
No agent was called and no status was self-reported. `STALE` describes the age of the evidence,
**not** whether a lane is working. Agent invocation remains unproven (**W-9**); `WAKE AGENTS` is
disabled.
```

The footer is not decoration. This comment will be read at a glance by someone
deciding whether to intervene, and both misreadings it prevents — "STALE means
stopped", "the dashboard means the agents reported in" — have already happened
in this project.

---

## Not done here

Not built and not tested: no Make access and no GitHub credential in this
session. Explicitly out of scope per D-023 — Tier 2, workflow dispatch, Gemini
function calling, any public webhook button, any provider invocation.
