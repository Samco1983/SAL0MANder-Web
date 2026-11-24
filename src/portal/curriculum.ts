import { z } from 'zod'
import u1Raw from '@content/curriculum/g7/g7-u1-integers-rational.json'
import u2Raw from '@content/curriculum/g7/g7-u2-ratios-proportions.json'
import u3Raw from '@content/curriculum/g7/g7-u3-percent.json'
import u4Raw from '@content/curriculum/g7/g7-u4-expressions.json'
import u5Raw from '@content/curriculum/g7/g7-u5-equations-inequalities.json'
import u6Raw from '@content/curriculum/g7/g7-u6-geometry.json'
import u7Raw from '@content/curriculum/g7/g7-u7-statistics-probability.json'

/**
 * SAL0MANder 7th-Grade Curriculum Loader & Strict Zod Validator.
 * Reads static unit JSON files from `src/content/curriculum/g7/`, validates every unit,
 * set, problem, hint, and open response at load, and performs text-only answer checking
 * (case and spaces ignored; expressions are NEVER evaluated by value).
 */

export const CURRICULUM_VERSION_ID = 'g7-v1'
export const ANSWER_INPUT_MIN_CHARS = 24
export const ANSWER_INPUT_MAX_LENGTH = 64
export const CORRECT_FADE_MS = 3_000
export const EXPLANATION_WRONG_TRIES = 3
export const VOICE_CLIP_PLACEHOLDER_NOTICE = 'Voice clip placeholder — Mr. Sam’s audio clip is not recorded yet (never auto-plays).'

export const CurriculumAnswerTypeSchema = z.enum([
  'integer',
  'fraction',
  'decimal',
  'expression',
  'choice',
])

export const CurriculumChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
}).strict()

export const CurriculumHintSchema = z.object({
  ifAnswer: z.string().min(1),
  say: z.string().min(1),
}).strict()

export const CurriculumProblemSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  answerType: CurriculumAnswerTypeSchema,
  answer: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  choices: z.array(CurriculumChoiceSchema).min(2).optional(),
  hints: z.array(CurriculumHintSchema).min(1),
  explanation: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  standards: z.array(z.string().min(1)).optional(),
  dok: z.number().int().min(1).max(4).optional(),
}).strict().superRefine((problem, ctx) => {
  if (problem.answerType === 'choice' && (!problem.choices || problem.choices.length < 2)) {
    ctx.addIssue({ code: 'custom', message: `Choice problem ${problem.id} requires choices` })
  }
  if (!problem.hints.some((h) => h.ifAnswer === '*')) {
    ctx.addIssue({ code: 'custom', message: `Problem ${problem.id} requires a generic "*" hint` })
  }
})

export const CurriculumOpenResponseSchema = z.object({
  problemNumber: z.number().int().min(1),
  prompt: z.string().min(1),
}).strict()

export const CurriculumSetSchema = z.object({
  setId: z.string().min(1),
  title: z.string().min(1),
  skill: z.string().min(1),
  standards: z.array(z.string().min(1)).optional(),
  problems: z.array(CurriculumProblemSchema).min(1),
  openResponse: CurriculumOpenResponseSchema,
}).strict()

export const CurriculumUnitSchema = z.object({
  unitId: z.string().min(1),
  course: z.string().min(1),
  unitName: z.string().min(1),
  standards: z.array(z.string().min(1)).min(1),
  sets: z.array(CurriculumSetSchema).min(1),
}).strict()

export type CurriculumAnswerType = z.infer<typeof CurriculumAnswerTypeSchema>
export type CurriculumChoice = z.infer<typeof CurriculumChoiceSchema>
export type CurriculumHint = z.infer<typeof CurriculumHintSchema>
export type CurriculumProblem = z.infer<typeof CurriculumProblemSchema>
export type CurriculumOpenResponse = z.infer<typeof CurriculumOpenResponseSchema>
export type CurriculumSet = z.infer<typeof CurriculumSetSchema>
export type CurriculumUnit = z.infer<typeof CurriculumUnitSchema>

export type LoadedPracticeSet = {
  activityId: string
  activityVersionId: string
  unitId: string
  unitNumber: number
  unitName: string
  unitStandards: readonly string[]
  setId: string
  setLabel: string
  title: string
  skill: string
  standards: readonly string[]
  openResponse: CurriculumOpenResponse
  problems: readonly CurriculumProblem[]
}

export function parseCurriculumUnit(raw: unknown): CurriculumUnit {
  return CurriculumUnitSchema.parse(raw)
}

const RAW_GRADE7_UNITS: ReadonlyArray<unknown> = [u1Raw, u2Raw, u3Raw, u4Raw, u5Raw, u6Raw, u7Raw]

export const GRADE7_CURRICULUM: ReadonlyArray<CurriculumUnit> = RAW_GRADE7_UNITS.map((raw) => parseCurriculumUnit(raw))

