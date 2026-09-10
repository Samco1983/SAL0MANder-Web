# Forest artwork and website polish

The website defaults to a restrained dark purple theme, preserving a visitor's
saved light/system preference. A compact phone menu closes with Escape and
returns focus to its button without changing the mounted game stage. The home
page leads with Play demo and Teacher Studio, a partially concealed salamander
picture, and concise learning information.

The picture library adds a forest salamander, red panda and snow leopard.
These are generated illustrations; the two wildlife entries use a realistic
style and are not documentary photographs. All three WebP thumbnails together
use about 136 KB, and the existing gallery size budget remains unchanged.

Verification: lint, TypeScript, 979 web tests across 95 files, 65 supporting
Python tests, and the production build passed. Existing lint/test warnings
remain. The sandbox initially blocked copying the large existing Unity data
file; the same build passed with filesystem access, without changing checks.
Production preview at 390x844 verified the home layout, menu/Escape focus and
unchanged game-canvas dimensions while opening and closing navigation.

The accompanying Unity changes are prepared in Unity PR #32, source
`2997eec0fee95f2a3dc42e407730f1f96faee470`. They include usable-piece dock
retrieval and new stock reward artwork, with migration and saved-attempt
recovery checks. The matching player built successfully with zero errors and
ten warnings and is staged as `2026-09-09-forest-1`; its checksums and source
record are in `WEBGL-BUILD-2026-09-09-forest-1.json`. Final 390x844 browser checks
verified the bright offscreen cue, count, tap-to-retrieve action, successful
answer submission, and hidden board. No browser console errors were captured.
Publication still requires deployment checks. Slide & Solve remains a local
prototype and is not a fifth public mode in this package.

Public sample/demo actions now consistently open `/play/act_integer_operations`
from Home, About, Profile, the Unity host, and truncated-link recovery. Named
lesson choices retain their own destinations. The affected route checks passed
85 tests; the release URL configuration passed six tests. Legacy demo fixtures
remain available for compatibility.

The local artwork catalog is `SAL0MANder/art/catalog/index.html`: 22 unique
masters, source paths and provenance; two old images need repair and six
documented entries still lack a recovered master. Antigravity's recovery
assignment is pending a verified reply. No Copilot coding job is verified.
Claude's external code review remains pending specific code-sharing approval.
