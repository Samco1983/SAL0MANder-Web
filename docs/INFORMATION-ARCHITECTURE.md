# SAL0MANder Web — Information Architecture

Systems analysis for GitHub issue #12. Docs-only, no `src/` change. Everything
marked **existing** is verified against the current checkout; everything marked
**proposed** is a recommendation for later batches and carries no approval.
Nothing here freezes a contract, chooses a provider, or designs Teacher Studio —
those stay where `CHARTER-WEB-POINT-PERSON.md` and `ROADMAP.md` put them.

Companion documents: issue #13 (teacher dashboard wireframes), #14 (Guest Play
end-to-end wireframes), #15 (integration blueprint). This doc is the map they
all sit on — route ownership and surface boundaries — not the state-by-state
detail those three own.

---

## 1. Sitemap — existing vs. proposed

```
/                      Home                              EXISTING
/play                  Guest Play index (no id)          EXISTING
/play/:activityId      Guest Play                        EXISTING — the product
/profile               Profile                           EXISTING (stub)
/unity                 Unity WebGL host (dev surface)     EXISTING (stub)
*                      404                                EXISTING

/teacher                                                  PROPOSED — deferred
/teacher/activities                                       PROPOSED — deferred
/teacher/activities/:id/share                             PROPOSED — deferred
/teacher/reports                                          PROPOSED — deferred (X-005, D-020 constraint)
/resources                                                PROPOSED — deferred (no owner yet)
/classes                                                  PROPOSED — later (charter: "classes (later)")
```

Six routes exist; one (`GuestPlayPage`) is the actual product, the rest are
scaffolding or stubs. Nothing under `/teacher`, `/resources`, or `/classes`
exists in `src/` today — not a stub, not a placeholder route, nothing. They are
named here only because `CHARTER-WEB-POINT-PERSON.md` commits web to owning them
"eventually," and a sitemap that omits them would understate what a route table
addition later needs to reserve path-namespace for.

---

## 2. Route responsibility table

| Route | Owner surface | Data dependency | Auth | States handled | Status |
| --- | --- | --- | --- | --- | --- |
| `/` | Public | none | none | static only | Existing, placeholder copy |
| `/play` | Guest | none | none | static only | Existing |
| `/play/:activityId` | Guest | `play.resolve` or `activities.getGuestBundle`; `sessions.start`; `sessions.submitResult`; Unity bridge | guest token (device-local, never sent as `Authorization`) | loading, error (recoverable/terminal), ready, result-undeliverable, retry | Existing — fully built |
| `/profile` | Optional-account | none (stub reads guest token only) | none today; auth-gated later | static only | Existing stub |
| `/unity` | Public (dev/QA) | Unity build config only | none | Unity loader's own state machine | Existing stub, not a product surface |
| `*` | Public | none | none | terminal | Existing |
| `/teacher/*` | Teacher | activity list, share links, publish state — none implemented | teacher auth — not chosen | undesigned | Proposed, deferred |
| `/resources` | Optional-account / Teacher | media library — `MediaKindSchema` reserves `'resource'`, nothing else exists | undecided | undesigned | Proposed, deferred, no owner assigned yet |
| `/classes` | Teacher | roster — nothing implemented | teacher auth | undesigned | Proposed, later (explicitly "later" per charter, not this batch) |

**Ownership boundary carried forward from the charter, restated here as the IA
rule:** any route under `/teacher` may link to Unity's Teacher Studio or
describe web-owned metadata (share links, publish state, versions) but must
never reimplement activity editing, puzzle generation, or question authoring —
those stay in Unity per the charter's ownership table.

---

## 3. Existing user journeys (verified against code)

### 3.1 Student, direct share link (the only fully-built journey)

```
Teacher-issued link ──▶ /play/:activityId ──▶ [resolve activity]
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                         loading             error (revoked /      ready
                                              unpublished /
                                              unknown / network)
                                                   │                    │
                                          recoverable? ──▶ retry   Unity stage boots
                                          terminal? ──▶ dead end,      (unconditionally —
                                          "go to home"                 never blocked by
                                                                        companion state)
                                                                        │
                                                                   mode selection
                                                                   (if Student Choice)
                                                                        │
                                                                   session starts
                                                                   (POST /sessions,
                                                                    idempotency-keyed)
                                                                        │
                                                                     gameplay
                                                                   (Unity-owned,
                                                                    web sees only
                                                                    coarse lifecycle)
                                                                        │
                                                              session-finished (bridge)
                                                                        │
                                                     ┌──────────────────┴──────────────────┐
                                                     ▼                                     ▼
                                              submit succeeds                      submit fails
                                              (POST .../result)                    (or start failed)
                                                     │                                     │
                                              session complete                  result-undeliverable:
                                                                                 held in sessionStorage,
                                                                                 companion auto-reveals,
                                                                                 retry available,
                                                                                 survives reload (W-16)
```

