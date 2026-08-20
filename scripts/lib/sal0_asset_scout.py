#!/usr/bin/env python3
"""SAL0MANder asset scout.

This is a Gemini-friendly lane tool for picture-content planning. It does not
generate images and it does not touch the Unity repo. It creates clean prompt
manifests that a scout, image tool, or Unity-lane importer can consume later.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "docs" / "coordination" / "assets"
OPS_DIR = ROOT / "docs" / "coordination" / "ops"
GEMINI_WRAPPER = ROOT / "scripts" / "sal0-gemini.sh"

STYLE = "warm readable kid-friendly puzzle art"
LANE = "Unity/Game asset scout"


@dataclass(frozen=True)
class AssetSeed:
    asset_type: str
    name: str
    target_use: str
    deliverable: str
    composition: str


@dataclass(frozen=True)
class PackSeed:
    pack: str
    use: str
    runtime_group: str
    assets: tuple[AssetSeed, ...]


PACKS: dict[str, PackSeed] = {
    # --- packs added to close the gap against the production mix -------------
    # The six original packs cover fantasy, space and nature well and leave the
    # three largest business priorities empty: cute animals is 30% of the target
    # with one pack, and bonus crossover (15%), sports (10%) and seasonal (5%)
    # had none at all. Nature is 33% of packs against a 10% target, so nothing
    # further is added there.
    "puppy-park": PackSeed(
        pack="puppy-park",
        use="friendly default / broadest appeal",
        runtime_group="puppy-park",
        assets=(
            AssetSeed("background", "sunny-dog-park", "stage background", "16:9 background concept", "bright park lawn with a low fence, a shady tree, scattered toys at the edges, and an open uncluttered center where puzzle pieces can sit"),
            AssetSeed("character", "puppy-guide", "helper/coach character", "transparent PNG sprite concept", "round-faced puppy sitting upright with head tilted, one ear up, looking toward the player as if waiting to help"),
            AssetSeed("character", "old-dog-mentor", "helper/coach character", "transparent PNG sprite concept", "calm older dog with soft grey muzzle wearing a small neckerchief, settled and patient rather than excited"),
            AssetSeed("reward", "bone-badge", "positive feedback token", "square icon concept", "rounded bone-shaped badge with a soft shine and a silhouette that stays readable at icon size"),
            AssetSeed("tile-set", "toy-set", "decorative puzzle tile variants", "sprite sheet concept", "six simple dog-toy tiles — ball, bone, rope, frisbee, squeaker, water bowl — each with a distinct silhouette so they do not read alike when small"),
            AssetSeed("ui-frame", "fence-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "rounded wooden-fence frame with warm tones and an empty readable center"),
        ),
    ),
    "farm-friends": PackSeed(
        pack="farm-friends",
        use="younger students / early sessions",
        runtime_group="farm-friends",
        assets=(
            AssetSeed("background", "red-barn-morning", "stage background", "16:9 background concept", "gentle farmyard at morning light with a red barn to one side, rolling green field behind, and a clear flat center area"),
            AssetSeed("character", "calf-helper", "helper/coach character", "transparent PNG sprite concept", "small friendly calf with large soft eyes standing square, one hoof lifted in a welcoming pose"),
            AssetSeed("character", "duckling-helper", "helper/coach character", "transparent PNG sprite concept", "cheerful duckling mid-step with a tiny satchel, bright enough to read against a green field"),
            AssetSeed("reward", "sunflower-badge", "positive feedback token", "square icon concept", "bright sunflower badge with bold petals and a strong outline for small sizes"),
            AssetSeed("sticker-sheet", "barn-stickers", "reward collection", "sprite sheet concept", "six farm reward stickers — egg, hay bale, apple, watering can, boot, rainbow — flat and high contrast"),
            AssetSeed("ui-frame", "hay-frame", "companion panel decoration", "transparent PNG UI frame concept", "rounded frame of stylised hay and rope with an empty readable content area"),
        ),
    ),
    "cosmic-critters": PackSeed(
        pack="cosmic-critters",
        use="bonus crossover unlock — animals x space",
        runtime_group="cosmic-critters",
        assets=(
            AssetSeed("background", "pet-space-station", "stage background", "16:9 background concept", "cheerful space station interior with round windows showing planets, animal-sized bunks along the edges, and a clear open center"),
            AssetSeed("character", "cat-astronaut", "unlockable reward character", "transparent PNG sprite concept", "cat in a rounded space helmet floating with paws out, tail curled, clearly delighted rather than alarmed"),
            AssetSeed("character", "hamster-pilot", "unlockable reward character", "transparent PNG sprite concept", "hamster in a small flight jacket and goggles gripping a tiny control stick"),
            AssetSeed("reward", "crossover-medal", "unlock celebration token", "square icon concept", "medal combining a paw print and a star, readable at icon size, clearly a rarer award than a standard badge"),
            AssetSeed("poster", "cat-astronaut-poster", "completion reward image", "portrait poster concept", "a cat astronaut planting a small flag on a friendly cratered moon with Earth behind — composed as a keepsake image a student earns, not as a play surface"),
            AssetSeed("ui-frame", "porthole-frame", "reward reveal frame", "transparent PNG UI frame concept", "rounded porthole frame with soft metal edging and an empty center for the revealed image"),
        ),
    ),
    "dragon-court": PackSeed(
        pack="dragon-court",
        use="bonus crossover unlock — fantasy x sports",
        runtime_group="dragon-court",
        assets=(
            AssetSeed("background", "castle-court", "stage background", "16:9 background concept", "outdoor basketball court in a castle courtyard, banners on the walls, hoop to one side, clear playable center"),
            AssetSeed("character", "basketball-dragon", "unlockable reward character", "transparent PNG sprite concept", "friendly round-snouted dragon mid-dribble with a basketball, wings tucked, expression focused and playful"),
            AssetSeed("character", "knight-referee", "unlockable reward character", "transparent PNG sprite concept", "small cheerful knight in light armour holding a whistle, visor up so the face reads friendly"),
            AssetSeed("reward", "flame-trophy", "unlock celebration token", "square icon concept", "trophy with a soft flame motif, distinct in silhouette from the standard star and paw badges"),
            AssetSeed("poster", "dragon-dunk-poster", "completion reward image", "portrait poster concept", "a dragon completing a gentle dunk with banners flying — a keepsake image a student earns, energetic but never aggressive"),
            AssetSeed("tile-set", "banner-set", "decorative puzzle tile variants", "sprite sheet concept", "six castle banner tiles in different colours and simple heraldic shapes, readable at small sizes"),
        ),
    ),
    "race-day": PackSeed(
        pack="race-day",
        use="motion and challenge stage",
        runtime_group="race-day",
        assets=(
            AssetSeed("background", "sunny-racetrack", "stage background", "16:9 background concept", "friendly racetrack with soft curves, striped kerbs, cheering flags along the far side, and a clear flat center"),
            AssetSeed("character", "racer-fox", "helper/coach character", "transparent PNG sprite concept", "fox in a rounded helmet leaning on a small go-kart, thumbs up toward the player"),
            AssetSeed("character", "pit-crew-badger", "helper/coach character", "transparent PNG sprite concept", "badger in overalls holding an oversized wrench, mid-wave"),
            AssetSeed("reward", "checkered-badge", "positive feedback token", "square icon concept", "rounded checkered-flag badge with strong contrast and a clear silhouette"),
            AssetSeed("tile-set", "vehicle-set", "decorative puzzle tile variants", "sprite sheet concept", "six simple vehicle tiles — go-kart, bicycle, rocket car, tractor, sailboat, hot-air balloon — each distinct in outline"),
            AssetSeed("ui-frame", "pit-lane-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "rounded frame with subtle kerb striping and an empty readable center"),
        ),
    ),
    "winter-workshop": PackSeed(
        pack="winter-workshop",
        use="seasonal rotation — timely, not evergreen",
        runtime_group="winter-workshop",
        assets=(
            AssetSeed("background", "snowy-workshop", "stage background", "16:9 background concept", "warm wooden workshop interior with frosted windows, hanging lanterns, and an uncluttered center bench area"),
            AssetSeed("character", "mitten-mouse", "helper/coach character", "transparent PNG sprite concept", "small mouse in oversized knitted mittens and a scarf, holding a candy-striped pencil"),
            AssetSeed("character", "snow-fox", "helper/coach character", "transparent PNG sprite concept", "white fox with a woollen hat, sitting attentively with tail curled around its paws"),
            AssetSeed("reward", "snowflake-badge", "positive feedback token", "square icon concept", "six-point snowflake badge with a bold readable silhouette, not lacy or thin"),
            AssetSeed("sticker-sheet", "winter-stickers", "reward collection", "sprite sheet concept", "six winter reward stickers — mitten, cocoa, sled, pinecone, lantern, snowflake — flat and high contrast, no religious or holiday-specific symbols so the pack stays usable in any classroom"),
            AssetSeed("ui-frame", "frost-frame", "companion panel decoration", "transparent PNG UI frame concept", "rounded frame with soft frost edging and an empty readable content area"),
        ),
    ),
    "space-lab": PackSeed(
        pack="space-lab",
        use="early high-energy stage",
        runtime_group="space-lab",
        assets=(
            AssetSeed("background", "starfield", "stage background", "16:9 background concept", "deep blue space with soft stars, gentle nebula shapes, and a clear center area where puzzle pieces can sit"),
            AssetSeed("character", "astronaut-cat", "helper/coach character", "transparent PNG sprite concept", "friendly cat in a rounded space helmet, simple suit, one paw raised as if encouraging the player"),
            AssetSeed("character", "astronaut-dog", "helper/coach character", "transparent PNG sprite concept", "friendly dog in a rounded space helmet, simple suit, holding a small star token"),
            AssetSeed("reward", "comet-token", "positive feedback token", "square icon concept", "a smiling comet-like badge with soft glow and clear silhouette, suitable for a reward animation"),
            AssetSeed("ui-frame", "spaceship-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "rounded spaceship-console frame with soft blue and lime accents, leaving the center empty for game content"),
            AssetSeed("tile-set", "planet-set", "decorative puzzle tile variants", "sprite sheet concept", "six simple planet tiles with different colors and clear silhouettes, designed to remain readable at small sizes"),
        ),
    ),
    "pet-classroom": PackSeed(
        pack="pet-classroom",
        use="friendly default / younger students",
        runtime_group="pet-classroom",
        assets=(
            AssetSeed("background", "reading-rug-classroom", "stage background", "16:9 background concept", "cozy classroom corner with a reading rug, shelves, soft daylight, and a clear center play area"),
            AssetSeed("character", "cat-coach", "helper/coach character", "transparent PNG sprite concept", "friendly classroom cat holding a small pointer and smiling toward the player"),
            AssetSeed("character", "dog-coach", "helper/coach character", "transparent PNG sprite concept", "friendly classroom dog wearing a tiny backpack and offering a reward sticker"),
            AssetSeed("reward", "paw-badge", "positive feedback token", "square icon concept", "bright paw-shaped badge with simple shine and strong silhouette"),
            AssetSeed("sticker-sheet", "learning-stickers", "reward collection", "sprite sheet concept", "six classroom reward stickers: star, book, paw, pencil, light bulb, and trophy"),
            AssetSeed("ui-frame", "notebook-frame", "companion panel decoration", "transparent PNG UI frame concept", "rounded notebook-paper frame with playful tabs and empty readable content area"),
        ),
    ),
    "jungle-discovery": PackSeed(
        pack="jungle-discovery",
        use="exploration stage",
        runtime_group="jungle-discovery",
        assets=(
            AssetSeed("background", "canopy-path", "stage background", "16:9 background concept", "bright jungle canopy with sunlight, soft vines, and a clear puzzle play area"),
            AssetSeed("tile-set", "stone-puzzle-tiles", "decorative puzzle tile variants", "sprite sheet concept", "six rounded stone tiles with moss accents and readable silhouettes"),
            AssetSeed("reward", "leaf-token", "positive feedback token", "square icon concept", "green leaf badge with warm glow and simple progress-star center"),
            AssetSeed("character", "explorer-bird", "helper/coach character", "transparent PNG sprite concept", "friendly colorful bird with explorer satchel pointing toward the puzzle"),
            AssetSeed("character", "curious-monkey", "helper/coach character", "transparent PNG sprite concept", "friendly monkey holding a magnifying glass, playful but calm"),
            AssetSeed("ui-frame", "vine-progress-frame", "progress or stage frame", "transparent PNG UI frame concept", "soft vine frame with leaf accents and open center for UI content"),
        ),
    ),
    "ocean-reef": PackSeed(
        pack="ocean-reef",
        use="calm focus stage",
        runtime_group="ocean-reef",
        assets=(
            AssetSeed("background", "coral-reef", "stage background", "16:9 background concept", "calm reef scene with soft coral, bubbles, gentle light rays, and a clear center play area"),
            AssetSeed("ui-frame", "bubble-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "rounded bubble frame with aqua highlights and empty center"),
            AssetSeed("reward", "shell-token", "positive feedback token", "square icon concept", "friendly shell reward token with pearl glow and strong outline"),
            AssetSeed("character", "fish-guide", "helper/coach character", "transparent PNG sprite concept", "friendly fish guide with expressive eyes and a small explorer scarf"),
            AssetSeed("reward", "sea-star-badge", "positive feedback token", "square icon concept", "soft sea-star badge with happy expression and clear silhouette"),
            AssetSeed("tile-set", "reef-tiles", "decorative puzzle tile variants", "sprite sheet concept", "six reef-colored puzzle tiles with wave, shell, coral, and bubble motifs"),
        ),
    ),
    "crystal-cave": PackSeed(
        pack="crystal-cave",
        use="harder puzzle stage",
        runtime_group="crystal-cave",
        assets=(
            AssetSeed("background", "glowing-cave", "stage background", "16:9 background concept", "friendly crystal cave with teal and violet glow, no scary darkness, and clear center area"),
            AssetSeed("tile-set", "gem-tiles", "decorative puzzle tile variants", "sprite sheet concept", "six gem puzzle tiles with distinct shapes and high-contrast colors"),
            AssetSeed("reward", "crystal-token", "positive feedback token", "square icon concept", "glowing crystal badge with simple sparkle and strong outline"),
            AssetSeed("ui-frame", "torch-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "soft cave-torch frame with warm highlights and open center"),
            AssetSeed("effect", "sparkle-feedback", "positive feedback effect", "sprite sheet concept", "six small sparkle bursts for reward feedback, readable at small sizes"),
            AssetSeed("character", "cave-guide", "helper/coach character", "transparent PNG sprite concept", "friendly little explorer guide with lantern, cheerful and non-scary"),
        ),
    ),
    "desert-ruins": PackSeed(
        pack="desert-ruins",
        use="challenge / mastery stage",
        runtime_group="desert-ruins",
        assets=(
            AssetSeed("background", "sunlit-ruins", "stage background", "16:9 background concept", "sunlit desert ruins with warm sand, soft shadows, and clear puzzle play area"),
            AssetSeed("tile-set", "sandstone-tiles", "decorative puzzle tile variants", "sprite sheet concept", "six sandstone tiles with simple map and glyph-like geometric motifs, no readable text"),
            AssetSeed("reward", "map-fragment", "progress reward", "square icon concept", "map-fragment badge with bright edge highlight and clear silhouette"),
            AssetSeed("reward", "compass-token", "positive feedback token", "square icon concept", "friendly compass reward token with warm gold and teal accents"),
            AssetSeed("ui-frame", "archway-frame", "stage frame or companion panel decoration", "transparent PNG UI frame concept", "rounded ancient archway frame with empty center and playful soft edges"),
            AssetSeed("character", "desert-guide", "helper/coach character", "transparent PNG sprite concept", "friendly explorer lizard guide with tiny scarf and upbeat pose"),
        ),
    ),
}

PRODUCTION_MIX = [
    {
        "category": "cute animals/pets",
        "weight": 30,
        "why": "broadest appeal across ages and subjects",
        "examples": ["cats", "dogs", "baby animals", "friendly classroom pets"],
    },
    {
        "category": "fantasy/adventure",
        "weight": 15,
        "why": "strong imagination hook and marketing screenshots",
        "examples": ["dragons", "castles", "magical worlds", "quest maps"],
    },
    {
        "category": "space/science",
        "weight": 15,
        "why": "high wow-factor and clear STEM alignment",
        "examples": ["planets", "astronauts", "rockets", "space labs"],
    },
    {
        "category": "nature/scenery",
        "weight": 10,
        "why": "calm focus stages and subject flexibility",
        "examples": ["oceans", "forests", "waterfalls", "reef scenes"],
    },
    {
        "category": "sports/vehicles/action",
        "weight": 10,
        "why": "motion, challenge, and reward energy",
        "examples": ["basketball", "race cars", "skateboards", "stadiums"],
    },
    {
        "category": "bonus crossover pictures",
        "weight": 15,
        "why": "collectible unlocks that feel original",
        "examples": [
            "cat astronaut in space",
            "dog superhero flying over a city",
            "dragon playing basketball",
            "animals exploring an underwater castle",
            "robot teacher with animal students",
            "dinosaur driving a race car",
            "space-themed sports stadium",
            "fantasy creatures doing science experiments",
        ],
    },
    {
        "category": "seasonal/holiday packs",
        "weight": 5,
        "why": "timely but not evergreen enough to dominate production",
        "examples": ["winter lights", "fall leaves", "spring garden", "class celebration"],
    },
]

ORIGINAL_APPROXIMATE_MIX = [
    {
        "category": "cute animals/pets",
        "weight": 35,
        "examples": ["cats", "dogs", "baby animals"],
    },
    {
        "category": "fantasy/adventure",
        "weight": 20,
        "examples": ["dragons", "castles", "magical worlds"],
    },
    {
        "category": "space/science",
        "weight": 15,
        "examples": ["planets", "astronauts", "rockets"],
    },
    {
        "category": "nature/scenery",
        "weight": 15,
        "examples": ["oceans", "forests", "waterfalls"],
    },
    {
        "category": "sports/vehicles/action",
        "weight": 10,
        "examples": ["sports", "vehicles", "action scenes"],
    },
    {
        "category": "seasonal/holiday packs",
        "weight": 5,
        "examples": ["seasonal packs", "holiday packs"],
    },
]


def production_mix() -> list[dict]:
    """Business-prioritized picture mix.

    The weights are production guidance, not a hard runtime algorithm. The scout
    should favor the top categories when creating fresh packs, then use bonus
    crossovers as reward/unlock images.
    """
    return PRODUCTION_MIX


def prompt_for(pack: PackSeed, seed: AssetSeed) -> str:
    return (
        f"Create a {seed.deliverable} for a kid-friendly educational puzzle game. "
        f"Theme: {pack.pack}. Audience: elementary and middle-school learners. "
        "Style: warm, readable, high-contrast, playful but not babyish. "
        f"Composition: {seed.composition}. "
        "Constraints: no text in image, no copyrighted characters, no logos, "
        "no realistic child faces, no scary violence, no photoreal school children. "
        f"Deliverable: {seed.deliverable}."
    )


def manifest_for(pack_name: str) -> dict:
    pack = PACKS[pack_name]
    return {
        "pack": pack.pack,
        "lane": LANE,
        "status": "proposal",
        "style": STYLE,
        "runtimeGroup": pack.runtime_group,
        "use": pack.use,
        "notes": [
            "Prompts only. No generated files are committed here.",
            "Unity import path, dimensions, compression, and Addressables labels need Unity-lane approval.",
            "No copyrighted characters, logos, real children, or classroom PII.",
        ],
        "assets": [
            {
                "id": f"{pack.pack}.{seed.asset_type}.{seed.name}-01",
                "type": seed.asset_type,
                "targetUse": seed.target_use,
                "deliverable": seed.deliverable,
                "rights": "generated-clean",
                "needsUnityApproval": True,
                "prompt": prompt_for(pack, seed),
            }
            for seed in pack.assets
        ],
    }


def manifest_path(pack_name: str) -> Path:
    return ASSET_DIR / f"{pack_name}.manifest.json"


def write_manifest(pack_name: str, force: bool = False) -> Path:
    path = manifest_path(pack_name)
    if path.exists() and not force:
        raise FileExistsError(f"{path} already exists; pass --force to overwrite")
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest_for(pack_name), indent=2) + "\n")
    return path


def validate_manifest(path: Path) -> list[str]:
    problems: list[str] = []
    try:
        data = json.loads(path.read_text())
    except Exception as exc:
        return [f"{path}: invalid JSON: {exc}"]

    required_top = ["pack", "lane", "status", "runtimeGroup", "assets"]
    for key in required_top:
        if key not in data:
            problems.append(f"{path}: missing top-level {key}")
    assets = data.get("assets")
    if not isinstance(assets, list) or len(assets) < 6:
        problems.append(f"{path}: expected at least 6 assets")
        assets = assets if isinstance(assets, list) else []

    ids = set()
    for i, asset in enumerate(assets):
        if not isinstance(asset, dict):
            problems.append(f"{path}: asset {i} is not an object")
            continue
        for key in ["id", "type", "targetUse", "deliverable", "rights", "needsUnityApproval", "prompt"]:
            if key not in asset:
                problems.append(f"{path}: asset {i} missing {key}")
        asset_id = asset.get("id")
        if asset_id in ids:
            problems.append(f"{path}: duplicate asset id {asset_id}")
        ids.add(asset_id)
        prompt = str(asset.get("prompt", ""))
        if len(prompt) < 160:
            problems.append(f"{path}: {asset_id} prompt is too short")
        banned = ["copyrighted", "logo", "realistic child", "photoreal school"]
        if not all(word in prompt.lower() for word in banned):
            problems.append(f"{path}: {asset_id} prompt missing rights/safety constraints")
        if asset.get("rights") != "generated-clean":
            problems.append(f"{path}: {asset_id} rights must be generated-clean or documented separately")
        if asset.get("needsUnityApproval") is not True:
            problems.append(f"{path}: {asset_id} must require Unity approval")
    return problems


def validate_all() -> list[str]:
    paths = sorted(ASSET_DIR.glob("*.manifest.json"))
    if not paths:
        return [f"{ASSET_DIR}: no manifests found"]
    problems: list[str] = []
    for path in paths:
        problems.extend(validate_manifest(path))
    return problems


def gemini_packet(pack_names: list[str]) -> str:
    names = pack_names or list(PACKS)
    packs = [manifest_for(name) for name in names]
    return (
        "SAL0MANder asset scout task.\n\n"
        "Role: Gemini text scout. Do not edit Unity gameplay. Do not generate or commit image files. "
        "Return JSON manifests/prompts only.\n\n"
        "Goal: improve the SAL0MANder puzzle picture-content library with clean, reusable, "
        "kid-friendly prompts and rights notes.\n\n"
        "Rules:\n"
        "- prompts only; no final art files;\n"
        "- no copyrighted characters, logos, real children, classroom PII, or photoreal school children;\n"
        "- group by runtime pack/theme, not only by file type;\n"
        "- follow the production mix: cute animals first, then fantasy/space, with crossover bonus unlocks;\n"
        "- every asset needs Unity approval before import;\n"
        "- if blocked for 10 minutes, record SCOUT_UNREACHABLE and move on.\n\n"
        "Production mix:\n"
        f"{json.dumps(PRODUCTION_MIX, indent=2)}\n\n"
        "Original approximate mix, preserved as business-ranking provenance:\n"
        f"{json.dumps(ORIGINAL_APPROXIMATE_MIX, indent=2)}\n\n"
        "Seed manifests:\n"
        f"{json.dumps(packs, indent=2)}\n"
    )


def classify_gemini_output(exit_code: int | None, stdout: str, stderr: str, timed_out: bool) -> dict:
    if isinstance(stdout, bytes):
        stdout = stdout.decode(errors="replace")
    if isinstance(stderr, bytes):
        stderr = stderr.decode(errors="replace")
    text = f"{stdout}\n{stderr}".lower()
    if timed_out:
        status = "STARTED_BUT_STALLED"
        reason = "Gemini wrapper launched but did not return the exact ALIVE probe before the timeout."
    elif exit_code == 0 and stdout.strip() == "ALIVE":
        status = "AWAKE"
        reason = "Gemini returned the exact probe response."
    elif "not installed" in text or "command not found" in text:
        status = "MISSING"
        reason = "Gemini CLI is not installed or not reachable on PATH."
    elif "api key" in text or "authentication" in text or "not logged in" in text or "oauth" in text:
        status = "AUTH_BLOCKED"
        reason = "Gemini started but credentials are not reachable from the script environment."
    elif "quota" in text or "rate" in text or "429" in text or "exhausted" in text:
        status = "QUOTA_BLOCKED"
        reason = "Gemini credentials work, but the seat is out of quota."
    else:
        status = "UNKNOWN_UNRELIABLE"
        reason = "Gemini did not produce a clean alive signal."

    return {
        "status": status,
        "reason": reason,
        "exitCode": exit_code,
        "stdoutPreview": stdout.strip()[:500],
        "stderrPreview": stderr.strip()[:500],
        "timedOut": timed_out,
    }


def probe_gemini(timeout_seconds: int = 20) -> dict:
    if not GEMINI_WRAPPER.exists():
        return classify_gemini_output(127, "", f"{GEMINI_WRAPPER} missing", False)
    try:
        result = subprocess.run(
            ["bash", str(GEMINI_WRAPPER), "-p", "Reply with exactly: ALIVE"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        return classify_gemini_output(result.returncode, result.stdout, result.stderr, False)
    except subprocess.TimeoutExpired as exc:
        return classify_gemini_output(None, exc.stdout or "", exc.stderr or "", True)


def nudge_packet(pack_names: list[str], wake: dict | None = None) -> dict:
    wake = wake if wake is not None else probe_gemini()
    return {
        "schemaVersion": "sal0-asset-scout-nudge-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "target": "SAL0-06/SAL0-07 Gemini asset scout",
        "lane": LANE,
        "wake": wake,
        "ifAwake": "Return prompt-manifest JSON only. Do not edit Unity gameplay and do not commit image files.",
        "ifNotAwake": "Record SCOUT_UNREACHABLE and let SAL0-01 or SAL0-04 create the next manifest from the seed data.",
        "timeoutSeconds": 20,
        "packs": pack_names or list(PACKS),
        "productionMix": PRODUCTION_MIX,
        "originalApproximateMix": ORIGINAL_APPROXIMATE_MIX,
        "handoff": gemini_packet(pack_names),
    }


def write_nudge(pack_names: list[str], wake: dict | None = None) -> Path:
    OPS_DIR.mkdir(parents=True, exist_ok=True)
    packet = nudge_packet(pack_names, wake=wake)
    path = OPS_DIR / "GEMINI-ASSET-SCOUT-LATEST.json"
    path.write_text(json.dumps(packet, indent=2) + "\n")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Create and validate SAL0MANder asset-scout prompt manifests.")
    parser.add_argument("--list", action="store_true", help="list available packs")
    parser.add_argument("--write", choices=sorted(PACKS), help="write one manifest")
    parser.add_argument("--write-missing", action="store_true", help="write every missing manifest")
    parser.add_argument("--force", action="store_true", help="overwrite an existing manifest when used with --write")
    parser.add_argument("--validate", action="store_true", help="validate all manifests")
    parser.add_argument("--production-mix", action="store_true", help="print the business-prioritized picture mix")
    parser.add_argument("--original-mix", action="store_true", help="print the original approximate business ranking")
    parser.add_argument("--gemini-packet", nargs="*", choices=sorted(PACKS), help="print a Gemini handoff packet")
    parser.add_argument("--probe-gemini", action="store_true", help="probe whether Gemini is awake from the script lane")
    parser.add_argument("--nudge-gemini", nargs="*", choices=sorted(PACKS), help="write a Gemini asset-scout nudge packet")
    parser.add_argument("--json", action="store_true", help="machine-readable summary for --list/--validate")
    args = parser.parse_args()

    if args.list:
        payload = [{"pack": p.pack, "use": p.use, "assets": len(p.assets)} for p in PACKS.values()]
        print(json.dumps(payload, indent=2) if args.json else "\n".join(f"{p['pack']}: {p['use']} ({p['assets']} assets)" for p in payload))
        return 0

    if args.write:
        path = write_manifest(args.write, force=args.force)
        print(path)
        return 0

    if args.production_mix:
        print(json.dumps(PRODUCTION_MIX, indent=2) if args.json else "\n".join(
            f"{item['weight']:>2}% {item['category']} — {item['why']}"
            for item in PRODUCTION_MIX
        ))
        return 0

    if args.original_mix:
        print(json.dumps(ORIGINAL_APPROXIMATE_MIX, indent=2) if args.json else "\n".join(
            f"{item['weight']:>2}% {item['category']} — {', '.join(item['examples'])}"
            for item in ORIGINAL_APPROXIMATE_MIX
        ))
        return 0

    if args.write_missing:
        written = []
        for name in PACKS:
            path = manifest_path(name)
            if not path.exists():
                written.append(str(write_manifest(name)))
        print(json.dumps({"written": written}, indent=2))
        return 0

    if args.gemini_packet is not None:
        print(gemini_packet(args.gemini_packet))
        return 0

    if args.probe_gemini:
        wake = probe_gemini()
        print(json.dumps(wake, indent=2) if args.json else f"{wake['status']}: {wake['reason']}")
        return 0 if wake["status"] == "AWAKE" else 1

    if args.nudge_gemini is not None:
        wake = probe_gemini()
        path = write_nudge(args.nudge_gemini, wake=wake)
        payload = {"path": str(path), "wake": wake}
        print(json.dumps(payload, indent=2) if args.json else f"{path}: {wake['status']}")
        return 0 if wake["status"] == "AWAKE" else 1

    problems = validate_all()
    if args.json:
        print(json.dumps({"ok": not problems, "problems": problems}, indent=2))
    elif problems:
        print("ASSET SCOUT MANIFESTS NEED WORK")
        for problem in problems:
            print(f"- {problem}")
    else:
        print("asset scout manifests OK")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
