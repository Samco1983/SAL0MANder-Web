# Read-Only B-11 Activity-Routing Audit Report

**Date:** 2026-09-01  
**Auditor:** Antigravity  
**Scope:** `/Users/samuel_saldivar/Desktop/SAL0MANder-Web` and live `https://sal0mander.com`  
**Reference Documents Consulted:**
- `AGENTS.md`
- `docs/coordination/STATUS.md`
- `docs/coordination/MIRROR-PROTOCOL.md`
- `docs/CHARTER-WEB-POINT-PERSON.md`
- `docs/coordination/B-11-CONFIRMED-IN-PRODUCTION.md`
- `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/docs/contracts/API_CONTRACT.md` (read-only reference)
- `/Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype/Assets/Scenes/SampleScene.unity` (read-only reference)

---

## 1. How many public activity bundles does the current web mock define?

The current web mock (`src/api/mockTransport.ts`) defines **exactly 1 public playable activity bundle**.

- **File:** `src/api/mockTransport.ts`
  - Lines 18–19:
    ```ts
    const DEMO_ACTIVITY_ID = 'demo-activity'
    const DEMO_VERSION_ID = 'demo-version-1'
    ```
  - Lines 36–42: `MOCK_SHARE_CODES.ok = 'K7Q4M2XP'` (share code alias resolving to the same demo data).
  - Lines 45–94: `demoPlayBundle(activityId: string)` (returns full mock play bundle with title `'Fractions Review'`).
  - Lines 124–144: `demoBundle(activityId: string)` (returns activity summary and version bundle with title `'Sample SAL0MANder Activity'`).
  - Lines 96–122: Defines two link failure states (`revoked-link` / `R3V0K3DX` and `unpublished-activity` / `NPB5HED2`), but these return HTTP 404 errors with specific server codes, not playable bundles.

---

## 2. Which activity IDs and titles are available?

### Defined in Web Mock (`src/api/mockTransport.ts`)
| Type | Identifier | Title | Route & Resolver |
| :--- | :--- | :--- | :--- |
| **Activity ID** | `demo-activity` | `"Sample SAL0MANder Activity"` | `GET /guest/activities/demo-activity` (`mockTransport.ts:223-244`) |
| **Share Code** | `K7Q4M2XP` | `"Fractions Review"` | `GET /v1/play/K7Q4M2XP` (`mockTransport.ts:203-221`) |
| **Revoked Link** | `revoked-link` / `R3V0K3DX` | N/A (Returns 404 `SHARE_LINK_REVOKED`) | `mockTransport.ts:104-122` |
| **Unpublished** | `unpublished-activity` / `NPB5HED2` | N/A (Returns 404 `ACTIVITY_UNPUBLISHED`) | `mockTransport.ts:104-122` |

### Defined in Unity (`Assets/Scenes/SampleScene.unity` lines 9964, 10285, 10508)
| Unity Activity ID | Unity Seed Title | Subject | Piece Count | Present in Web Mock? |
| :--- | :--- | :--- | :--- | :--- |
| `act_quadratics` | `"Quadratics Review"` | Mathematics | 9 | **No (Missing / 404)** |
| `act_cell_structure` | `"Cell Structure"` | Science | 6 | **No (Missing / 404)** |
| `act_vocab_review` | `"Vocabulary Review"` | ELA / Vocabulary | 4 / 9 | **No (Missing / 404)** |

---

## 3. Does every `/play/:activityId` URL resolve different questions, images, and titles, or does everything resolve the same?

**Findings:**
1. **`/play/demo-activity`**:
   - Resolves `demoBundle('demo-activity')` via `api.activities.getGuestBundle`.
   - Title: `"Sample SAL0MANder Activity"`.
   - Questions/Image: Version payload body is `{ placeholder: true }` (no questions).
2. **`/play/K7Q4M2XP`**:
   - Resolves `demoPlayBundle('demo-activity')` via `api.play.resolve`.
   - Title: `"Fractions Review"`.
   - Questions: 9 arithmetic prompts (`"1 + 1 = ?"`, etc.), image asset `display_1024`.
