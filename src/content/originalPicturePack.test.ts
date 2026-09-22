import { describe, expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from './puzzleLibrary'

const cars = [
  'fictional-neon-tuner-v1',
  'fictional-sunset-muscle-v1',
  'fictional-silver-supercar-v1',
  'fictional-canyon-racer-side-v1',
  'fictional-midnight-gt-v1',
  'fictional-snow-rally-v1',
  'fictional-canyon-racer-v1',
  'fictional-coastal-racer-v1',
]
const pets = [
  'ai-pug-playtime-v1',
  'ai-dachshund-garden-v1',
  'ai-kitten-mischief-v1',
  'ai-golden-retriever-orchard-v1',
  'ai-french-bulldog-box-v1',
  'ai-corgi-beach-v1',
  'ai-beagle-porch-v1',
  'ai-german-shepherd-meadow-v1',
  'ai-husky-snow-v1',
  'ai-poodle-garden-v1',
  'ai-jack-russell-planter-v1',
  'ai-maine-coon-window-v1',
  'ai-ragdoll-quilt-v1',
  'ai-siamese-linens-v1',
  'ai-british-shorthair-rug-v1',
  'ai-bengal-garden-v1',
  'ai-tuxedo-chair-v1',
  'ai-calico-drawer-v1',
  'ai-fluffy-white-kitten-v1',
  'ai-abyssinian-stretch-v1',
  'ai-lion-savanna-v1',
  'ai-elephant-family-v1',
  'ai-tiger-river-v1',
  'ai-giant-panda-bamboo-v1',
  'ai-red-panda-branch-v1',
  'ai-bear-cub-creek-v1',
]

describe('original car, pet and wildlife picture pack', () => {
  it('contains eight cars and twenty-six animals', () => {
    expect(cars).toHaveLength(8)
    expect(pets).toHaveLength(26)
  })

  it.each([...cars, ...pets])(
    'makes %s available with a stable key and honest attribution',
    (key) => {
      const entries = PUZZLE_LIBRARY.filter((entry) => entry.key === key)
      expect(entries).toHaveLength(1)
      const picture = entries[0]!
      expect(picture.src).toBe(`/images/library/ai/${key}.webp`)
      expect(picture.name).toContain('AI artwork')
      expect(picture.alt).toMatch(/^AI-generated /)
      expect(picture.photoCredit).toBeUndefined()
      expect(picture.artworkCredit).toEqual({
        creator: 'SAL0MANder',
        generation: 'AI-generated',
        modifications: 'Resized; WebP format',
      })
      expect(picture.category).toBe(cars.includes(key) ? 'Vehicles' : 'Animals')
      expect(picture.shape).toBe(cars.includes(key) ? 'Landscape' : 'Square')
      expect(picture.width).toBe(1024)
      expect(picture.height).toBe(cars.includes(key) ? 683 : 1024)
    },
  )

  it('adds choices without repointing old shared gift image keys', () => {
    expect(PUZZLE_LIBRARY[0]!.key).toBe('salamander-forest')
    for (const key of [
      'puggle-puppy',
      'sleeping-puppies',
      'orange-indy-race-car',
      'red-indy-race-car',
    ]) {
      const picture = PUZZLE_LIBRARY.find((entry) => entry.key === key)!
      expect(picture.src).toBe(`/images/library/photos/${key}.webp`)
      expect(picture.photoCredit).toBeDefined()
      expect(picture.artworkCredit).toBeUndefined()
    }
  })
})
