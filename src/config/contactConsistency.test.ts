import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * One contact address, everywhere.
 *
 * The site briefly carried two: About, Privacy and Terms said one thing while
 * the footer said another. A district reviewer who finds two different
 * contacts reads it as careless, and it is the kind of drift nobody notices
 * because each page looks right on its own.
 *
 * This does not judge WHICH address is correct — that is a product decision
 * about which mailbox is actually monitored. It only requires that they agree,
 * so switching them is one deliberate change rather than four forgettable ones.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|html)$/.test(entry) && !/\.test\./.test(entry)) out.push(full)
  }
  return out
}

describe('contact addresses', () => {
  it('are the same everywhere they appear', () => {
    const files = [...walk('src'), 'index.html']
    const found = new Map<string, string[]>()

    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/mailto:([^"'\s)]+)/g)) {
        const addr = match[1]
        if (addr) found.set(addr, [...(found.get(addr) ?? []), file])
      }
      // JSON-LD carries them as plain "email" values, not mailto links.
      for (const match of text.matchAll(/"email":\s*"([^"]+)"/g)) {
        const addr = match[1]
        if (addr) found.set(addr, [...(found.get(addr) ?? []), file])
      }
    }

    const addresses = [...found.keys()]
    expect(
      addresses.length,
      `More than one contact address is published:\n${[...found]
        .map(([a, f]) => `  ${a}\n    ${[...new Set(f)].join('\n    ')}`)
        .join('\n')}`,
    ).toBeLessThanOrEqual(1)
  })
})
