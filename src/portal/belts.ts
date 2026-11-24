import { can, type PortalActor } from './access'
import { PortalAccessError, type PortalStorageAdapter } from './storage'
import type { Badge, BeltColor, ChildProfile, PortalState } from './types'
import { GRADE7_UNITS } from './worksheet'

export type BeltThreshold = {
  belt: BeltColor
  stripes: number
  testType: 'whiteboard' | 'teach_it'
}

export type CourseUnitConfig = {
  unitId: string
  title: string
  requiredActivityIds: readonly string[]
}

export type CourseLadderConfig = {
  courseId: string
  courseLabel: string
  units: readonly CourseUnitConfig[]
  beltThresholds: readonly BeltThreshold[]
}

const G7_UNIT_IDS = [
  'g7_u1_ratios',
  'g7_u2_integers',
  'g7_u3_expressions',
  'g7_u4_equations',
  'g7_u5_geometry',
  'g7_u6_statistics',
  'g7_u7_probability',
] as const

export const COURSE_LADDERS: Readonly<Record<string, CourseLadderConfig>> = {
  '7th Grade Math': {
    courseId: 'grade7_ca',
    courseLabel: '7th Grade Math',
    units: GRADE7_UNITS.map((title, i) => ({
      unitId: G7_UNIT_IDS[i]!,
      title,
      requiredActivityIds: i === 1 ? ['act_integer_operations'] : [`act_${G7_UNIT_IDS[i]}`],
    })),
    beltThresholds: [
      { belt: 'yellow', stripes: 2, testType: 'whiteboard' },
      { belt: 'green', stripes: 4, testType: 'whiteboard' },
      { belt: 'purple', stripes: 6, testType: 'whiteboard' },
      { belt: 'black', stripes: 7, testType: 'teach_it' },
    ],
  },
  '6th Grade Math': {
    courseId: 'grade6_ca',
    courseLabel: '6th Grade Math',
    units: [
      { unitId: 'g6_u1_ratios', title: 'Unit 1: Ratios & Unit Rates', requiredActivityIds: ['act_integer_operations'] },
      { unitId: 'g6_u2_fractions', title: 'Unit 2: Dividing Fractions', requiredActivityIds: ['act_g6_u2'] },
      { unitId: 'g6_u3_decimals', title: 'Unit 3: Decimals & Percents', requiredActivityIds: ['act_g6_u3'] },
      { unitId: 'g6_u4_negatives', title: 'Unit 4: Rational Numbers', requiredActivityIds: ['act_g6_u4'] },
      { unitId: 'g6_u5_expressions', title: 'Unit 5: Expressions & Equations', requiredActivityIds: ['act_g6_u5'] },
      { unitId: 'g6_u6_geometry', title: 'Unit 6: Area & Volume', requiredActivityIds: ['act_g6_u6'] },
      { unitId: 'g6_u7_stats', title: 'Unit 7: Data & Variability', requiredActivityIds: ['act_g6_u7'] },
    ],
    beltThresholds: [
      { belt: 'yellow', stripes: 2, testType: 'whiteboard' },
      { belt: 'green', stripes: 4, testType: 'whiteboard' },
      { belt: 'purple', stripes: 6, testType: 'whiteboard' },
      { belt: 'black', stripes: 7, testType: 'teach_it' },
    ],
  },
  '8th Grade Math': {
    courseId: 'grade8_ca',
    courseLabel: '8th Grade Math',
    units: [
      { unitId: 'g8_u1_transforms', title: 'Unit 1: Transformations', requiredActivityIds: ['act_g8_u1'] },
      { unitId: 'g8_u2_angles', title: 'Unit 2: Angles & Triangles', requiredActivityIds: ['act_g8_u2'] },
      { unitId: 'g8_u3_linear', title: 'Unit 3: Linear Equations', requiredActivityIds: ['act_integer_operations'] },
      { unitId: 'g8_u4_systems', title: 'Unit 4: Systems of Equations', requiredActivityIds: ['act_g8_u4'] },
      { unitId: 'g8_u5_functions', title: 'Unit 5: Functions', requiredActivityIds: ['act_g8_u5'] },
      { unitId: 'g8_u6_exponents', title: 'Unit 6: Exponents & Scientific Notation', requiredActivityIds: ['act_g8_u6'] },
      { unitId: 'g8_u7_data', title: 'Unit 7: Bivariate Data', requiredActivityIds: ['act_g8_u7'] },
    ],
    beltThresholds: [
      { belt: 'yellow', stripes: 2, testType: 'whiteboard' },
      { belt: 'green', stripes: 4, testType: 'whiteboard' },
      { belt: 'purple', stripes: 6, testType: 'whiteboard' },
      { belt: 'black', stripes: 7, testType: 'teach_it' },
    ],
  },
}

const BELT_RANK: Record<BeltColor, number> = { white: 0, yellow: 1, green: 2, purple: 3, black: 4 }

export function getCourseLadder(level: string): CourseLadderConfig {
  return COURSE_LADDERS[level] ?? COURSE_LADDERS['7th Grade Math']!
}

