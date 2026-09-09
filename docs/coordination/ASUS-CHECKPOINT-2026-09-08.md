# Teacher Studio recovery and corrected Unity player

Teacher Studio now downloads a versioned activity backup and imports it as new
copies. Current edits are included even before autosave, and invalid files,
oversized files and storage failures preserve the existing activities.
See [backup instructions](../TEACHER-STUDIO-BACKUPS.md).

The bundled player was rebuilt with Unity 6000.5.2f1 from Unity source commit
`65d4f8013f20c6a3efcb6ac37903db8b9e38171d`. It fixes Matching completion/replay
state leaking into other modes and Matching disappearing after closing Settings.
The four artifact hashes are recorded in
[the build record](WEBGL-BUILD-2026-09-08.json).

Validation on Windows:

- Lint passed with existing warnings; application/build-configuration TypeScript
  checks passed; TypeScript build and Vite production build passed.
- 937 web tests in 90 files passed with `--maxWorkers=4`; 65 Python mission tests
  passed. Unrestricted concurrency initially timed out in an existing result
  notice test. Assertions/timeouts were unchanged for the bounded passing run.
- Browser backup check: create a labeled test draft, download the current
  title/notes, import as another activity, reload, and verify both copies remain.
- Final player browser check: swap Matching tiles, zoom to 125%, open Settings,
  return with CLOSE and Escape, retain the same board/zoom, finish the puzzle,
  View Picture, replay, and enter Learning without stale completion.
- All four player files in website `dist` match the verified Unity build hashes.
- Public site smoke check: homepage and Integer Operations guest demo loaded;
  submitting a correct answer advanced the counter to 1/9.

This is a feature-branch checkpoint, not a public deployment. The last recorded
public deployment remains main `f5e494d` from September 3 UTC. The active feature
branch diverges from main and needs a deliberate release review.

Production blockers remain: web-created activities do not enter the Unity
runtime; Preview/Publish are incomplete; drafts/accounts/results have no complete
cloud backend; Matching results are display-only; all-mode, recovery and real
Android touch acceptance remain incomplete. The smallest useful next milestone
is to create one activity and play that exact picture/questions/settings in Unity.

Coordination and ranked plan live in the Unity repository at
`docs/coordination/ASUS-PLAN-2026-09-08.md`. The local ASUS workspace has one source
folder per repository and a short Unity path. Codex coordinates bounded writers
and independent reviews; a configured agent does not count as completed work.
