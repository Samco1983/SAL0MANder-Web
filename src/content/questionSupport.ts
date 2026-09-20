import { z } from 'zod'

export const HelpTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])
export type HelpTier = z.infer<typeof HelpTierSchema>
export const HELP_CATEGORIES = [
  'independent',
  'tier1_supported',
  'tier2_visual',
  'tier3_guided',
  'tier4_example',
  'tier5_full_solution',
] as const
export const EquationSupportSchema = z.object({
  questionId: z.string(),
  skill: z.string(),
  standardIds: z.array(z.string()),
  hint: z.string(),
  coefficient: z.number().int().positive(),
  constant: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  solution: z.number().int().positive(),
})
export type EquationSupport = z.infer<typeof EquationSupportSchema>

/** Read the existing pilot's verification data; never duplicate its question or answer registry. */
export function equationSupport(
  question: { id: string; hintText: string },
  note: {
    questionId: string
    skill: string
    standardIds: string[]
    verification?: Record<string, unknown>
  },
): EquationSupport | null {
  if (question.id !== note.questionId || note.verification?.kind !== 'equation') return null
  const match = /^([1-9]\d*)\*x\+([1-9]\d*)$/.exec(String(note.verification.left))
  const right = String(note.verification.right)
  if (!match || !/^[1-9]\d*$/.test(right)) return null
  const coefficient = Number(match[1]),
    constant = Number(match[2]),
    total = Number(right)
  const solution = (total - constant) / coefficient
  // This first visual adapter supports small, positive integer equations only.
  if (
    coefficient > 8 ||
    constant > 12 ||
    total > 60 ||
    !Number.isInteger(solution) ||
    solution <= 0
  )
    return null
  return EquationSupportSchema.parse({
    questionId: question.id,
    skill: note.skill,
    standardIds: note.standardIds,
    hint: question.hintText,
    coefficient,
    constant,
    total,
    solution,
  })
}

export const HelpPolicySchema = z.object({
  enabledTiers: z.array(HelpTierSchema).default([1, 2, 3, 4, 5]),
  diagrams: z.boolean().default(true),
  fullSolution: z.boolean().default(true),
  autoSuggest: z.boolean().default(true),
  /** Opens a dismissible suggestion once at this count; never locks the question. */
  suggestAfterIncorrect: z.number().int().positive().nullable().default(null),
})
export type HelpPolicy = z.infer<typeof HelpPolicySchema>
export function availableHelpTiers(policy: HelpPolicy): HelpTier[] {
  return ([1, 2, 3, 4, 5] as const).filter(
    (tier) =>
      policy.enabledTiers.includes(tier) &&
      (tier !== 2 || policy.diagrams) &&
      (tier !== 5 || policy.fullSolution),
  )
}

const FreshCheckSchema = z.object({
  sequence: z.number().int().positive(),
  attempts: z.number().int().nonnegative(),
  correct: z.boolean(),
  helpUsed: z.boolean(),
  independentSuccess: z.boolean(),
})
export const HelpEvidenceSchema = z.object({
  questionId: z.string(),
  skill: z.string(),
  standardIds: z.array(z.string()),
  highestTier: z.number().int().min(0).max(5),
  full_solution_used: z.boolean(),
  exampleViewed: z.boolean(),
  guidedStepsCompleted: z.number().int().min(0).max(3),
  originalAttempts: z.array(
    z.object({
      choiceId: z.string(),
      correct: z.boolean(),
      helpTier: z.number().int().min(0).max(5),
    }),
  ),
  freshChecks: z.array(FreshCheckSchema),
  /** A local practice observation is neither a cloud record nor a mastery judgement. */
  mastery: z.literal('not_assessed'),
})
export type HelpEvidence = z.infer<typeof HelpEvidenceSchema>
export type HelpAction =
  | { type: 'open_tier'; tier: HelpTier }
  | { type: 'original_answer'; choiceId: string; correct: boolean }
  | { type: 'guided_step'; completed: number }
  | { type: 'begin_fresh_check' }
  | { type: 'fresh_answer'; correct: boolean }

export function initialHelpEvidence(
  support: Pick<EquationSupport, 'questionId' | 'skill' | 'standardIds'>,
): HelpEvidence {
  return {
    questionId: support.questionId,
    skill: support.skill,
    standardIds: [...support.standardIds],
    highestTier: 0,
    full_solution_used: false,
    exampleViewed: false,
    guidedStepsCompleted: 0,
    originalAttempts: [],
    freshChecks: [],
    mastery: 'not_assessed',
  }
}
export function helpCategory(evidence: HelpEvidence) {
  return HELP_CATEGORIES[evidence.highestTier]!
}
export function helpEvidenceReducer(state: HelpEvidence, action: HelpAction): HelpEvidence {
  switch (action.type) {
    case 'open_tier':
      return {
        ...state,
        highestTier: Math.max(state.highestTier, action.tier),
        full_solution_used: state.full_solution_used || action.tier === 5,
        exampleViewed: state.exampleViewed || action.tier === 4,
        freshChecks: state.freshChecks.map((check, index) =>
          index === state.freshChecks.length - 1 && !check.correct
            ? { ...check, helpUsed: true }
            : check,
        ),
      }
    case 'original_answer':
      return {
        ...state,
        originalAttempts: [
          ...state.originalAttempts,
          { choiceId: action.choiceId, correct: action.correct, helpTier: state.highestTier },
        ],
        // Returning to original-answer feedback while a fresh check is pending exposes support.
        freshChecks: state.freshChecks.map((check, index) =>
          index === state.freshChecks.length - 1 && !check.correct
            ? { ...check, helpUsed: true }
            : check,
        ),
      }
    case 'guided_step':
      return {
        ...state,
        guidedStepsCompleted: Math.max(state.guidedStepsCompleted, Math.min(3, action.completed)),
      }
    case 'begin_fresh_check':
      return {
        ...state,
        freshChecks: [
          ...state.freshChecks,
          {
            sequence: state.freshChecks.length + 1,
            attempts: 0,
            correct: false,
            helpUsed: false,
            independentSuccess: false,
          },
        ],
      }
    case 'fresh_answer':
      return {
        ...state,
        freshChecks: state.freshChecks.map((check, index) =>
          index === state.freshChecks.length - 1 && !check.correct
            ? {
                ...check,
                attempts: check.attempts + 1,
                correct: action.correct,
                independentSuccess: action.correct && !check.helpUsed,
              }
            : check,
        ),
      }
  }
}

/** Each new check has different values and the same inverse-operation skill/standard. */
export function freshEquation(support: EquationSupport, sequence: number) {
  const coefficient = support.coefficient + sequence
  const constant = support.constant + sequence
  const solution = support.solution + sequence
  return { coefficient, constant, solution, total: coefficient * solution + constant }
}
export function exampleEquation(support: EquationSupport) {
  const coefficient = Math.max(1, support.coefficient - 1)
  const constant = Math.max(0, support.constant - 1)
  const solution = support.solution + (support.solution > 1 ? -1 : 1)
  return { coefficient, constant, solution, total: coefficient * solution + constant }
}
export function sameNumber(input: string, expected: number) {
  return /^-?\d+(?:\.\d+)?$/.test(input.trim()) && Number(input) === expected
}
