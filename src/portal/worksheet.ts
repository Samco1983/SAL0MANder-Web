import { GRADE7_CURRICULUM, checkCurriculumAnswer, getDefaultCurriculumSet, type LoadedPracticeSet } from './curriculum'
import type { BeltColor } from './types'

export type QuestionSet = LoadedPracticeSet

export const GRADE7_UNITS: ReadonlyArray<string> = GRADE7_CURRICULUM.map(
  (unit, idx) => `Unit ${idx + 1}: ${unit.unitName}`,
)

export const BELT_MASCOT: Record<BeltColor, { label: string; gear: string; badgeText: string }> = {
  white: { label: 'White Belt', gear: 'Hatchling salamander', badgeText: 'SAL · Hatchling' },
  yellow: { label: 'Yellow Belt', gear: 'Goggles salamander', badgeText: 'SAL · Goggles' },
  green: { label: 'Green Belt', gear: 'Expedition pack salamander', badgeText: 'SAL · Expedition' },
  purple: { label: 'Purple Belt', gear: 'Crystal power salamander', badgeText: 'SAL · Crystal' },
  black: { label: 'Black Belt', gear: 'Spaceship salamander', badgeText: 'SAL · Spaceship' },
}

export const DEFAULT_PRACTICE_SET: LoadedPracticeSet = getDefaultCurriculumSet()

export { checkCurriculumAnswer }

export function nextUnitName(stripesEarned: number): string {
  return GRADE7_UNITS[Math.min(stripesEarned, GRADE7_UNITS.length - 1)] ?? GRADE7_UNITS[0] ?? 'Unit 1'
}
