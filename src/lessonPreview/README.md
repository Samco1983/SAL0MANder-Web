# Teacher-Led Multiplayer Jigsaw Lesson — Private Preview

**STATUS: PRIVATE, NON-LIVE PREVIEW (fictional learners only).**
Not linked from the public homepage, navigation bar, sitemap, or Arcade. Strictly gated behind `!env.isProd || env.features.lessonPreview` (`VITE_FEATURE_LESSON_PREVIEW`, fail-closed `false` in production builds so `/preview/jigsaw-lesson` renders 404 unless explicitly enabled). Uses fictional test learners (**Maya**, 14, 3.21 consent Yes; **Leo**, 13, 3.21 consent No → shown as **Player 2**; **Priya**, 15, 3.21 consent Yes) and **Mr. Sam** (teacher host), matching [jigsaw-multiplayer-lesson-20261125.md](../../../../claude4-room/portal-launch-20261124/jigsaw-multiplayer-lesson-20261125.md) and Enrollment Agreement v2 Sections `3.21`, `3.22`, `3.22A`, and `4`.

## How to run the 4-tab preview locally (zero setup)
1. Start the dev server: `npm run dev`
2. Open Mr. Sam's host tab: `http://localhost:5173/preview/jigsaw-lesson`
3. Click **Open Maya tab**, **Open Leo (Player 2) tab**, and **Open Priya tab** from the host bar (each opens a separate tab connected in real time via `BroadcastChannel` + `localStorage`).
4. Optional low-volume background audio: click **Music: Off → On** in Mr. Sam's bar to audition **Letters in the Rain** (`/audio/tracks/letters-in-the-rain.mp3`, 74 BPM felt-piano chamber from `SAL0MANder Audio Library > 010 – Antigravity Refined Flow Masters`) at **12% default volume** underneath voice instruction.

## Optional multi-device sync (separate laptops / Chromebooks / phones)
Production `infra/firestore.rules` stays fail-closed (`allow read, write: if false`). To test across separate physical devices using a scratch Firebase Realtime Database:
1. Pass `?fb=https://<your-preview-project>.firebaseio.com` in the room URL (or set `VITE_JIGSAW_PREVIEW_FIREBASE_URL` in `.env.local` — never commit real URLs/keys).
2. Share the generated room URL with each test device (`?room=...&role=learner&seat=seat-1&fb=...`).
3. Shared board state writes ONLY to `/jigsaw_preview/<roomId>/shared.json`. Private learner answers and scratch work write ONLY to `/jigsaw_preview/<roomId>/private/<seatId>.json` and are read ONLY by Mr. Sam's host view.

## Claude 4 Verification Gate (Step 3 checklist)
1. **Single-Turn Control:** Unlock the board on Maya's turn. Confirm Maya can rotate (`±45°` / `+90°` quarter turn) and place pieces live across all tabs, while Leo and Priya's board controls are locked and rejected by both UI and engine (`NOT_ACTIVE_TURN`).
2. **Strict Privacy Isolation (Sections 3.21–3.22A):** Submit typed answers and scratch work from Maya, Leo, and Priya. Confirm:
   - The shared board shows ONLY the count (`3 of 3 answered`), never typed text, scratch work, or individual scores.
   - Leo displays ONLY as `Player 2` everywhere in shared state and peer tabs (`"Leo"` never enters `SharedBoardState`).
   - Mr. Sam's host view blocks spotlighting Leo's work (`CONSENT_321_REQUIRED`), and requires family confirmation before spotlighting Maya's or Priya's work.
3. **Disconnect Resilience:** Pass control to Leo (`Player 2`), then close Leo's tab (or click **Step away**). Confirm the active turn lock automatically releases to Priya with `"Player 2 stepped away · Turn moved to Priya"` — never stranding the group or Mr. Sam.
