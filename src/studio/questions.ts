import { newId } from '@contracts/v1'
import type { ActivityDraft, DraftQuestion } from './activityDraft'

/**
 * Editing a teacher's question list.
 *
 * Pure functions over the draft, kept out of the component so the rules can be
 * tested without rendering anything — and so the rules stay in one place rather
 * than being re-derived inside three event handlers.
 *
 * ## Why four choices and exactly one correct answer
 *
 * Unity's `QuestionData` holds a list of `AnswerChoice` with an `isCorrect`
 * flag, and the play contract enforces the rest: `QuestionSchema` in
 * `contracts/v1/share.ts` requires at least two choices and refines that
 * **exactly one** is correct. Anything looser is rejected at the boundary
 * rather than in front of a class, so the editor should not be able to author
 * it in the first place.
 */

export const MIN_CHOICES = 2
export const MAX_CHOICES = 6
const DEFAULT_CHOICES = 4

export function blankQuestion(): DraftQuestion {
  return {
    id: `q_${newId()}`,
    questionText: '',
    hintText: '',
    choices: Array.from({ length: DEFAULT_CHOICES }, (_, i) => ({
      id: `c_${newId()}`,
      text: '',
      // The first choice starts correct so a half-finished question is never in
      // the invalid "no correct answer" state, which the contract rejects.
      isCorrect: i === 0,
    })),
  }
}

export function addQuestion(draft: ActivityDraft): ActivityDraft {
  return { ...draft, questions: [...draft.questions, blankQuestion()] }
}

export function removeQuestion(draft: ActivityDraft, questionId: string): ActivityDraft {
  return { ...draft, questions: draft.questions.filter((q) => q.id !== questionId) }
}

/** Moves a question one place up or down. Out-of-range moves are no-ops. */
export function moveQuestion(draft: ActivityDraft, questionId: string, delta: -1 | 1): ActivityDraft {
  const from = draft.questions.findIndex((q) => q.id === questionId)
  const to = from + delta
  if (from < 0 || to < 0 || to >= draft.questions.length) return draft

  const questions = [...draft.questions]
  const [moved] = questions.splice(from, 1)
  questions.splice(to, 0, moved!)
  return { ...draft, questions }
}

function mapQuestion(
  draft: ActivityDraft,
  questionId: string,
  fn: (q: DraftQuestion) => DraftQuestion,
): ActivityDraft {
  return { ...draft, questions: draft.questions.map((q) => (q.id === questionId ? fn(q) : q)) }
}

export function editQuestion(
  draft: ActivityDraft,
  questionId: string,
  patch: Partial<Pick<DraftQuestion, 'questionText' | 'hintText'>>,
): ActivityDraft {
  return mapQuestion(draft, questionId, (q) => ({ ...q, ...patch }))
}

export function editChoice(
  draft: ActivityDraft,
  questionId: string,
  choiceId: string,
  text: string,
): ActivityDraft {
  return mapQuestion(draft, questionId, (q) => ({
    ...q,
    choices: q.choices.map((c) => (c.id === choiceId ? { ...c, text } : c)),
  }))
}

/**
 * Marks one choice correct and every other choice wrong.
 *
 * Written as "set the correct one" rather than "toggle this one" on purpose:
 * a toggle can produce zero correct answers or two, both of which the play
 * contract rejects. Making the invalid states unreachable beats validating for
 * them afterwards.
 */
export function setCorrectChoice(
  draft: ActivityDraft,
  questionId: string,
  choiceId: string,
): ActivityDraft {
  return mapQuestion(draft, questionId, (q) => ({
    ...q,
    choices: q.choices.map((c) => ({ ...c, isCorrect: c.id === choiceId })),
  }))
}

export function addChoice(draft: ActivityDraft, questionId: string): ActivityDraft {
  return mapQuestion(draft, questionId, (q) =>
    q.choices.length >= MAX_CHOICES
      ? q
      : { ...q, choices: [...q.choices, { id: `c_${newId()}`, text: '', isCorrect: false }] },
  )
}

/**
 * Removes a choice, refusing below the minimum and never leaving the question
 * without a correct answer.
 */
export function removeChoice(
  draft: ActivityDraft,
  questionId: string,
  choiceId: string,
): ActivityDraft {
  return mapQuestion(draft, questionId, (q) => {
    if (q.choices.length <= MIN_CHOICES) return q
    const remaining = q.choices.filter((c) => c.id !== choiceId)
    if (remaining.some((c) => c.isCorrect)) return { ...q, choices: remaining }
    // The correct answer was the one deleted. Promote the first survivor rather
    // than leaving a question the contract will reject.
    return { ...q, choices: remaining.map((c, i) => ({ ...c, isCorrect: i === 0 })) }
  })
}

export type QuestionProblem = 'no-text' | 'blank-choice' | 'no-correct-answer'

/**
 * What is unfinished about a question, for the teacher.
 *
 * Returns problems rather than a boolean so the editor can point at the row
 * that needs attention instead of saying the activity is invalid and leaving
 * someone to hunt for which of thirty questions it meant.
 */
export function questionProblems(q: DraftQuestion): QuestionProblem[] {
  const problems: QuestionProblem[] = []
  if (q.questionText.trim() === '') problems.push('no-text')
  if (q.choices.some((c) => c.text.trim() === '')) problems.push('blank-choice')
  if (q.choices.filter((c) => c.isCorrect).length !== 1) problems.push('no-correct-answer')
  return problems
}

export const PROBLEM_TEXT: Record<QuestionProblem, string> = {
  'no-text': 'Add the question',
  'blank-choice': 'Fill in every answer',
  'no-correct-answer': 'Mark the correct answer',
}
