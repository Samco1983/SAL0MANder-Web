/**
 * Is a quiz result actually somewhere a teacher can reach?
 *
 * Extracted from GuestPlayPage so it can be guarded. It lived as an inline
 * derivation inside a 550-line component, which meant the fix for a shipped
 * fake-completion bug had no test of its own — a test one seam away proved
 * usePlaySession resolves on a failed write, but nothing proved the page read
 * that correctly.
 *
 * `delivered` alone is NOT enough, and that mistake is the whole reason this
 * exists. usePlaySession.deliver catches a rejection, stores
 * `result-undeliverable`, and RESOLVES — so awaiting the submit tells you the
 * call finished, never that anything arrived. The original code flipped
 * straight to "Finished. Your teacher will see this" on a result that never
 * left the device.
 *
 * `result-undeliverable` is deliberately NOT finished: it already carries its
 * own retry surface, and a checkmark over it would hide the one state the
 * student needs to see.
 */
export function isQuizFinished(delivered: boolean, sessionStatus: string): boolean {
  if (!delivered) return false
  return sessionStatus !== 'result-undeliverable' && sessionStatus !== 'error'
}
