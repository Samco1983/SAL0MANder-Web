import type { PuzzlePicture } from './puzzleLibrary'
import { newDraft, type ActivityDraft, type DraftQuestion } from '@studio/activityDraft'

type SampleChoiceSpec = readonly [string, boolean]
type SampleQuestionSpec = {
  readonly prompt: string
  readonly hint: string
  readonly choices: readonly SampleChoiceSpec[]
}

type SampleActivitySpec = {
  readonly id: string
  readonly title: string
  readonly subject: string
  readonly gradeLevel: string
  readonly description: string
  readonly questions: readonly SampleQuestionSpec[]
}

const INTEGER_OPERATIONS_QUESTIONS: readonly SampleQuestionSpec[] = [
  {
    prompt: 'Evaluate: -8 + 5',
    hint: 'Start at -8 on a number line and move 5 units to the right.',
    choices: [
      ['-13', false],
      ['-3', true],
      ['3', false],
      ['13', false],
    ],
  },
  {
    prompt: 'Evaluate: 6 - (-4)',
    hint: 'Subtracting a negative is the same as adding its positive opposite.',
    choices: [
      ['-10', false],
      ['2', false],
      ['10', true],
      ['-2', false],
    ],
  },
  {
    prompt: 'Evaluate: (-7) × 3',
    hint: 'A negative number times a positive number gives a negative product.',
    choices: [
      ['-21', true],
      ['21', false],
      ['-10', false],
      ['-4', false],
    ],
  },
  {
    prompt: 'Evaluate: (-24) ÷ (-6)',
    hint: 'Dividing two negative numbers gives a positive quotient.',
    choices: [
      ['-4', false],
      ['4', true],
      ['-18', false],
      ['18', false],
    ],
  },
  {
    prompt: 'Evaluate: -9 + (-6)',
    hint: 'Adding two negative numbers moves farther left on the number line.',
    choices: [
      ['-3', false],
      ['3', false],
      ['-15', true],
      ['15', false],
    ],
  },
  {
    prompt: 'Evaluate: (-4) × (-5)',
    hint: 'The product of two negative integers is positive.',
    choices: [
      ['-20', false],
      ['-9', false],
      ['9', false],
      ['20', true],
    ],
  },
  {
    prompt: 'Evaluate: 36 ÷ (-9)',
    hint: 'A positive number divided by a negative number is negative.',
    choices: [
      ['-4', true],
      ['4', false],
      ['-27', false],
      ['27', false],
    ],
  },
  {
    prompt: 'Evaluate: -12 - 7',
    hint: 'Subtracting 7 from -12 moves 7 more units to the left.',
    choices: [
      ['-5', false],
      ['5', false],
      ['-19', true],
      ['19', false],
    ],
  },
  {
    prompt: 'Evaluate: (-18) ÷ 3 + 2',
    hint: 'Divide (-18) by 3 first, then add 2.',
    choices: [
      ['-8', false],
      ['-4', true],
      ['4', false],
      ['8', false],
    ],
  },
]

