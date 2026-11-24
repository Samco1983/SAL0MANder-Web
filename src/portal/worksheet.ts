import type { BeltColor } from './types'

export type WorksheetQuestion = {
  id: string
  prompt: string
  answer: number
  hint: string
}

export type QuestionSet = {
  activityId: string
  activityVersionId: string
  unitId: string
  title: string
  openResponsePrompt: string
  questions: ReadonlyArray<WorksheetQuestion>
}

export const GRADE7_UNITS = [
  'Unit 1: Ratios & Proportions',
  'Unit 2: Integers & Rational Numbers',
  'Unit 3: Expressions',
  'Unit 4: Equations & Inequalities',
  'Unit 5: Geometry',
  'Unit 6: Statistics',
  'Unit 7: Probability',
] as const

export const BELT_MASCOT: Record<BeltColor, { label: string; gear: string; badgeText: string }> = {
  white: { label: 'White Belt', gear: 'Hatchling salamander', badgeText: 'SAL · Hatchling' },
  yellow: { label: 'Yellow Belt', gear: 'Goggles salamander', badgeText: 'SAL · Goggles' },
  green: { label: 'Green Belt', gear: 'Expedition pack salamander', badgeText: 'SAL · Expedition' },
  purple: { label: 'Purple Belt', gear: 'Crystal power salamander', badgeText: 'SAL · Crystal' },
  black: { label: 'Black Belt', gear: 'Spaceship salamander', badgeText: 'SAL · Spaceship' },
}

/** Shared question-set format (10 questions, local checking + teacher hint per wrong answer). */
export const INTEGER_OPERATIONS_SET: QuestionSet = {
  activityId: 'act_integer_operations',
  activityVersionId: 'ver_int_ops_v1',
  unitId: 'g7_u2_integers',
  title: 'Integer Operations (Unit 2)',
  openResponsePrompt: 'Explain in your own words how you solved #2 (3 - (-5)) and how you checked the sign.',
  questions: [
    { id: 'q1', prompt: '-7 + 12 = ?', answer: 5, hint: 'Start at -7 on the number line and move 12 steps right.' },
    { id: 'q2', prompt: '3 - (-5) = ?', answer: 8, hint: 'Subtracting a negative moves right — rewrite 3 - (-5) as 3 + 5.' },
    { id: 'q3', prompt: '-4 - 9 = ?', answer: -13, hint: 'Start at -4 and move 9 steps farther left into the negatives.' },
    { id: 'q4', prompt: '-6 × 3 = ?', answer: -18, hint: 'One negative times one positive gives a negative product.' },
    { id: 'q5', prompt: '-8 × (-4) = ?', answer: 32, hint: 'A negative times a negative gives a positive product.' },
    { id: 'q6', prompt: '24 ÷ (-6) = ?', answer: -4, hint: 'Divide 24 by 6 first, then apply the sign rule: positive ÷ negative is negative.' },
    { id: 'q7', prompt: '-36 ÷ (-9) = ?', answer: 4, hint: 'Negative divided by negative is positive — how many 9s make 36?' },
    { id: 'q8', prompt: '-15 + (-7) = ?', answer: -22, hint: 'Adding two negatives combines their distances below zero.' },
    { id: 'q9', prompt: '5 - 14 = ?', answer: -9, hint: 'Moving 14 steps left from 5 crosses zero — how far past 0 do you land?' },
    { id: 'q10', prompt: '(-2) × 5 + 3 = ?', answer: -7, hint: 'Multiply (-2) × 5 first to get -10, then move 3 steps right.' },
  ],
}

export function checkNumericAnswer(rawInput: string, expected: number): boolean {
  const trimmed = rawInput.trim()
  if (!/^[+-]?\d+$/.test(trimmed)) return false
  return Number(trimmed) === expected
}

export function nextUnitName(stripesEarned: number): string {
  return GRADE7_UNITS[Math.min(stripesEarned, GRADE7_UNITS.length - 1)] ?? GRADE7_UNITS[0]
}