3. **Any other URL (e.g. `/play/act_quadratics`, `/play/act_cell_structure`, `/play/act_vocab_review`, `/play/other-id`)**:
   - Web Mock: `mockTransport.ts:241` throws HTTP 404 `ApiError: No activity ${id}`.
   - Web UI: Transitions `state.status` to `'error'`, renders `<LinkFailure>` ("We couldn't find this activity").
   - Web Boot: `boot` is `undefined`, so `UnityStage` sends **no boot message**.
   - Unity Stage Canvas: Unity WebGL starts unguided and automatically runs its hardcoded default scene activity: `act_quadratics` ("Quadratics Review").
4. **Live Site (`https://sal0mander.com/play/:activityId`)**:
   - Server HTTP status: `HTTP 404` (GitHub Pages SPA fallback returning `404.html` containing React app bundle).
   - Client execution: Browser hydrates the SPA, React Router matches `/play/:activityId`, and executes the mock behavior above.

**Conclusion:** Different URLs do **not** resolve distinct bundles. Only `demo-activity` / `K7Q4M2XP` resolves. All other URLs produce a 404 in the web companion while Unity silently renders the default `act_quadratics`.

---

## 4. What exact boot payload does UnityStage send to Unity?

### Code References
- Construction: `src/routes/guest-play/GuestPlayPage.tsx` (lines 196–206)
- Send Call: `src/unity/UnityStage.tsx` (lines 157–161)
- Serialization & Target: `src/unity/bridge.ts` (lines 173–176, 208–209)

### Dispatch Target
- **GameObject:** `"SAL0MANderBridge"`
- **Method:** `"ReceiveWebMessage"`

### Exact JSON Wire Payload Sent
```json
{
  "type": "boot",
  "version": 1,
  "contractVersion": 1,
  "activityId": "demo-activity",
  "activityVersionId": "demo-version-1",
  "playBundle": {
    "allowedPlayModes": ["learning-puzzle", "classic-puzzle"],
    "defaultPlayMode": "learning-puzzle",
    "puzzle": {
      "pieceCount": 9,
      "boardShape": "square",
      "showBoardGuide": true,
      "enableCameraZoomAndPan": false,
      "allowRestart": true,
      "allowResumeLater": true,
      "allowHints": true,
      "allowCompletedPictureView": false,
      "allowClassicCustomization": false
    },
    "quiz": { ... }
  },
  "clientAttemptId": "01918a5b-...",
  "selectedPlayMode": "learning-puzzle",
  "sessionId": "ses_..."
}
```

---

## 5. Does the payload preserve the requested activityId?

- **On the Web Side:** **Yes**.
  `src/routes/guest-play/GuestPlayPage.tsx:199` sets `activityId: bundle.summary.id`. The requested activity ID is correctly carried into the JSON payload.
- **On the Unity Side (The B-11 Defect):** **No**.
  As documented in `docs/coordination/B-11-CONFIRMED-IN-PRODUCTION.md`, Unity's `SAL0MANderBridge.ReceiveBoot` receives and stores `activityId`, but never forwards it to `ActivityManager.LoadActivity` or `SessionContext.TargetActivityId`. Unity ignores the payload's activity ID and continues executing `ActivityManager.ActiveActivity` (`act_quadratics`).

---

## 6. Which public homepage/demo links currently exist?

### On Homepage (`src/routes/home/HomePage.tsx`)
- `src/routes/home/HomePage.tsx:50-52`: `<LinkButton to="/play/demo-activity">Try a sample activity</LinkButton>`
- `src/routes/home/HomePage.tsx:59-61`: `<LinkButton to="/privacy">Privacy & student data</LinkButton>`
- `src/routes/home/HomePage.tsx:106-108`: `<LinkButton to="/play/demo-activity">See what a student sees</LinkButton>`
- `src/routes/home/HomePage.tsx:111-115`: `<SharePanel activityId="demo-activity" />` (copies `https://sal0mander.com/play/demo-activity`)

