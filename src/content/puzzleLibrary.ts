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
export type PuzzlePicture = {
  /** Same-origin path under `public/`. An external host would be one more domain a district has to allow. */
  readonly src: string
  /** Describes the scene. Never "puzzle image" — see the module note. */
  readonly alt: string
  /** Rendered aspect, so the grid can reserve space and not shift as images load. */
  readonly width: number
  readonly height: number
}

/**
 * Six pictures: Unity's three board shapes, each as one illustration and one
 * photograph.
 *
 * The 50/50 split is the point. A teacher deciding in four seconds should not
 * have to guess whether this is only for younger students, and the pairing
 * answers that faster than a sentence about age range would.
 */
export const PUZZLE_LIBRARY: readonly PuzzlePicture[] = [
  {
    src: '/images/library/square/cartoon/coral_reef_marine_life.webp',
    alt: 'Illustration of a coral reef crowded with sea life — a green sea turtle, an octopus, clownfish in an anemone, a moray eel and a crab among branching corals and sponges.',
    width: 640,
    height: 640,
  },
  {
    src: '/images/library/square/photo/colosseum_rome_aerial.webp',
    alt: 'Aerial photograph of the Roman Colosseum at golden hour, with the Arch of Constantine and the surrounding streets and rooftops of Rome.',
    width: 640,
    height: 640,
  },
  {
    src: '/images/library/landscape/cartoon/magical_bakery_workshop.webp',
    alt: 'Illustration of three mice in aprons baking in a stone-walled bakery, with a wood-fired oven, shelves of breads, tarts and iced cakes, and jars of preserves.',
    width: 640,
    height: 478,
  },
  {
    src: '/images/library/landscape/photo/saturn_nebula_astrophotography.webp',
    alt: 'Space scene showing Saturn and its rings against a starfield, with spiral galaxies and pink and blue nebula clouds.',
    width: 640,
    height: 478,
  },
  {
    src: '/images/library/portrait/cartoon/floating_island_castle_dragon.webp',
    alt: 'Illustration of a fairy-tale castle on a floating island, a green dragon perched on one tower, hot-air balloons and waterfalls spilling into the clouds below.',
    width: 640,
    height: 857,
  },
  {
    src: '/images/library/portrait/photo/scottish_highland_stone_fortress.webp',
    alt: 'Photograph of a stone castle on a Scottish loch at sunset, reached by an arched bridge, with heather in the foreground and mountains behind.',
    width: 640,
    height: 857,
  },
] as const
