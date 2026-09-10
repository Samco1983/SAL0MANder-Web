/**
 * The pictures a student uncovers, as the home page shows them.
 *
 * ## Why this is a module and not markup
 *
 * Alt text is the part that gets skipped when images are typed straight into a
 * page, and here it does double duty: it is what a screen-reader user gets
 * instead of the picture, and it is most of what a web filter's classifier can
 * read on a JavaScript-rendered page. `sal0mander.com` is blocked by at least
 * one district as "categorized as Unknown", so ten sentences describing coral
 * reefs, castles and astrophotography are a stronger Education signal than the
 * images themselves.
 *
 * Keeping it in one array means a test can hold every entry to the same rule:
 * a real file, a same-origin path, and a description of the actual scene.
 *
 * ## Two images from the generated set are deliberately absent
 *
 * `panther_chameleon_rainforest` and `robot_alien_crystals` have jigsaw cut
 * lines painted into the pixels — a few hundred fake pieces baked into the
 * artwork. SAL0MANder's activities are nine pieces and Unity draws its own
 * edges, so those two would show a student one puzzle inside another and
 * promise a piece count the product does not have. They are good images and
 * the wrong images.
 *
 * ## What these are NOT
 *
 * Not tied to any activity. Unity owns which picture an activity uses, through
 * `imagePresetIndex` in `CreateDemoActivity`, so captioning one of these as
 * "the Integer Operations puzzle" would be a claim this repository cannot
 * check and would quietly go stale the moment a preset changed. They are shown
 * as what they are: a sample of the library.
 */
export const PUZZLE_PICTURE_CATEGORIES = [
  'Animals',
  'Fantasy',
  'Nature',
  'Places',
  'Space',
  'Vehicles',
] as const
export type PuzzlePictureCategory = (typeof PUZZLE_PICTURE_CATEGORIES)[number]

export type PuzzlePicture = {
  /**
   * Stable identifier, and what should be sent to Unity instead of an array
   * position.
   *
   * `ActivityData.imagePresetIndex` is positional — `0=Dog, 1=Cat, 2=Lotus`.
   * Reordering that array silently repoints every existing activity at a
   * different picture: no error, no warning, and a teacher discovers it when a
   * class opens the wrong puzzle. A key survives reordering, and an unknown key
   * can fail loudly instead.
   */
  readonly key: string
  /** Which board this fits. Unity's `BoardShape` has exactly three. */
  readonly shape: 'Square' | 'Portrait' | 'Landscape'
  /** Shown to the teacher in the picker. */
  readonly name: string
  /** A small, shared set of themes for browsing the library. */
  readonly category: PuzzlePictureCategory
  /** Same-origin path under `public/`. An external host would be one more domain a district has to allow. */
  readonly src: string
  /** Describes the scene. Never "puzzle image" — see the module note. */
  readonly alt: string
  /** Rendered aspect, so the grid can reserve space and not shift as images load. */
  readonly width: number
  readonly height: number
}

/**
 * A mix of fantasy, realistic wildlife, and educational scenes across Unity's
 * three board shapes. Full-quality masters stay separate from these compact
 * website previews; generated wildlife is identified in its description.
 */