export function getNextBeltStep(child: ChildProfile): { nextBelt: BeltColor; stripesRequired: number; testType: 'whiteboard' | 'teach_it'; eligible: boolean } | null {
  const ladder = getCourseLadder(child.level)
  const next = ladder.beltThresholds.find((t) => BELT_RANK[t.belt] > BELT_RANK[child.currentBelt])
  if (!next) return null
  return { nextBelt: next.belt, stripesRequired: next.stripes, testType: next.testType, eligible: child.stripesEarned >= next.stripes }
}

/**
 * Computes passed units (sets reviewed + open response present) for a child.
 * Never reduces stripesEarned (no demotions or resets) and NEVER awards a belt automatically.
 */
export function recomputeStripesInState(state: PortalState, child: ChildProfile): { addedStripes: number; totalStripes: number } {
  const ladder = getCourseLadder(child.level)
  const passedUnits = ladder.units.filter((unit) => {
    const matching = state.workRecords.filter(
      (w) => w.childId === child.id && w.unitId === unit.unitId && w.status === 'reviewed' && w.openResponse.trim().length > 0,
    )
    return matching.length > 0
  }).length
  const prev = child.stripesEarned
  // Never take stripes away; if a newly reviewed unit raises count beyond current stripes, advance up to ladder length.
  const next = Math.min(ladder.units.length, Math.max(prev, passedUnits))
  child.stripesEarned = next
  return { addedStripes: next - prev, totalStripes: next }
}

/** Awards one stripe when a unit's set + open response finishes mentor review (capped at ladder units, never demotes). */
export function creditReviewedUnitStripe(state: PortalState, child: ChildProfile, unitId: string): boolean {
  const ladder = getCourseLadder(child.level)
  const hasReviewedWithOpen = state.workRecords.some(
    (w) => w.childId === child.id && w.unitId === unitId && w.status === 'reviewed' && w.openResponse.trim().length > 0,
  )
  if (!hasReviewedWithOpen || child.stripesEarned >= ladder.units.length) return false
  child.stripesEarned = Math.min(ladder.units.length, child.stripesEarned + 1)
  return true
}

/** Plain one-sentence progress line for parents — no charts, no demotions. */
export function formatParentBeltSentence(child: ChildProfile): string {
  const step = getNextBeltStep(child)
  const unitWord = child.stripesEarned === 1 ? 'unit' : 'units'
  if (!step) {
    return `${child.nickname} holds a black belt in ${child.level} (teach-it test passed) — ready for the next ladder at white with black still on the shelf.`
  }
  const remaining = Math.max(0, step.stripesRequired - child.stripesEarned)
  if (remaining === 0) {
    const testLabel = step.testType === 'teach_it' ? 'live black belt teach-it test' : `live ${step.nextBelt} belt test`
    return `${child.nickname} is a ${child.currentBelt} belt in ${child.level}, ${child.stripesEarned} ${unitWord} in — ready for the ${testLabel}.`
  }
  return `${child.nickname} is a ${child.currentBelt} belt in ${child.level}, ${child.stripesEarned} ${unitWord} in. ${remaining} more ${remaining === 1 ? 'unit' : 'units'} and ${child.nickname} can test for ${step.nextBelt}.`
}

export const STARTER_BADGE_LABELS: Record<'first_question' | 'explained_it' | 'came_back', string> = {
  first_question: 'First question',
  explained_it: 'Explained it',
  came_back: 'Came back',
}

/** Idempotently awards a badge on a child profile — never duplicates, never removed. */
export function grantBadgeInState(
  state: PortalState,
  child: ChildProfile,
  kind: Badge['kind'],
  label: string,
  awardedBy: string,
  nowIso = new Date().toISOString(),
): boolean {
  if (state.badges.some((b) => b.childId === child.id && b.kind === kind)) return false
  state.badges.push({
    id: `bdg_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    householdId: child.householdId,
    childId: child.id,
    kind,
    label,
    awardedAt: nowIso,
    awardedBy,
  })
  return true
}

/** Cosmetics-only points (e.g. fun game play or activity finish). NEVER affects stripes or belts. */
export function awardCosmeticPoints(
  adapter: PortalStorageAdapter,
  actor: PortalActor,
  childId: string,
  amount: number,
  reason: string,
  nowIso = new Date().toISOString(),
): PortalState {
  const state = adapter.load()
  const child = state.children.find((c) => c.id === childId)
  if (!child || !can(actor, 'view', { type: 'child', record: child }) || child.consentStatus !== 'verified') {
    throw new PortalAccessError('Cosmetic points require verified consent and access to this child profile')
  }
  const safeAmount = Math.max(1, Math.min(100, Math.round(amount)))
  const pts = state.points.find((p) => p.childId === child.id)
  if (pts) {
    pts.balance += safeAmount
    pts.ledger.push({ id: `pl_${pts.ledger.length + 1}`, amount: safeAmount, reason: `${reason} (cosmetics only)`, createdAt: nowIso })
  }
  return adapter.save(state)
}