function uniqueStandards(codes: ReadonlyArray<string>): string[] {
  return [...new Set(codes)]
}

function standardsMentionedInSkill(skill: string, unitStandards: ReadonlyArray<string>): string[] {
  const lower = skill.toLowerCase()
  return unitStandards.filter((code) => lower.includes(code.toLowerCase()))
}

/** Collects standards attached to a set (explicit set/problem standards, skill-matched unit standards, else unit standards). */
export function getSetStandards(set: CurriculumSet, unit: CurriculumUnit): string[] {
  const fromProblems = set.problems.flatMap((p) => p.standards ?? [])
  const combined = uniqueStandards([...(set.standards ?? []), ...fromProblems])
  if (combined.length > 0) return combined
  const fromSkill = standardsMentionedInSkill(set.skill, unit.standards)
  return fromSkill.length > 0 ? fromSkill : [...unit.standards]
}

/** Returns standards for an individual problem, falling back to its set or unit standards when omitted. */
export function getProblemStandards(problem: CurriculumProblem, set: CurriculumSet, unit: CurriculumUnit): string[] {
  if (problem.standards && problem.standards.length > 0) return [...problem.standards]
  return getSetStandards(set, unit)
}

/** Resolves standards to display for a problem inside a loaded practice set. */
export function resolveProblemStandards(problem: CurriculumProblem, practiceSet: LoadedPracticeSet): string[] {
  if (problem.standards && problem.standards.length > 0) return [...problem.standards]
  return [...practiceSet.standards]
}

export const GRADE7_PRACTICE_SETS: ReadonlyArray<LoadedPracticeSet> = GRADE7_CURRICULUM.flatMap((unit, unitIndex) =>
  unit.sets.map((set, setIndex) => ({
    activityId: set.setId,
    activityVersionId: CURRICULUM_VERSION_ID,
    unitId: unit.unitId,
    unitNumber: unitIndex + 1,
    unitName: unit.unitName,
    unitStandards: unit.standards,
    setId: set.setId,
    setLabel: `Set ${String.fromCharCode(65 + setIndex)}`,
    title: set.title,
    skill: set.skill,
    standards: getSetStandards(set, unit),
    openResponse: set.openResponse,
    problems: set.problems,
  })),
)

const SETS_BY_ID = new Map<string, LoadedPracticeSet>(GRADE7_PRACTICE_SETS.map((entry) => [entry.setId, entry]))
const UNITS_BY_ID = new Map<string, CurriculumUnit>(GRADE7_CURRICULUM.map((u) => [u.unitId, u]))

export function getCurriculumUnit(unitId: string): CurriculumUnit | undefined {
  return UNITS_BY_ID.get(unitId)
}

export function getCurriculumSet(setId: string): LoadedPracticeSet | undefined {
  return SETS_BY_ID.get(setId)
}

export function getDefaultCurriculumSet(): LoadedPracticeSet {
  return GRADE7_PRACTICE_SETS[0]!
}

/** Filters loaded practice sets by standard code (e.g. "7.EE.1") or keyword across unit, title, skill, and standards. */
export function filterPracticeSets(
  query: string,
  sets: ReadonlyArray<LoadedPracticeSet> = GRADE7_PRACTICE_SETS,
): LoadedPracticeSet[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return [...sets]
  return sets.filter((entry) => {
    const haystack = [
      `unit ${entry.unitNumber}`,
      entry.unitId,
      entry.unitName,
      entry.setId,
      entry.setLabel,
      entry.title,
      entry.skill,
      ...entry.standards,
      ...entry.problems.flatMap((p) => p.standards ?? []),
    ].join(' ').toLowerCase()
    return tokens.every((tok) => haystack.includes(tok))
  })
}

/** Normalizes student text for strict text comparison: trims, removes spaces, ignores case. */
export function normalizeAnswerText(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toLowerCase()
}

/**
 * Checks a student's answer strictly as normalized text against `problem.acceptedAnswers`.
 * Case and spaces are ignored; expressions are NEVER evaluated numerically or symbolically.
 */
export function checkCurriculumAnswer(rawInput: string, problem: CurriculumProblem): boolean {
  const normalized = normalizeAnswerText(rawInput)
  if (!normalized) return false
  return problem.acceptedAnswers.some((accepted) => normalizeAnswerText(accepted) === normalized)
}

/** Returns the hint matching the student's typed answer (normalized), or the generic "*" hint. */
export function selectProblemHint(rawInput: string, problem: CurriculumProblem): string {
  const normalized = normalizeAnswerText(rawInput)
  if (normalized) {
    const matched = problem.hints.find(
      (hint) => hint.ifAnswer !== '*' && normalizeAnswerText(hint.ifAnswer) === normalized,
    )
    if (matched) return matched.say
  }
  return problem.hints.find((hint) => hint.ifAnswer === '*')?.say ?? problem.hints[0]?.say ?? ''
}