No step in this journey requests an account, email, password, or name — the
non-negotiable is structurally true today, not just intended.

### 3.2 Student, mistyped or expired link

`/play/:activityId` resolves to a terminal `LinkFailure` (`SHARE_LINK_REVOKED`,
`ACTIVITY_UNPUBLISHED`, or not-found). No retry offered for terminal failures —
retrying a revoked link cannot succeed. Recovery actions point back to Guest
Play and home, and the failure copy tells the student when the real next action
is asking the teacher for a corrected or new link.

### 3.3 Browsing visitor, no link

`/` → static hero, feature grid, `PlaceholderNotice` naming what's deferred.
Only two CTAs: a hardcoded demo activity id and `/unity`. There is no path from
Home to a real activity without a link — correct for a share-link-first product,
worth stating explicitly since it means Home is not, and should not become, a
browsable activity catalog without a decision to build one.

### 3.4 Returning guest, same device

`getGuestIdentity()` is device-local and persists across visits (localStorage,
not sessionStorage — the one place the app deliberately does *not* scope to a
single tab, since a guest token identifying "this device's guest" is meant to
survive a reload; contrast with `resultHold.ts`'s sessionStorage choice, which
scopes to a single attempt on purpose). A returning guest on the same device
reuses the same token; nothing currently surfaces "you've played this before"
because there is no history/list surface reading it. `/profile` shows the raw
token today, nothing else.

### 3.5 Unity dev/QA visitor

`/unity` is not a product journey — it is a way to boot the Unity build in
isolation. It exists because the WebGL host needs an environment to smoke-test
without going through Guest Play's session lifecycle. Its route responsibility
table entry deliberately says "Public (dev/QA)" rather than any of the four
product surfaces, and it should stay out of primary nav once a real IA ships
(today it's in the header nav as "WebGL Host," which is a P0-only convenience —
flagged in §6 as a Batch A cleanup, not a Batch B/C item).

---

## 4. Proposed journeys — labeled, not designed

These describe *where a future surface would sit in the IA*, per the charter's
ownership table. None of the following is a wireframe (issue #13 owns that for
the teacher surface); this is scope-boundary only.

### 4.1 Teacher: share an activity (issue #13's territory)

```
Unity Teacher Studio (authoring — Unity-owned)
        │  publishes an ActivityVersion
        ▼
/teacher/activities/:id/share  (web-owned — PROPOSED)
        │  generates share code, QR, revoke/reissue
        ▼
share link handed to students ──▶ journey 3.1
```

Web's role is strictly post-authoring: turning a published version into a
distributable link and, later, a status view of who's played it. Nothing here
edits activity content — that stays Unity's per the charter, restated at the
top of this doc.

### 4.2 Teacher: view results (blocked on D-020's classification)

`SessionResult` is explicitly classified "Practice/Unproctored Diagnostics"
(`docs/DECISIONS.md` D-020), not gradebook-grade, because it's client-reported
by an unauthenticated guest session (see also the standing W-1 finding in
`STATUS.md`: the answer key ships to the browser, so `questionsCorrect` is
advisory, never assessment). Any `/teacher/reports` surface must carry that
classification in its own UI, not just in a doc — a teacher-facing dashboard
that *looks* like a gradebook without saying "not verified" would misrepresent
the data's trust level. This is a hard constraint on the eventual wireframe,
not a suggestion.

### 4.3 Optional account: claim a guest session

`GuestIdentitySchema` and `PlayerIdentitySchema`'s discriminated union
(`{kind:'guest'}` vs `{kind:'profile', profileId}`) already model a guest→
profile transition at the type level, but nothing implements it. The proposed
journey — sign up, and your guest-token play history retroactively attaches to
your profile — is namable today because the schema already anticipates it, but
building it is blocked on X-002 (auth provider) and Batch 5 in `ROADMAP.md`.

