/** Version 1 is immutable: shared gifts refer to these IDs, never editable text. */
export const GIFT_CATALOG_VERSION = 1 as const
export const GIFT_MODES = [
  {
    id: 'learning',
    name: 'Learning Puzzle',
    description: 'Answer a question, then place the piece you earn.',
  },
  {
    id: 'mystery',
    name: 'Mystery Reveal',
    description: 'Each right answer reveals another piece for you.',
  },
  {
    id: 'classic',
    name: 'Classic Jigsaw',
    description: 'All pieces are ready. Put the picture together without questions.',
  },
  {
    id: 'sliding',
    name: 'Slide & Solve',
    description: 'Slide rows and columns around a 3 × 3 grid to restore the picture. No questions.',
  },
] as const

export const GIFT_TEMPLATES = [
  {
    id: 'color',
    label: 'Favorite color',
    prompt: 'Which of these colors is my favorite?',
    choices: [
      { id: 'blue', text: 'Blue' },
      { id: 'green', text: 'Green' },
      { id: 'purple', text: 'Purple' },
      { id: 'red', text: 'Red' },
    ],
  },
  {
    id: 'season',
    label: 'Favorite season',
    prompt: 'Which season is my favorite?',
    choices: [
      { id: 'spring', text: 'Spring' },
      { id: 'summer', text: 'Summer' },
      { id: 'autumn', text: 'Autumn' },
      { id: 'winter', text: 'Winter' },
    ],
  },
  {
    id: 'animal',
    label: 'Favorite animal',
    prompt: 'Which of these animals is my favorite?',
    choices: [
      { id: 'dog', text: 'Dog' },
      { id: 'cat', text: 'Cat' },
      { id: 'panda', text: 'Panda' },
      { id: 'dolphin', text: 'Dolphin' },
    ],
  },
  {
    id: 'ice-cream',
    label: 'Favorite ice cream',
    prompt: 'Which of these ice cream flavors is my favorite?',
    choices: [
      { id: 'chocolate', text: 'Chocolate' },
      { id: 'vanilla', text: 'Vanilla' },
      { id: 'strawberry', text: 'Strawberry' },
      { id: 'mint-chip', text: 'Mint chocolate chip' },
    ],
  },
  {
    id: 'movie',
    label: 'Favorite movie',
    prompt: 'Which of these movies is my favorite?',
    choices: [
      { id: 'toy-story', text: 'Toy Story' },
      { id: 'frozen', text: 'Frozen' },
      { id: 'lion-king', text: 'The Lion King' },
      { id: 'moana', text: 'Moana' },
    ],
  },
  {
    id: 'activity',
    label: 'Favorite outdoor activity',
    prompt: 'Which of these outdoor activities is my favorite?',
    choices: [
      { id: 'walking', text: 'Walking' },
      { id: 'cycling', text: 'Cycling' },
      { id: 'swimming', text: 'Swimming' },
      { id: 'camping', text: 'Camping' },
    ],
  },
] as const

export function giftTemplate(id: string) {
  return GIFT_TEMPLATES.find((template) => template.id === id)
}