### On Guest Play Index (`src/routes/guest-play/GuestPlayPage.tsx`)
- `src/routes/guest-play/GuestPlayPage.tsx:441-444`: `<LinkButton to="/play/demo-activity">Try a sample activity</LinkButton>`
- Class code input form directing to `/play/:code`

### Live Site Verification (`https://sal0mander.com`)
- Links present: `/play/demo-activity`, `/about`, `/privacy`, `/terms`.
- Links for `act_quadratics`, `act_cell_structure`, `act_vocab_review`: **None exist**.

---

## 7. What minimum web-only changes would be required to support three distinct activities matching Unity?

To support `act_quadratics`, `act_cell_structure`, and `act_vocab_review` in the web application without backend or Unity changes:

1. **`src/api/mockTransport.ts`**:
   - Define 3 mock bundle records:
     - `act_quadratics` ("Quadratics Review", 9 pieces, Math questions)
     - `act_cell_structure` ("Cell Structure", 6 pieces, Biology questions)
     - `act_vocab_review` ("Vocabulary Review", 4 pieces, Vocabulary questions)
   - Assign distinct mock share codes in `MOCK_SHARE_CODES` (e.g. `QUAD2026`, `CELL2026`, `VOCB2026`).
   - Update `route()` to resolve any of the 3 IDs and share codes.
2. **`src/routes/home/HomePage.tsx`**:
   - Update the hero/sample section to offer a selection among the 3 subject samples (Math, Science, Vocabulary) instead of a single link to `demo-activity`.
3. **`src/routes/guest-play/GuestPlayPage.tsx` (`GuestPlayIndexPage`)**:
   - Present sample links for all 3 activities when a user lands on `/play` without a code.

---

## 8. Exact Tests Needed

1. **Each URL resolves a different bundle:**
   - **Target File:** `src/routes/guest-play/shareResolution.test.ts` & `src/api/mockTransport.test.ts`
   - **Assertions:**
     - `GET /guest/activities/act_quadratics` -> returns `title: "Quadratics Review"`, `pieceCount: 9`, math questions.
     - `GET /guest/activities/act_cell_structure` -> returns `title: "Cell Structure"`, `pieceCount: 6`, science questions.
     - `GET /guest/activities/act_vocab_review` -> returns `title: "Vocabulary Review"`, `pieceCount: 4`, vocabulary questions.
2. **Each boot message carries the correct activityId:**
   - **Target File:** `src/unity/boot.test.tsx` & `src/routes/guest-play/GuestPlayPage.test.tsx`
   - **Assertions:**
     - Render `GuestPlayPage` at `/play/act_quadratics` -> spy on `SendMessage` -> verify payload contains `"activityId": "act_quadratics"`.
     - Render `GuestPlayPage` at `/play/act_cell_structure` -> verify payload contains `"activityId": "act_cell_structure"`.
     - Render `GuestPlayPage` at `/play/act_vocab_review` -> verify payload contains `"activityId": "act_vocab_review"`.
3. **No unknown ID silently opens another puzzle:**
   - **Target File:** `src/routes/guest-play/GuestPlayPage.test.tsx`
   - **Assertions:**
     - Render `GuestPlayPage` at `/play/non-existent-activity`.
     - Verify `state.status === 'error'` and `<LinkFailure>` renders error text `"couldn't find that activity"`.
     - Verify `SendMessage` is **never called with `type: 'boot'`**.
     - Verify Unity stage canvas is not mounted into gameplay when bundle resolution fails.
4. **Guest Play remains account-free:**
   - **Target File:** `src/routes/guest-play/noAccountInvariant.test.tsx`
   - **Assertions:**
     - Render `/play/:activityId` across all 3 activities.
     - Verify `queryByLabelText(/password|email|name/i)` is `null`.
     - Verify `queryByRole('button', { name: /sign in|log in|register/i })` is `null`.
     - Verify `getGuestIdentity()` returns an anonymous device-local token without server-side PII cookies.
