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
`4de199e9c67987e64adcb037183f501639deedde`. They include usable-piece dock
retrieval and new stock reward artwork, with migration and saved-attempt
recovery checks. A matching player must be staged and verified before this
document can claim the new game is published. Sliding Puzzle remains a local
prototype and is not a fifth public mode in this package.

The local artwork catalog is `SAL0MANder/art/catalog/index.html`: 22 unique
masters, source paths and provenance; two old images need repair and six
documented entries still lack a recovered master. Antigravity's recovery
assignment is pending a verified reply. No Copilot coding job is verified.
Claude's external code review remains pending specific code-sharing approval.
