# Make claim flow — FIFO repair, build spec

> ⚠️ **SUPERSEDED IN PREMISE — do not build from this without reading
> [`ARCHITECTURE-REVIEW-2026-08-18.md`](ARCHITECTURE-REVIEW-2026-08-18.md)
> first.** That review is the current architecture of record. It finds this
> queue solves a problem the project no longer has: it hands work to competing
> workers, and there are none — two agents each own a repo and never contend.
> The spec is technically sound and stays on file. Formal retirement is still
> the owner's call (D-024), so nothing here is deleted.

**From:** Claude Code (web) · **To:** owner / Codex · 2026-08-18
**Status:** specified, not built — no Make access from this session
**Scope:** replaces brittle exact-match claim selection with a FIFO queue claim.
Nothing else changes. Make stays the control plane. GitHub stays authoritative
(`docs/DECISIONS.md` D-022).

Ingress and execution are already proven, so nothing below re-tests them.

---

## 1 · Module-by-module flow

Scenario: **`sal0-claim-task`**. Nine modules, one router, two terminal paths.

| # | Module | Purpose |
| - | --- | --- |
| 1 | **Webhooks → Custom webhook** `sal0-claim-task` | Ingress. Body: `workerId` (required), `lane` (optional), `idempotencyKey` (optional). |
| 2 | **Data store → Search records** `sal0_task_ledger` | The FIFO select. Filter §2, sort `createdAtUtc` ascending, **limit 1**. |
| 3 | **Tools → Array aggregator** (source: module 2) | **Not optional.** A search with zero hits emits zero bundles, so every module after it is skipped — including the response. The aggregator always emits exactly one bundle, which is the only way the 204 path can ever fire. This is the single most likely reason the current flow "returns nothing". |
| 4 | **Flow control → Router** | Two routes, evaluated in order. |
| 4a | *Route A filter:* `{{length(3.array)}}` **greater than** `0` | A task was found. |
| 4b | *Route B:* leave as **fallback route** (Make's "Fallback" checkbox) | Nothing claimable. |
| 5 | **Data store → Add a record** `sal0_claim_locks` *(Route A, optional hardening — §5)* | Duplicate-pickup guard. Key = `taskId`, **Overwrite an existing record = NO**. Error handler: **Resume** → `{"acquired": false}`. |
| 5b | *Filter after 5:* `{{5.acquired}}` **not equal to** `false` | Lock lost to another worker → falls through to the 204 response. |
| 6 | **Data store → Update a record** `sal0_task_ledger` | Marks the pickup. Key = `{{3.array[1].key}}`. Fields §3. **Immediately after selection — no modules between 2 and 6 except the aggregator, router and lock.** |
| 7 | **Webhooks → Webhook response** | `200`, body = claimed task JSON. **Placed before Google Docs** so worker latency is one data-store round trip. |
| 8 | **Google Docs → Insert a paragraph to a document** | Audit mirror. Error handler: **Ignore**. §4. |
| 9 | **Webhooks → Webhook response** *(Route B)* | `204`, body empty. |

Route A order is fixed: **6 → 7 → 8.** Update, then answer, then audit.

---

## 2 · Exact filter config — module 2

`Data store → Search records`, data store `sal0_task_ledger`.

**Filter** (AND between groups, OR inside group 2):

| Group | Field | Operator | Value |
| - | --- | --- | --- |
| 1 | `state` | Text: Equal to | `ASSIGNED` |
| 2 | `adapterState` | Text: Not equal to | `PICKED_UP` |
| 2 (OR) | `adapterState` | **Does not exist** | — |
| 3 *(only if lane is passed)* | `lane` | Text: Equal to | `{{1.lane}}` |

**Sort by:** `createdAtUtc` · **Direction:** Ascending · **Limit:** `1`

Three things that will bite:

- **The OR in group 2 is load-bearing.** In Make, `Not equal to` against a field
  that was never set does **not** match. Every ledger row written before
  `adapterState` existed is invisible to a bare `!= PICKED_UP` — which is the
  same class of failure as the exact-match lookup being replaced here. The
  durable fix is a one-off backfill of `adapterState = "NONE"` across the
  ledger; keep the OR until that is done, and it costs nothing to keep after.
- **Group 3 is conditional.** Add the lane condition only when the worker
  genuinely requires a lane. An unconditional `lane = {{1.lane}}` with `lane`
  absent matches nothing and reproduces the current bug exactly.
- **If your Data Store module has no Sort field** (it varies by Make version):
  set Limit to `50`, drop the aggregator's source onto the search, and select
  the head with `{{get(sort(3.array; asc; createdAtUtc); 1)}}`. Same result,
  one more expression, no extra module.

---

## 3 · Exact update fields — module 6

`Data store → Update a record`, data store `sal0_task_ledger`,
Key `{{3.array[1].key}}`.

| Field | Value |
| --- | --- |
| `adapterState` | `PICKED_UP` |
| `workerId` | `{{1.workerId}}` |
| `updatedAtUtc` | `{{formatDate(now; "YYYY-MM-DDTHH:mm:ss[Z]"; "UTC")}}` |
| `pickedUpAtUtc` | `{{formatDate(now; "YYYY-MM-DDTHH:mm:ss[Z]"; "UTC")}}` |

Leave `state` at `ASSIGNED` — pickup is adapter-layer, not a task-state
transition. Do not blank any field not listed: Make's update writes only mapped
fields, so leave `idempotencyKey`, `owner`, `taskType` and `createdAtUtc`
unmapped and they survive intact. That preservation is what makes the audit row
in §4 and any later duplicate investigation possible.

---

## 4 · Google Docs append — placement and payload

**Placement: module 8, after the 200 response.** Make continues executing after
a Webhook response module, so the worker is already unblocked while the append
runs. A Docs outage then costs audit latency, never a claim.

**Error handler on module 8: `Ignore`.** The run is marked complete and the
claim stands. Without this, a Docs 5xx marks the execution failed and — worse —
a scenario-level rollback would make an already-answered claim look unclaimed.

**Module:** `Google Docs → Insert a paragraph to a document`, one pipe-delimited
line appended at end of document:

```
{{formatDate(now; "YYYY-MM-DDTHH:mm:ss[Z]"; "UTC")}} | {{3.array[1].taskId}} | {{3.array[1].idempotencyKey}} | {{3.array[1].owner}} | {{3.array[1].taskType}} | {{3.array[1].state}} | PICKED_UP | CLAIM_PICKUP | {{1.workerId}} | claimed via sal0-claim-task
```

Fields in order: `timestampUtc`, `taskId`, `idempotencyKey`, `owner`,
`taskType`, `state`, `adapterState`, `event`, `workerId`, `note/outcome`.

Append-only. **Nothing in this scenario reads from Google Docs**, and no branch
depends on module 8 succeeding. If the audit is ever wanted as columns rather
than a line, `Google Sheets → Add a row` drops in at the same position with the
same ten fields and no other change — the placement and the `Ignore` handler are
what matter, not the destination.

---

## 5 · Duplicate-pickup mitigation

**Make's Data Store has no compare-and-swap.** Search-then-update is two calls,
so between them another run can select the same row. Everything below narrows
that window; only the first closes it.

1. **Sequential processing — do this one.** Scenario settings → **Sequential
   processing = ON**, and turn **off** parallel webhook processing. Queued
   claims then run strictly one at a time, so the read-write pair is effectively
   atomic *within this scenario*. This is the actual fix; it costs throughput
   this queue will never need.
2. **Update immediately after selection** (§1: no modules between search and
   update beyond the aggregator, router and lock). Shrinks the window to a
   single data-store round trip.
3. **Lock record** (module 5): `Add a record` into `sal0_claim_locks` keyed on
   `taskId` with **overwrite = NO** fails when the key exists. Cheap, and it
   catches the case sequential processing cannot — a second scenario, a manual
   run, or a duplicate scenario clone touching the same ledger. Treat it as
   *very likely* atomic rather than guaranteed; it is a narrowing, not a proof.
4. **`workerId` on the record** (§3) makes a double-pickup detectable after the
   fact: two audit rows for one `taskId` with different `workerId` is the
   signature. Preserved `idempotencyKey` is what lets the writeback stage reject
   the second result rather than record it.

Residual risk, stated plainly: with 1 and 3 in place, a duplicate pickup needs
two runs to interleave inside a single data-store write. Low, not zero. The
thing that makes it *safe* rather than merely rare is downstream idempotency on
the writeback — which is already specified in `MAKE-VALIDATION-SPEC.md §4` and
is not part of this repair.

---

## Not done here

Not built, not tested — this session has no Make access. Module numbers assume
the layout above; if the existing scenario is edited in place rather than
rebuilt, renumber the `{{n.field}}` references to match.