export const PUZZLE_LIBRARY: readonly PuzzlePicture[] = [
  {
    key: 'salamander-forest',
    shape: 'Square',
    name: 'Forest guardian',
    category: 'Fantasy',
    src: '/images/library/square/fantasy/salamander_forest.webp',
    alt: 'Fantasy illustration of a bright-eyed black salamander with lime markings and small fins, perched on a mossy log beside glowing mushrooms and a forest waterfall.',
    width: 480,
    height: 480,
  },
  {
    key: 'red-panda',
    shape: 'Square',
    name: 'Red panda forest',
    category: 'Animals',
    src: '/images/library/square/wildlife/red_panda_forest.webp',
    alt: 'Realistic generated wildlife illustration of a red panda with russet fur and a long ringed tail resting on a mossy tree above a mountain forest.',
    width: 480,
    height: 480,
  },
  {
    key: 'snow-leopard',
    shape: 'Square',
    name: 'Snow leopard mountains',
    category: 'Animals',
    src: '/images/library/square/wildlife/snow_leopard_mountains.webp',
    alt: 'Realistic generated wildlife illustration of a young snow leopard with silver spotted fur and a thick curling tail on a rocky ledge in sunlit snowy mountains.',
    width: 480,
    height: 480,
  },
  {
    key: 'coral-reef',
    shape: 'Square',
    name: 'Coral reef',
    category: 'Animals',
    src: '/images/library/square/cartoon/coral_reef_marine_life.webp',
    alt: 'Illustration of a coral reef crowded with sea life — a green sea turtle, an octopus, clownfish in an anemone, a moray eel and a crab among branching corals and sponges.',
    width: 640,
    height: 640,
  },
  {
    key: 'colosseum',
    shape: 'Square',
    name: 'The Colosseum',
    category: 'Places',
    src: '/images/library/square/photo/colosseum_rome_aerial.webp',
    alt: 'Aerial photograph of the Roman Colosseum at golden hour, with the Arch of Constantine and the surrounding streets and rooftops of Rome.',
    width: 640,
    height: 640,
  },
  {
    key: 'bakery',
    shape: 'Landscape',
    name: 'Mouse bakery',
    category: 'Fantasy',
    src: '/images/library/landscape/cartoon/magical_bakery_workshop.webp',
    alt: 'Illustration of three mice in aprons baking in a stone-walled bakery, with a wood-fired oven, shelves of breads, tarts and iced cakes, and jars of preserves.',
    width: 640,
    height: 478,
  },
  {
    key: 'saturn',
    shape: 'Landscape',
    name: 'Saturn and nebula',
    category: 'Space',
    src: '/images/library/landscape/photo/saturn_nebula_astrophotography.webp',
    alt: 'Space scene showing Saturn and its rings against a starfield, with spiral galaxies and pink and blue nebula clouds.',
    width: 640,
    height: 478,
  },
  {
    key: 'dragon-castle',
    shape: 'Portrait',
    name: 'Dragon castle',
    category: 'Fantasy',
    src: '/images/library/portrait/cartoon/floating_island_castle_dragon.webp',
    alt: 'Illustration of a fairy-tale castle on a floating island, a green dragon perched on one tower, hot-air balloons and waterfalls spilling into the clouds below.',
    width: 640,
    height: 857,
  },
  {
    key: 'highland-castle',
    shape: 'Portrait',
    name: 'Highland castle',
    category: 'Places',
    src: '/images/library/portrait/photo/scottish_highland_stone_fortress.webp',
    alt: 'Photograph of a stone castle on a Scottish loch at sunset, reached by an arched bridge, with heather in the foreground and mountains behind.',
    width: 640,
    height: 857,
  },
  {
    key: 'autumn-woodland',
    shape: 'Landscape',
    name: 'Autumn woodland village',
    category: 'Fantasy',
    src: '/images/library/custom-wide/cartoon/enchanted_autumn_woodland.webp',
    alt: 'Illustration of glowing mushroom cottages beside a winding stream, with wooden bridges, foxes, hedgehogs and owls beneath golden autumn trees.',
    width: 640,
    height: 429,
  },
  {
    key: 'dinosaur-valley',
    shape: 'Landscape',
    name: 'Dinosaur valley',
    category: 'Animals',
    src: '/images/library/custom-wide/cartoon/dinosaur_jurassic_valley.webp',
    alt: 'Illustration of long-necked and horned dinosaurs beside a tropical river, with a waterfall, flying pterosaur and smoking volcano under a peach-colored sky.',
    width: 640,
    height: 357,
  },
  {
    key: 'alpine-lake',
    shape: 'Landscape',
    name: 'Alpine lake and wildflowers',
    category: 'Nature',
    src: '/images/library/custom-wide/photo/alpine_lake_wildflowers.webp',
    alt: 'Realistic generated landscape of a turquoise alpine lake reflecting snowy mountains, with a wooden dock, evergreen trees and red, yellow and purple wildflowers.',
    width: 640,
    height: 429,
  },
  {
    key: 'rainforest-macaws',
    shape: 'Landscape',
    name: 'Rainforest macaws',
    category: 'Animals',
    src: '/images/library/custom-wide/photo/amazon_rainforest_macaws.webp',
    alt: 'Realistic generated wildlife scene with scarlet macaws and black toucans among orchids and broad green leaves, overlooking a rainforest river at sunrise.',
    width: 640,
    height: 357,
  },
  {
    key: 'steampunk-airship',
    shape: 'Portrait',
    name: 'Sunset airship',
    category: 'Vehicles',
    src: '/images/library/custom-tall/cartoon/steampunk_flying_airship.webp',
    alt: 'Illustration of an ornate brass and wooden airship with balloons, propellers, glowing windows and blue engines, surrounded by mechanical birds in sunset clouds.',
    width: 640,
    height: 954,
  },
  {
    key: 'mountain-steam-train',
    shape: 'Portrait',
    name: 'Mountain steam train',
    category: 'Vehicles',
    src: '/images/library/custom-tall/photo/steam_locomotive_mountain_viaduct.webp',
    alt: 'Realistic generated landscape of a black steam locomotive and red passenger carriages crossing a curved stone viaduct, with autumn trees, mountains and a waterfall.',
    width: 640,
    height: 954,
  },
] as const
