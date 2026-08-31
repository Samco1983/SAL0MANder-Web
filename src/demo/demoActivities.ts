/**
 * Web-facing presentation for the three launch demo activities.
 *
 * ## What this file is allowed to contain
 *
 * Titles, descriptions, grade tags, accent colour, preview art. The owner's
 * lane boundary permits exactly this: "Claude may improve their web-facing
 * titles, descriptions, grade tags, preview imagery, and share presentation."
 *
 * ## What it must never contain
 *
 * Questions, answers, hints, piece counts, release mode, snap behaviour,
 * completion rules. Those are Unity's, and a copy of them here would be a
 * second implementation of the rules that drifts the moment a teacher edits an
 * activity. The `id` is an opaque handle: the web hands it across and never
 * interprets it.
 *
 * If you find yourself wanting a field to decide *gameplay* rather than
 * *presentation*, it belongs in the Unity payload, not here.
 */

import type { ActivityResolutionVerdict } from '@unity/activityResolution'

/**
 * How much we actually know about whether this activity launches.
 *
 * `'never-measured'` is separate from every {@link ActivityResolutionVerdict}
 * on purpose. A verdict is the outcome of an observation; this is the state
 * before any observation has happened, and folding it into `'no-response'`
 * would claim we tried and got silence when the truth is that nothing has ever
 * been booted.
 */
export type DemoLaunchStatus = ActivityResolutionVerdict | 'never-measured'

export type DemoActivity = {
  /**
   * PROVISIONAL. Codex assigns the real id when the pack is authored — see
   * `BLOCKERS.md` B-11 step 1. Follows the convention of the ids that exist
   * today (`act_quadratics`, `act_cell_structure`, `act_vocab_review`) so the
   * eventual rename is a one-line edit here and nowhere else.
   */
  id: string
  /** Web-facing title. May differ from Unity's internal pack title. */
  title: string
  /** One line a teacher reads while deciding in about four seconds. */
  blurb: string
  /** Presentation only — not a curriculum claim the platform enforces. */
  gradeTag: string
  /** Short topic label for the card's eyebrow. */
  strand: string
  /**
   * Decorative preview. Deliberately a generated pattern rather than a
   * screenshot: a screenshot of a puzzle we have never successfully launched
   * would be the most misleading thing on the page.
   */
  accent: string
  /** Everything known about whether a link to this actually works. */
  launchStatus: DemoLaunchStatus
}

/**
 * All three launch demos, in the owner's stated order.
 *
 * Every `launchStatus` is `'never-measured'` and must stay that way until a
 * real build has been booted and the resolution probe returned `'confirmed'`.
 * Editing one of these by hand to make the page look finished would defeat the
 * entire point of `src/unity/activityResolution.ts`.
 */
export const DEMO_ACTIVITIES: readonly DemoActivity[] = [
  {
    id: 'act_integer_ops',
    title: 'Integer Operations',
    blurb: 'Adding, subtracting, multiplying and dividing positive and negative numbers.',
    gradeTag: 'Grades 6–7',
    strand: 'Number sense',
    accent: 'var(--color-brand-green)',
    launchStatus: 'never-measured',
  },
  {
    id: 'act_one_step_inequalities',
    title: 'One-Step Inequalities',
    blurb: 'Solving and graphing inequalities that take a single operation to undo.',
    gradeTag: 'Grades 6–8',
    strand: 'Algebraic thinking',
    accent: 'var(--color-support)',
    launchStatus: 'never-measured',
  },
  {
    id: 'act_linear_equations',
    title: 'Linear Equations',
    blurb: 'Solving for a variable across one and two-step linear equations.',
    gradeTag: 'Grades 7–9',
    strand: 'Algebra',
    accent: 'var(--color-brand-violet)',
    launchStatus: 'never-measured',
  },
] as const

/** Plain-language status line. Shown to a teacher, so no jargon and no ids. */
export function describeLaunchStatus(status: DemoLaunchStatus): {
  label: string
  detail: string
  tone: 'verified' | 'pending' | 'broken'
} {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Launch verified',
        detail: 'A share link for this activity was opened and the right activity loaded.',
        tone: 'verified',
      }
    case 'never-measured':
      return {
        label: 'Not yet verified',
        detail: 'This activity has not been built in the app yet, so its link has never been tested.',
        tone: 'pending',
      }
    case 'unverifiable':
      return {
        label: 'Not yet verified',
        detail: 'The app opens, but it does not yet report which activity it loaded.',
        tone: 'pending',
      }
    case 'no-response':
      return {
        label: 'No response',
        detail: 'The app was opened but never reported back.',
        tone: 'broken',
      }
    case 'wrong-activity':
      return {
        label: 'Wrong activity',
        detail: 'The link opened, but a different activity loaded than the one it names.',
        tone: 'broken',
      }
    case 'invalid-target':
      return {
        label: 'Activity missing',
        detail: 'The app has no activity with this name.',
        tone: 'broken',
      }
  }
}

/**
 * May this card offer a Play button?
 *
 * Only when a link would actually reach something. Sending a teacher into the
 * link-failure screen to discover that an activity does not exist is a worse
 * first impression than a card that says so up front, and this codebase already
 * treats dead ends as defects (see `GuestPlayIndexPage`).
 */
export function isPlayable(activity: DemoActivity): boolean {
  return activity.launchStatus === 'confirmed' || activity.launchStatus === 'unverifiable'
}
