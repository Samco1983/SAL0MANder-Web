# Gemini Asset Scout Brief

**Status:** ready for a scout/research pass, not Unity implementation.

**Owner:** SAL0-01 routes; SAL0-06/SAL0-07 can scout; SAL0-04 can turn this
into web-facing docs or fixture manifests; Unity-side import remains SAL0-08 /
Unity lane.

## Purpose

Build a reusable picture/fixture library for SAL0MANder's game world without
blocking web/deploy scoring or crossing into Unity gameplay implementation.

Gemini is currently useful as a **text scout**:

- propose visual packs;
- research public-domain / licensed source candidates;
- write image-generation prompts;
- check whether image concepts match the education audience;
- produce a manifest the Unity lane can consume later.

Gemini is **not** assumed to be an image producer in this automation lane. If a
real image tool is available, route that separately and keep the files outside
the Web repo unless a web-facing mockup needs them.

## Technical Rule

Asset packs should be grouped by **runtime use**, not only by file type.

Unity's Addressables guidance points at logical organization, runtime
performance, memory management, update frequency, and version-control conflict
risk. For game content, grouping assets loaded together by level/theme is often
better than global buckets like `Textures/` or `Prefabs/`.

Sources used for this pass:

- Unity Addressables: organize by logical category, performance, memory,
  scale, platform, distribution, update frequency, and VCS conflict risk.
- Unity Addressables overview: addresses and labels let assets be loaded by
  runtime identity instead of physical folder location.
- Unity Addressables planning guidance: bundle/group strategy should follow
  how the game loads and unloads content.

## First Picture Packs

These are the first scout packs. Each pack should produce a concept sheet, a
fixture manifest, and 8-12 candidate prompts. Do not generate final gameplay
assets until the Unity lane accepts dimensions, art style, file format, and
import path.

## Business Ranking Provenance

Samuel's remembered original approximate production split:

| Share | Category | Examples |
| ---: | --- | --- |
| 35% | Cute animals/pets | cats, dogs, baby animals |
| 20% | Fantasy/adventure | dragons, castles, magical worlds |
| 15% | Space/science | planets, astronauts, rockets |
| 15% | Nature/scenery | oceans, forests, waterfalls |
| 10% | Sports/vehicles/action | sports, vehicles, action |
| 5% | Seasonal/holiday packs | seasonal and holiday packs |

Current active production mix shifts some share into **bonus crossover
pictures** because combined themes are collectible and feel more original:
cat astronaut in space, dog superhero over a city, dragon playing basketball,
animals exploring an underwater castle, robot teacher with animal students,
dinosaur driving a race car, space-themed sports stadium, and fantasy
creatures doing science experiments.

Rule for agents: preserve the original ranking as business memory; use the
current mix for production unless Samuel changes it again.

| Pack | Use | Pictures To Produce |
| --- | --- | --- |
| `space-lab` | early high-energy stage | starfield background, soft planet tiles, comet rewards, spaceship frame, astronaut cat helper, astronaut dog helper |
| `pet-classroom` | friendly default / younger students | classroom background, reading rug, cat coach, dog coach, paw badges, sticker reward sheet |
| `jungle-discovery` | exploration stage | canopy background, vines, stone puzzle tiles, friendly bird/monkey stickers, leaf progress bar |
| `ocean-reef` | calm focus stage | reef background, bubble UI frame, shell tokens, fish guide, sea-star reward |
| `crystal-cave` | harder puzzle stage | cave background, glowing crystals, gem tokens, torch frame, sparkle feedback |
| `desert-ruins` | challenge / mastery stage | sunlit ruins background, sandstone tiles, map fragments, compass reward |

## Prompt Template

Use this template for every candidate. Keep the prompt reusable and rights-clean.

```text
Create a [ASSET TYPE] for a kid-friendly educational puzzle game.
Theme: [PACK].
Audience: elementary / middle-school learners.
Style: warm, readable, high-contrast, playful but not babyish.
Composition: [BACKGROUND / CHARACTER / TOKEN / UI FRAME details].
Constraints: no text in image, no copyrighted characters, no logos, no realistic
child faces, no scary violence, no photoreal school children.
Deliverable: [transparent PNG sprite / 16:9 background / square icon concept].
```

## Fixture Manifest Shape

The scout should output JSON like this, not a pile of prose:

```json
{
  "pack": "space-lab",
  "lane": "Unity/Game asset scout",
  "status": "proposal",
  "style": "warm readable kid-friendly puzzle art",
  "assets": [
    {
      "id": "space-lab.background.starfield-01",
      "type": "background",
      "runtimeGroup": "space-lab",
      "targetUse": "stage background",
      "prompt": "Create a 16:9 starfield...",
      "rights": "generated-clean",
      "needsUnityApproval": true
    }
  ]
}
```

## Acceptance Check

A scout pass is complete when it creates:

1. Three fully filled pack manifests.
2. At least 24 image prompts total.
3. A source/rights note for any non-generated reference.
4. A Unity handoff note that says exactly what is still unknown:
   dimensions, import folder, compression, Addressables labels, and whether
   assets are local or remote.

## Timeout Rule

Try to wake Claude/Gemini for this once.

- If no movement after 10 minutes: record `SCOUT_UNREACHABLE` and move on.
- If two attempts fail the same way: bench that seat for this asset lane.
- If the scout succeeds: do not import assets into Unity from the Web lane.
- If Codex has spare capacity: Codex may write the manifest/schema/docs, but
  final Unity import is still a Unity-lane shot.

## Next Safe Shot

Create `docs/coordination/assets/space-lab.manifest.json` as the first fixture
manifest with prompts only. No generated images, no Unity repo edits.