const ONE_STEP_INEQUALITIES_QUESTIONS: readonly SampleQuestionSpec[] = [
  {
    prompt: 'Solve: x + 4 > 9',
    hint: 'Subtract 4 from both sides.',
    choices: [
      ['x > 5', true],
      ['x > 13', false],
      ['x < 5', false],
      ['x > 36', false],
    ],
  },
  {
    prompt: 'Solve: x - 3 ≤ 7',
    hint: 'Add 3 to both sides to isolate x.',
    choices: [
      ['x ≤ 4', false],
      ['x ≤ 10', true],
      ['x ≥ 10', false],
      ['x ≤ 21', false],
    ],
  },
  {
    prompt: 'Solve: 3x < 18',
    hint: 'Divide both sides by positive 3. The inequality direction stays the same.',
    choices: [
      ['x < 15', false],
      ['x > 6', false],
      ['x < 6', true],
      ['x < 54', false],
    ],
  },
  {
    prompt: 'Solve: x / 2 ≥ 5',
    hint: 'Multiply both sides by positive 2.',
    choices: [
      ['x ≥ 2.5', false],
      ['x ≥ 7', false],
      ['x ≤ 10', false],
      ['x ≥ 10', true],
    ],
  },
  {
    prompt: 'Solve: -2x > 8',
    hint: 'Dividing both sides by a negative number reverses the inequality sign.',
    choices: [
      ['x > -4', false],
      ['x < -4', true],
      ['x < 4', false],
      ['x > 4', false],
    ],
  },
  {
    prompt: 'Solve: x + 7 ≤ 2',
    hint: 'Subtract 7 from both sides.',
    choices: [
      ['x ≤ -5', true],
      ['x ≤ 9', false],
      ['x ≥ -5', false],
      ['x ≤ 5', false],
    ],
  },
  {
    prompt: 'Solve: x - 6 > -1',
    hint: 'Add 6 to both sides.',
    choices: [
      ['x > -7', false],
      ['x > 5', true],
      ['x < 5', false],
      ['x > 7', false],
    ],
  },
  {
    prompt: 'Solve: -4x ≤ 20',
    hint: 'Divide by -4 and flip ≤ to ≥.',
    choices: [
      ['x ≤ -5', false],
      ['x ≥ -5', true],
      ['x ≥ 5', false],
      ['x ≤ 5', false],
    ],
  },
  {
    prompt: 'Solve: 5x ≥ -15',
    hint: 'Divide both sides by positive 5; do not flip the sign.',
    choices: [
      ['x ≤ -3', false],
      ['x ≥ 3', false],
      ['x ≥ -3', true],
      ['x ≥ -20', false],
    ],
  },
]

const LINEAR_EQUATIONS_QUESTIONS: readonly SampleQuestionSpec[] = [
  {
    prompt: 'Solve for x: x + 7 = 12',
    hint: 'Subtract 7 from both sides.',
    choices: [
      ['x = 5', true],
      ['x = 19', false],
      ['x = -5', false],
      ['x = 7', false],
    ],
  },
  {
    prompt: 'Solve for x: x - 9 = 4',
    hint: 'Add 9 to both sides.',
    choices: [
      ['x = 5', false],
      ['x = -5', false],
      ['x = 13', true],
      ['x = 36', false],
    ],
  },
  {
    prompt: 'Solve for x: 4x = 28',
    hint: 'Divide both sides by 4.',
    choices: [
      ['x = 24', false],
      ['x = 7', true],
      ['x = 32', false],
      ['x = 112', false],
    ],
  },
  {
    prompt: 'Solve for x: x / 3 = 6',
    hint: 'Multiply both sides by 3.',
    choices: [
      ['x = 2', false],
      ['x = 9', false],
      ['x = 18', true],
      ['x = 3', false],
    ],
  },
  {
    prompt: 'Solve for x: 2x + 3 = 11',
    hint: 'Subtract 3 first, then divide by 2.',
    choices: [
      ['x = 4', true],
      ['x = 7', false],
      ['x = 14', false],
      ['x = 3', false],
    ],
  },
  {
    prompt: 'Solve for x: 3x - 5 = 10',
    hint: 'Add 5 first, then divide by 3.',
    choices: [
      ['x = 1', false],
      ['x = 5', true],
      ['x = 15', false],
      ['x = 2', false],
    ],
  },
  {
    prompt: 'Solve for x: 5x + 2 = 27',
    hint: 'Subtract 2 first, then divide by 5.',
    choices: [
      ['x = 5', true],
      ['x = 6', false],
      ['x = 25', false],
      ['x = 4', false],
    ],
  },
  {
    prompt: 'Solve for x: 2x - 8 = 6',
    hint: 'Add 8 first, then divide by 2.',
    choices: [
      ['x = -1', false],
      ['x = 1', false],
      ['x = 7', true],
      ['x = 14', false],
    ],
  },
  {
    prompt: 'Solve for x: 4x + 6 = 2',
    hint: 'Subtract 6 from 2 to get -4, then divide by 4.',
    choices: [
      ['x = 2', false],
      ['x = -2', false],
      ['x = 1', false],
      ['x = -1', true],
    ],
  },
]