### 4.4 `/resources` — flagged, not owned

`MediaKindSchema` reserves `'resource'` as a media kind, and the charter lists
"lessons/resources" as something web owns eventually, but no doc assigns it a
concrete shape, and no route reserves the path today. Including it in the
sitemap (§1) is the only claim this doc makes about it — surfacing that the
vocabulary exists before the feature does, so a future author doesn't have to
rediscover that `'resource'` is already a typed media kind.

---

## 5. Data-dependency and state matrix

| Surface | Loading | Empty | Error | Success |
| --- | --- | --- | --- | --- |
| Guest Play — activity resolve | "Loading activity…" text | N/A (a link always names one activity) | `LinkFailure`: recoverable → retry, terminal → Guest Play + home recovery links | title/byline/description/`SharePanel` render |
| Guest Play — session | `submitting` state, Unity stage unaffected | N/A | `result-undeliverable`: companion auto-reveals, retry surfaced when `canRetry`, held result survives reload | session marked complete, storage cleared |
| Unity stage | loader progress state machine (`unconfigured→loading→ready→error`) | N/A | retry token bump | canvas mounted, stage never unmounts regardless of any of the above |
| Home | N/A (static) | N/A | N/A | static render |
| Profile | N/A (static) | guest token only, no history to be empty of | N/A | static render |
| 404 | N/A | N/A | is itself the terminal state | offers two ways out |

The matrix is thin because only Guest Play has real data dependencies today.
Every proposed surface in §4 will need its own loading/empty/error states
authored when it's actually built — explicitly out of scope here per issue
#12's "no src edits" and "don't design undecided UX" constraints.

---

## 6. Implementation batches — independent, reversible, against `main`

Each batch below is choosable independently; none depends on another shipping
first, and none requires a provider/backend/auth decision unless stated.

**Batch A — copy and nav correctness (no approval needed, mock-transport-only)**
- Add "ask your teacher for a new link" to the terminal `LinkFailure` copy
  (§3.2 gap).
- Remove `/unity` from primary header nav; keep the route reachable directly
  (it's a QA surface, not a product page — §3.5).
- Both are copy/JSX-only changes in already-tested components; each is a single
  small PR with an existing or trivially extended test.

**Batch B — reserve the teacher namespace (no approval needed)**
- Add `/teacher` route constants to `config/routes.ts` and a single stub page
  (same `PlaceholderNotice` pattern as `/profile`, `/unity`) so the path exists
  and 404s stop being the answer for anyone who guesses it, without building
  any teacher UX. This is scaffolding identical in kind to what Batch 1 already
  did for `/profile` and `/unity` — it does not design the surface issue #13
  owns, it only reserves where it will live.

**Batch C — teacher share/report surfaces (blocked)**
- Everything in §4.1 and §4.2. Blocked on: issue #13's wireframe (UX), a
  teacher-auth decision (X-002-adjacent), and D-020's advisory-data framing
  being visibly carried into any reports UI.

**Batch D — account claim flow (blocked)**
- §4.3. Blocked on X-002 (auth provider) per `ROADMAP.md` Batch 5.

**Batch E — resources surface (blocked, no owner)**
- §4.4. Blocked on a product decision this doc does not make: whether
  `/resources` is teacher-only, student-visible, or both, and what a "resource"
  actually is beyond a reserved media kind.

---

## 7. Explicit blockers carried into this doc

- **Auth/account model (X-002)** gates §4.3 and any teacher-auth-dependent part
  of §4.1/§4.2.
- **Backend/provider choice (X-001, X-003)** gates real (non-mock) data for any
  new surface.
- **D-020's advisory-data classification** is a hard constraint on §4.2's
  eventual wireframe, not optional framing.
- **Issue #13** owns the actual teacher dashboard wireframe; this doc only
  reserves the route and states the ownership boundary.
- **Issue #14** owns Guest Play's full state-by-state wireframe; §3.1–§3.2 here
  are the IA-level summary, not a replacement.
- **`/resources`** has no product owner decision yet — flagged, not resolved.

No item above is new; each already appears in `DECISIONS.md`'s deferred table
or `ROADMAP.md`'s batch gating. This doc adds no new blocker — it only shows
where each existing one lands on the route map.
