import { QuizSchema, type Quiz } from './share'

/**
 * Read the quiz out of an otherwise-opaque activity payload.
 *
 * DELIBERATE NARROWING OF AN EXISTING BOUNDARY — flag this in review.
 *
 * `version.payload.body` is documented as opaque: "everything Unity needs to
 * run the activity, in one blob the web layer never inspects." That was right
 * while Unity was the only consumer. It is no longer true: with no WebGL build
 * in this repo, a student following a share link hits a "the game isn't ready
 * yet" dead end while real questions sit unread inside that blob.
 *
 * So the blob stays opaque BY DEFAULT and exactly ONE field is lifted, through
 * the schema that already governs it. The web still never inspects `puzzle`,
 * geometry, piece counts, or snap behaviour — that stays Unity's, and no puzzle
 * logic belongs on this side of the line. `linkedPieceIndex` rides along in the
 * contract and is deliberately ignored here.
 *
 * No new schema is defined. `QuizSchema` and `QuestionSchema` already model
 * this shape in `share.ts`, including the rule that a question carries exactly
 * one correct choice. Writing a second, looser copy would have let a malformed
 * quiz render on the web that the play-bundle boundary would have rejected.
 *
 * Parsed rather than cast, and never throws: the payload is a blob a backend
 * may reshape without this app's knowledge, so an unexpected shape must degrade
 * to "no quiz here" rather than drop a student into an error boundary
 * mid-lesson.
 */
export function readQuiz(payloadBody: unknown): Quiz | null {
  if (!payloadBody || typeof payloadBody !== 'object') return null
  if (!('quiz' in payloadBody)) return null
  const parsed = QuizSchema.safeParse((payloadBody as { quiz: unknown }).quiz)
  return parsed.success ? parsed.data : null
}
