/**
 * Shared idempotency vectors — the same cases, run on both sides of the bridge.
 *
 * This exists because the web and Unity independently implemented the same
 * contract and disagreed. The web keeps an id -> fingerprint ledger and rejects
 * a repeated key carrying a different payload; Unity's bridge keeps a
 * HashSet<string> of ids and returns early before any semantic handling, so a
 * corrected retry is silently discarded. Neither side's tests caught it, because
 * each asserted its own behaviour rather than agreement with the other.
 *
 * That is the dominant failure mode in this project. Three separate systems have
 * now shipped tests that certified the wrong thing: a broker test asserting its
 * argv contained a flag while the adapter had never reached a model, buildConfig
 * tests asserting filenames no real Unity build produced, and Unity tests
 * certifying placed-piece behaviour that was rejected on sight.
 *
 * Vectors, not prose, because prose is what both sides already had.
 *
 * THE CONTRACT
 *   same id + identical payload   -> duplicate, safe to ignore, no second effect
 *   same id + different payload   -> conflict, reported explicitly, never applied
 *   new id                        -> accepted
 *   invalid payload               -> validation error, state unchanged
 *   unreadable id                 -> rejected WITHOUT being recorded as seen
 *
 * That last rule matters most and is the easiest to get wrong: consuming an id
 * from a message you could not parse means the corrected retry — which will
 * reuse that id — is discarded as a duplicate. The bug hides until the first
 * malformed message, then eats its own fix.
 */

export type IdempotencyOutcome =
  | 'accepted'
  | 'duplicate-ignored'
  | 'event-id-conflict'
  | 'validation-error'
  | 'rejected-unrecorded'

export type IdempotencyVector = {
  name: string
  /** Applied in order against one fresh ledger. */
  steps: Array<{
    eventId: string | null
    payload: unknown
    expect: IdempotencyOutcome
  }>
  why: string
}

export const IDEMPOTENCY_VECTORS: IdempotencyVector[] = [
  {
    name: 'identical replay has no second effect',
    steps: [
      {
        eventId: 'evt-1',
        payload: { type: 'session-finished', questionsCorrect: 9 },
        expect: 'accepted',
      },
      {
        eventId: 'evt-1',
        payload: { type: 'session-finished', questionsCorrect: 9 },
        expect: 'duplicate-ignored',
      },
    ],
    why: 'A dropped response makes an honest client retry. Applying it twice writes a second result against one attempt.',
  },
  {
    name: 'same id with a different payload is a conflict, not a silent drop',
    steps: [
      {
        eventId: 'evt-2',
        payload: { type: 'session-finished', questionsCorrect: 9 },
        expect: 'accepted',
      },
      {
        eventId: 'evt-2',
        payload: { type: 'session-finished', questionsCorrect: 3 },
        expect: 'event-id-conflict',
      },
    ],
    why: 'Silently keeping the first is how a student is recorded with a score they did not get. Say so instead of choosing.',
  },
  {
    name: 'a corrected message under a NEW id is accepted',
    steps: [
      {
        eventId: 'evt-3',
        payload: { type: 'session-finished', questionsCorrect: 9 },
        expect: 'accepted',
      },
      {
        eventId: 'evt-4',
        payload: { type: 'session-finished', questionsCorrect: 8 },
        expect: 'accepted',
      },
    ],
    why: 'A correction is a new event, not a revision of an old one. This is the escape hatch the conflict rule requires.',
  },
  {
    name: 'an invalid payload changes nothing',
    steps: [
      { eventId: 'evt-5', payload: { type: 'session-finished' }, expect: 'validation-error' },
      {
        eventId: 'evt-5',
        payload: { type: 'session-finished', questionsCorrect: 7 },
        expect: 'accepted',
      },
    ],
    why: 'THE ONE THAT BITES. Step two is the corrected retry. If step one consumed evt-5, step two is discarded as a duplicate and the fix never lands.',
  },
  {
    name: 'an unreadable id is rejected without being remembered',
    steps: [
      { eventId: null, payload: '{not json', expect: 'rejected-unrecorded' },
      {
        eventId: 'evt-6',
        payload: { type: 'session-finished', questionsCorrect: 5 },
        expect: 'accepted',
      },
    ],
    why: 'Nothing can be deduplicated against an id that was never read. Recording a placeholder poisons the next real event.',
  },
]
