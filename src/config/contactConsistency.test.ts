import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keep the established public-support mailbox consistent across trust pages
 * and structured data. Tutoring and paid-learning inquiries intentionally use
 * Sam's business mailbox; the shared shell chooses by site mode.
 *
 * Explicit surface ownership catches a third address or a tutoring mailbox
 * accidentally replacing the privacy/support contact. Subject text is not a
 * recipient, and inquiry links must not introduce cc/bcc recipients.
 */
const support = 'samco1983@gmail.com'
const tutoring = 'sal@salomandermath.com'
const businessSurfaces: Record<string, string[]> = {
  'src/config/learningOffers.ts': [tutoring],
  'src/routes/classes/GroupBookingPage.tsx': [tutoring],
  'src/routes/classroom/TutoringBooking.tsx': [tutoring],
  'src/components/layout/AppShell.tsx': [support, tutoring],
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|html)$/.test(entry) && !/\.test\./.test(entry)) out.push(full)
  }
  return out
}

describe('contact addresses', () => {
  it('keeps support consistent and restricts business inquiries to their declared surfaces', () => {
    const files = [...walk('src'), 'index.html']
    const found = new Map<string, Set<string>>()

    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const key = file.replaceAll('\\', '/')
      const recipients = new Set<string>()
      for (const match of text.matchAll(/mailto:([^"'\s)]+)/g)) {
        const mailto = new URL(`mailto:${match[1]}`)
        expect(mailto.hash, `${key}: a contact link must not have a fragment`).toBe('')
        expect(
          [...mailto.searchParams.keys()].every((parameter) => parameter === 'subject'),
          `${key}: only a subject may accompany the declared contact recipient`,
        ).toBe(true)
        recipients.add(decodeURIComponent(mailto.pathname))
      }
      // JSON-LD contact data remains part of the general public-support contract.
      for (const match of text.matchAll(/"email":\s*"([^"]+)"/g)) {
        expect(match[1], `${key}: structured contact data must use public support`).toBe(support)
        recipients.add(match[1]!)
      }
      if (!recipients.size) continue
      found.set(key, recipients)
      expect(
        [...recipients].sort(),
        `${key}: unexpected or missing contact recipient`,
      ).toEqual([...(businessSurfaces[key] ?? [support])].sort())
    }

    // Declared business surfaces and the structured public contact must remain
    // present, not silently disappear to make consistency checks pass.
    for (const [file, expected] of Object.entries(businessSurfaces)) {
      expect([...(found.get(file) ?? [])].sort(), `${file}: missing contact`).toEqual(
        [...expected].sort(),
      )
    }
    expect(found.get('index.html')).toEqual(new Set([support]))
    expect(new Set([...found.values()].flatMap((recipients) => [...recipients]))).toEqual(
      new Set([support, tutoring]),
    )
  })
})