const SAMPLE_ACTIVITIES: Record<string, SampleActivitySpec> = {
  act_integer_operations: {
    id: 'act_integer_operations',
    title: 'Integer Operations',
    subject: 'Mathematics',
    gradeLevel: '7th',
    description:
      'Adding, subtracting, multiplying and dividing positive and negative numbers.',
    questions: INTEGER_OPERATIONS_QUESTIONS,
  },
  act_one_step_inequalities: {
    id: 'act_one_step_inequalities',
    title: 'One-Step Inequalities',
    subject: 'Mathematics',
    gradeLevel: '7th',
    description: 'Solving and graphing inequalities that take a single operation to undo.',
    questions: ONE_STEP_INEQUALITIES_QUESTIONS,
  },
  act_linear_equations: {
    id: 'act_linear_equations',
    title: 'Linear Equations',
    subject: 'Mathematics',
    gradeLevel: '7th',
    description: 'Solving for a variable across one and two-step linear equations.',
    questions: LINEAR_EQUATIONS_QUESTIONS,
  },
  'demo-activity': {
    id: 'demo-activity',
    title: 'Sample SAL0MANder Activity',
    subject: 'Mathematics',
    gradeLevel: '7th',
    description:
      'A sample activity with integer operations practice and a freshly rotated library picture.',
    questions: INTEGER_OPERATIONS_QUESTIONS,
  },
}

export function isSampleActivityId(activityId: string | undefined): boolean {
  return Boolean(activityId && Object.prototype.hasOwnProperty.call(SAMPLE_ACTIVITIES, activityId))
}

function toDraftQuestions(activityId: string, specs: readonly SampleQuestionSpec[]): DraftQuestion[] {
  const letters = ['a', 'b', 'c', 'd'] as const
  return specs.map((spec, index) => ({
    id: `${activityId}_q_${index + 1}`,
    questionText: spec.prompt,
    hintText: spec.hint,
    choices: spec.choices.map(([text, isCorrect], choiceIndex) => ({
      id: `${activityId}_q_${index + 1}_${letters[choiceIndex] ?? String(choiceIndex)}`,
      text,
      isCorrect,
    })),
  }))
}

/**
 * Build a Unity-ready ActivityDraft for one of the built-in sample activities
 * using the rotated (or explicitly selected) PUZZLE_LIBRARY picture.
 *
 * Sending this over SAL0MANderPreview bypasses Unity's hard-coded built-in
 * `imagePresetIndex: 0` salamander so every new game uses the selected library
 * picture and fits its board shape without distortion.
 */
export function buildSampleActivityDraft(
  activityId: string,
  picture: PuzzlePicture,
  now = new Date().toISOString(),
  activityType: ActivityDraft['config']['activityType'] = 'Both',
): ActivityDraft {
  const spec = SAMPLE_ACTIVITIES[activityId]
  if (!spec) {
    throw new Error(`Unknown sample activity: ${activityId}`)
  }
  const base = newDraft(spec.id, now)
  return {
    config: {
      ...base.config,
      title: spec.title,
      activityType,
      imagePresetIndex: -1,
      pieceCountPreset: 9,
      boardShape: picture.shape,
      showBoardGuide: false,
      allowRestart: true,
      allowResumeLater: false,
      allowHints: true,
      allowCompletedPictureView: false,
      autoPlaceCorrectPieces: activityType === 'MysteryReveal',
    },
    meta: {
      ...base.meta,
      subject: spec.subject,
      gradeLevel: spec.gradeLevel,
      description: spec.description,
      imageKey: picture.key,
      optionsReviewed: true,
    },
    questions: toDraftQuestions(spec.id, spec.questions),
  }
}
