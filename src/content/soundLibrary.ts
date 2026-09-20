/** Original game cues and source-credited recordings. Loaded only on demand. */
export type SoundDefinition = {
  readonly key: string
  readonly name: string
  readonly category: string
  readonly src: string
  readonly durationSeconds: number
  readonly previewSeconds?: number
  readonly credit?: {
    readonly author: string
    readonly source: string
    readonly license: string
    readonly licenseUrl: string
  }
}

export const SOUND_LIBRARY: readonly SoundDefinition[] = [
  {
    key: 'victory_warm_magic',
    name: 'Victory Warm Magic',
    category: 'victory',
    src: '/audio/rpg/victory/victory_warm_magic.wav',
    durationSeconds: 4.4,
  },
  {
    key: 'victory_crystal_crown',
    name: 'Victory Crystal Crown',
    category: 'victory',
    src: '/audio/rpg/victory/victory_crystal_crown.wav',
    durationSeconds: 3.2,
  },
  {
    key: 'victory_heroic_sunrise',
    name: 'Victory Heroic Sunrise',
    category: 'victory',
    src: '/audio/rpg/victory/victory_heroic_sunrise.wav',
    durationSeconds: 4.8,
  },
  {
    key: 'victory_quiet_wonder',
    name: 'Victory Quiet Wonder',
    category: 'victory',
    src: '/audio/rpg/victory/victory_quiet_wonder.wav',
    durationSeconds: 3.6,
  },
  {
    key: 'heart_bloom',
    name: 'Heart Bloom',
    category: 'heart-burst',
    src: '/audio/rpg/heart-burst/heart_bloom.wav',
    durationSeconds: 2.2,
  },
  {
    key: 'heart_confetti',
    name: 'Heart Confetti',
    category: 'heart-burst',
    src: '/audio/rpg/heart-burst/heart_confetti.wav',
    durationSeconds: 1.4,
  },
  {
    key: 'heart_warm_hug',
    name: 'Heart Warm Hug',
    category: 'heart-burst',
    src: '/audio/rpg/heart-burst/heart_warm_hug.wav',
    durationSeconds: 1.9,
  },
  {
    key: 'magic_reveal_tile',
    name: 'Magic Reveal Tile',
    category: 'magic-reveal',
    src: '/audio/rpg/magic-reveal/magic_reveal_tile.wav',
    durationSeconds: 0.95,
  },
  {
    key: 'magic_reveal_ripple',
    name: 'Magic Reveal Ripple',
    category: 'magic-reveal',
    src: '/audio/rpg/magic-reveal/magic_reveal_ripple.wav',
    durationSeconds: 1.8,
  },
  {
    key: 'magic_stardust_shower',
    name: 'Magic Stardust Shower',
    category: 'magic-reveal',
    src: '/audio/rpg/magic-reveal/magic_stardust_shower.wav',
    durationSeconds: 2.4,
  },
  {
    key: 'magic_portal_bloom',
    name: 'Magic Portal Bloom',
    category: 'magic-reveal',
    src: '/audio/rpg/magic-reveal/magic_portal_bloom.wav',
    durationSeconds: 2.7,
  },
  {
    key: 'gift_box_pop',
    name: 'Gift Box Pop',
    category: 'gift-open',
    src: '/audio/rpg/gift-open/gift_box_pop.wav',
    durationSeconds: 1.5,
  },
  {
    key: 'gift_envelope_unfold',
    name: 'Gift Envelope Unfold',
    category: 'gift-open',
    src: '/audio/rpg/gift-open/gift_envelope_unfold.wav',
    durationSeconds: 1.25,
  },
  {
    key: 'gift_ribbon_unwind',
    name: 'Gift Ribbon Unwind',
    category: 'gift-open',
    src: '/audio/rpg/gift-open/gift_ribbon_unwind.wav',
    durationSeconds: 1.8,
  },
  {
    key: 'correct_bright_pick',
    name: 'Correct Bright Pick',
    category: 'correct-answer',
    src: '/audio/rpg/correct-answer/correct_bright_pick.wav',
    durationSeconds: 0.68,
  },
  {
    key: 'correct_small_discovery',
    name: 'Correct Small Discovery',
    category: 'correct-answer',
    src: '/audio/rpg/correct-answer/correct_small_discovery.wav',
    durationSeconds: 1.15,
  },
  {
    key: 'correct_combo_flourish',
    name: 'Correct Combo Flourish',
    category: 'correct-answer',
    src: '/audio/rpg/correct-answer/correct_combo_flourish.wav',
    durationSeconds: 1,
  },
  {
    key: 'correct_gentle_yes',
    name: 'Correct Gentle Yes',
    category: 'correct-answer',
    src: '/audio/rpg/correct-answer/correct_gentle_yes.wav',
    durationSeconds: 0.7,
  },
  {
    key: 'piece_soft_snap',
    name: 'Piece Soft Snap',
    category: 'piece-place',
    src: '/audio/rpg/piece-place/piece_soft_snap.wav',
    durationSeconds: 0.38,
  },
  {
    key: 'piece_rotate_tick',
    name: 'Piece Rotate Tick',
    category: 'piece-place',
    src: '/audio/rpg/piece-place/piece_rotate_tick.wav',
    durationSeconds: 0.36,
  },
  {
    key: 'piece_cluster_settle',
    name: 'Piece Cluster Settle',
    category: 'piece-place',
    src: '/audio/rpg/piece-place/piece_cluster_settle.wav',
    durationSeconds: 0.88,
  },
  {
    key: 'piece_lock_chime',
    name: 'Piece Lock Chime',
    category: 'piece-place',
    src: '/audio/rpg/piece-place/piece_lock_chime.wav',
    durationSeconds: 0.6,
  },
  {
    key: 'ui_hover_glint',
    name: 'Ui Hover Glint',
    category: 'UI',
    src: '/audio/rpg/UI/ui_hover_glint.wav',
    durationSeconds: 0.2,
  },
  {
    key: 'ui_select_crystal',
    name: 'Ui Select Crystal',
    category: 'UI',
    src: '/audio/rpg/UI/ui_select_crystal.wav',
    durationSeconds: 0.34,
  },
  {
    key: 'ui_back_step',
    name: 'Ui Back Step',
    category: 'UI',
    src: '/audio/rpg/UI/ui_back_step.wav',
    durationSeconds: 0.43,
  },
  {
    key: 'ui_open_panel',
    name: 'Ui Open Panel',
    category: 'UI',
    src: '/audio/rpg/UI/ui_open_panel.wav',
    durationSeconds: 0.72,
  },
  {
    key: 'ui_close_panel',
    name: 'Ui Close Panel',
    category: 'UI',
    src: '/audio/rpg/UI/ui_close_panel.wav',
    durationSeconds: 0.62,
  },
  {
    key: 'ui_retry_hint',
    name: 'Ui Retry Hint',
    category: 'UI',
    src: '/audio/rpg/UI/ui_retry_hint.wav',
    durationSeconds: 0.82,
  },
  {
    key: 'dog-bark',
    name: 'Dog Bark',
    category: 'animals',
    src: '/audio/nature/dog-bark.mp3',
    durationSeconds: 0.389,
    previewSeconds: 0.389,
    credit: {
      author: 'kwahmah_02',
      source: 'https://freesound.org/people/kwahmah_02/sounds/277058/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'cat-meow',
    name: 'Cat Meow',
    category: 'animals',
    src: '/audio/nature/cat-meow.mp3',
    durationSeconds: 1.655,
    previewSeconds: 1.655,
    credit: {
      author: 'Countrygirls13',
      source: 'https://freesound.org/people/Countrygirls13/sounds/763906/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'tiger-roar',
    name: 'Tiger Roar',
    category: 'animals',
    src: '/audio/nature/tiger-roar.mp3',
    durationSeconds: 11.3546,
    previewSeconds: 8,
    credit: {
      author: 'lauramellis',
      source: 'https://freesound.org/people/lauramellis/sounds/263115/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'lion-roar',
    name: 'Lion Roar',
    category: 'animals',
    src: '/audio/nature/lion-roar.mp3',
    durationSeconds: 36.0892,
    previewSeconds: 8,
    credit: {
      author: 'Bidone',
      source: 'https://freesound.org/people/Bidone/sounds/69572/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'elephant',
    name: 'Elephant',
    category: 'animals',
    src: '/audio/nature/elephant.mp3',
    durationSeconds: 7.8,
    previewSeconds: 7.8,
    credit: {
      author: 'ikbenraar',
      source: 'https://freesound.org/people/ikbenraar/sounds/819668/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'ocean-waves',
    name: 'Ocean Waves',
    category: 'nature',
    src: '/audio/nature/ocean-waves.mp3',
    durationSeconds: 47.4731,
    previewSeconds: 12,
    credit: {
      author: 'jackmichaelking',
      source: 'https://freesound.org/people/jackmichaelking/sounds/518669/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'mountain-wind-bird',
    name: 'Mountain Wind Bird',
    category: 'nature',
    src: '/audio/nature/mountain-wind-bird.mp3',
    durationSeconds: 14.5145,
    previewSeconds: 8,
    credit: {
      author: 'ciccarelli',
      source: 'https://freesound.org/people/ciccarelli/sounds/135447/',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  },
  {
    key: 'streamside_discovery',
    name: 'Streamside Discovery',
    category: 'victory',
    src: '/audio/rpg/victory/streamside_discovery.wav',
    durationSeconds: 18,
    previewSeconds: 12,
  },
]

const PICTURE_SOUNDS: Readonly<Record<string, string>> = {
  'art-pug': 'dog-bark',
  'art-dachshund': 'dog-bark',
  'puggle-puppy': 'dog-bark',
  'sleeping-puppies': 'dog-bark',
  'photo-golden-dog': 'dog-bark',
  'art-ginger-tabby': 'cat-meow',
  'art-tuxedo-cat': 'cat-meow',
  'photo-cat-laptop-yawn': 'cat-meow',
  'art-tiger': 'tiger-roar',
  'photo-tiger-looking': 'tiger-roar',
  'art-lion': 'lion-roar',
  'photo-lion-cub': 'lion-roar',
  'art-elephant': 'elephant',
  'art-tropical-beach': 'ocean-waves',
  'photo-tropical-beach': 'ocean-waves',
  'art-mountain-lake': 'mountain-wind-bird',
  'photo-mountain-lake-dusk': 'mountain-wind-bird',
  'alpine-lake': 'mountain-wind-bird',
}

export function getPictureSound(imageKey: string): SoundDefinition | undefined {
  const key = PICTURE_SOUNDS[imageKey]
  return key ? SOUND_LIBRARY.find((sound) => sound.key === key) : undefined
}
