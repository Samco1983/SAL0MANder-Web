import { z } from 'zod'
import { ActivityDraftSchema } from '@studio/activityDraft'
import { createDraftBackup } from '@studio/draftBackup'

const LessonSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    grade: z.number().int().nullable(),
    course: z.string().optional(),
    standards: z
      .array(
        z.object({
          id: z.string(),
          url: z
            .string()
            .regex(
              /^https:\/\/www\.cde\.ca\.gov\/be\/st\/ss\/documents\/ccssmathstandardaug2013\.pdf#page=\d+$/,
            ),
          alignmentSummary: z.string(),
        }),
      )
      .min(1),
    activityDraft: ActivityDraftSchema,
    teacherGuide: z.object({
      learningTarget: z.string(),
      suggestedMinutes: z.number().positive(),
      miniLesson: z.string(),
      assessmentLimits: z.string(),
      performanceRubric: z.array(z.string()),
      independentExit: z.object({ prompt: z.string(), conditions: z.string(), review: z.string() }),
    }),
    questionNotes: z.array(
      z.object({
        questionId: z.string(),
        skill: z.string(),
        standardIds: z.array(z.string()).min(1),
        verification: z.record(z.string(), z.unknown()).optional(),
        answerChoiceId: z.string(),
        explanation: z.string(),
        choiceReasoning: z.array(z.object({ choiceId: z.string(), reason: z.string() })),
      }),
    ),
  })
  .superRefine((lesson, context) => {
    const questions = lesson.activityDraft.questions
    if (
      lesson.id !== lesson.activityDraft.config.activityId ||
      questions.length !== 12 ||
      new Set(questions.map((q) => q.id)).size !== 12
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A pilot must have twelve uniquely identified questions.',
      })
    }
    for (const question of questions) {
      const correct = question.choices.filter((choice) => choice.isCorrect)
      const notes = lesson.questionNotes.filter((note) => note.questionId === question.id)
      if (
        question.choices.length !== 4 ||
        correct.length !== 1 ||
        notes.length !== 1 ||
        notes[0]?.answerChoiceId !== correct[0]?.id ||
        new Set(question.choices.map((choice) => choice.id)).size !== 4 ||
        !question.choices.every(
          (choice) =>
            notes[0]?.choiceReasoning.filter((reason) => reason.choiceId === choice.id).length ===
            1,
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Question choices and explanations must agree.',
        })
      }
    }
  })
export type Lesson = z.infer<typeof LessonSchema>
const sources = import.meta.glob<string>('/content/tutoring-pilot/ca-*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const ids = [
  'ca-g6-math-rates',
  'ca-g7-math-equations',
  'ca-g8-math-equations',
  'ca-algebra1-linear-constraints',
] as const

/** Explicit catalog: expansion drafts cannot silently become student-facing lessons. */
export const LESSONS = ids.map((id) =>
  LessonSchema.parse(JSON.parse(sources[`/content/tutoring-pilot/${id}.json`] ?? 'null')),
)
export const courseLabel = (lesson: Lesson) => lesson.course || `Grade ${lesson.grade}`

/** Real Studio backup wrapper around the unchanged, validated ActivityDraft member. */
export function lessonBackup(lesson: Lesson, exportedAt?: string) {
  return createDraftBackup([lesson.activityDraft], exportedAt)
}
