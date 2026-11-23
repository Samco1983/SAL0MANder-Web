# SAL0MANder Arcade: kid-safety rules (read before changing public/arcade)

Owner: Samuel (Coach Sam). These are standing rules for every person and AI agent (Claude, Codex, others).
`scripts/arcade-safety.test.mjs` enforces the checkable ones: if it fails, the site does not deploy.
Do not weaken or delete the test to make a change pass. Ask Samuel first.

## Pictures, cameras, recording
- No camera, microphone or screen recording in any game. Ever.
- Kids never upload pictures in any online or multiplayer game.
- The ONLY picture feature is Moon Gate Mask Maker (`public/arcade/moon-gate/mask.js`):
  offline modes only, after a parent ticks the box, chosen from the device, kept only in that browser,
  never uploaded or sent, never shown online, never stored on the fight state. Nothing measures the face
  (no face scanning, tracking or "make a character from your face").

## Faces and multiplayer
- Online, players appear only as cartoon faces built from parts (Face Builder), sent as ONE number.
- No chat, no names, no text messages between players. Room codes only.
- The race server passes game moves along and stores nothing.

## Privacy
- No accounts, no names, no email from kids. Saves stay on the device; "Clear my data" deletes them.
- No ads, no ad tracking, no selling data. COPPA for under-13s; apply the strictest state rule to everyone.
- The privacy page (`public/arcade/privacy/`) must stay true. Update it in the same change as any new feature.

## Brands and private details
- No third-party brands or characters ("Mii", Nintendo, NFL teams/logos, etc.). Use our own art and names.
- Never mention Samuel's other employer or school anywhere public.

## Money
- Games stay free. Paid extras are optional, our own art, bought by a parent, never pushed on a child.
