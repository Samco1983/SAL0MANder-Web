# Free puzzle beta

Target: https://sal0mander.com/play

The permanent game site gains the current Mystery Pictures, Learning Puzzle, Classic Jigsaw and eight-level Swap & Solve demos, the 71-picture catalog and catalog-picture gifts. Home and the chooser identify the free beta. Music is requested when an active puzzle starts; mute, focus, visibility and exit controls remain effective. Browser autoplay permission still applies.

Free play introduces Sam's paid services through optional home/chooser/completion links. Tutoring leads to the existing Google appointment schedule. Packets, curriculum and planned memberships use an availability inquiry, with no invented checkout or entitlement. Accounts are hidden when disabled; Teacher Studio is described as local drafts, with publishing unavailable. Paid group/student/gift/ops APIs remain disabled in `.env.free-beta`.

## Validation

- Nine native Editor runners passed. The matching clean WebGL build completed with zero errors and two warnings; source inputs and saved scene summaries were preserved. Full in-memory Editor fingerprint preservation was not verified.
- Local lint, both TypeScript configurations, 1,725 web tests in 157 files, 65 Python tests and the production beta build passed.
- Root Pages routing/artifact checks passed. `/play` and `/demos/slide` have physical entry pages. The checked player manifest binds the source package and the 18 deployed runtime/support files; Pages intentionally substitutes the React wrapper for the standalone native `index.html`.
- Browser checks observed music output after normal entry for all four modes, mute/unmute/exit behavior, and completion of Swap at desktop and phone widths. Optional paid links appeared only after completion and preserved the game. The booking destination displayed the private session and available appointment times.
- Gift creation and copying passed at phone width. Automated gift tests passed. Browser policy blocked the fresh recipient encoded-link navigation, so this release does not claim a completed recipient browser acceptance check. Physical phone/tablet and human audio listening remain manual checks. No paid booking, payment, confirmation or live lesson was executed.

## Release and recovery

The existing GitHub Pages workflow is the publication route. Both PR verification and deployment check the free-beta profile and exact player hashes; post-deployment checks fetch the same versioned player URLs the application uses. Firebase tutoring production, Stripe, Cloud Run and DNS are outside this release.

A verified local rollback source/archive and reconstructed Pages bundle are retained by the coordinator at pinned prior commit `cc83344d5daf82c4a762441a963291d8291db967`. Recovery should preserve Git history through a reviewed revert and the normal deployment workflow; the prior expired Actions artifact is not a retained backup.
