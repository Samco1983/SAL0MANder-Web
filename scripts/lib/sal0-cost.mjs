/**
 * Per-run spend, read from the CLI's own report rather than estimated.
 *
 * `claude -p --output-format json` wraps the answer in an envelope carrying
 * `result`, `session_id`, `usage`, and `total_cost_usd`. Recording that per run
 * turns "is the schedule expensive?" from a hunch into a number.
 *
 * Caveat worth keeping attached to every figure this produces: the vendor
 * documents these as client-side estimates. They are good for comparing runs
 * against each other, not for reconciling a bill.
 */

/**
 * Unwrap a `--output-format json` envelope.
 * Falls back cleanly when the CLI returned plain text instead.
 *
 * @returns {{text: string, costUsd: number|null, sessionId: string|null, usage: object|null, envelope: object|null}}
 */
export function parseAgentEnvelope(raw) {
  const text = String(raw ?? '')
  const bare = { text, costUsd: null, sessionId: null, usage: null, envelope: null }
  if (!text.trim()) return bare

  let envelope
  try {
    envelope = JSON.parse(text)
  } catch {
    return bare
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return bare

  // An envelope has a `result` field. A bare position object does not.
  if (typeof envelope.result !== 'string') return bare

  return {
    text: envelope.result,
    costUsd: typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : null,
    sessionId: typeof envelope.session_id === 'string' ? envelope.session_id : null,
    usage: envelope.usage ?? null,
    envelope,
  }
}

/** Sum recorded spend from ledger entries, grouped by run mode. */
export function summariseCost(entries) {
  const byMode = new Map()
  let total = 0
  let withCost = 0
  let withoutCost = 0

  for (const entry of entries) {
    const cost = typeof entry.costUsd === 'number' ? entry.costUsd : null
    if (cost === null) {
      if (entry.modelCalls > 0) withoutCost += 1
      continue
    }
    withCost += 1
    total += cost
    const mode = entry.runMode || 'unknown'
    const bucket = byMode.get(mode) || { runs: 0, costUsd: 0 }
    bucket.runs += 1
    bucket.costUsd += cost
    byMode.set(mode, bucket)
  }

  return {
    totalUsd: Number(total.toFixed(6)),
    runsWithCost: withCost,
    // Runs that called a model but reported no cost — these make the total a
    // floor, not a total. Never present the sum as complete while this is > 0.
    modelRunsMissingCost: withoutCost,
    byMode: Object.fromEntries(
      [...byMode].map(([mode, bucket]) => [
        mode,
        { runs: bucket.runs, costUsd: Number(bucket.costUsd.toFixed(6)) },
      ]),
    ),
  }
}
