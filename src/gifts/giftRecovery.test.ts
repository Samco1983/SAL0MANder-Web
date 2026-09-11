import { expect, it } from 'vitest'
import { GIFT_TEMPLATES } from './giftCatalog'
import { GIFT_SURVEY } from './giftSurvey'
import { DEFAULT_GIFT_PRESENTATION } from './giftPresentation'
import {
  buildGiftLink,
  decodeGift,
  encodeGift,
  giftBackupCode,
  giftEmailDraft,
  restoreGiftLink,
  type Gift,
} from './giftLink'

const gifts: Gift[] = [
  ...(['learning', 'mystery', 'classic'] as const).map((mode) => ({
    version: 1 as const,
    catalogVersion: 1 as const,
    mode,
    imageKey: 'coral-reef',
    selections:
      mode === 'classic'
        ? []
        : GIFT_TEMPLATES.slice(0, 4).map((q) => ({ templateId: q.id, answerId: q.choices[0]!.id })),
  })),
  ...(['learning', 'mystery', 'classic'] as const).map((mode) => ({
    version: 2 as const,
    catalogVersion: 2 as const,
    mode,
    imageKey: 'red-panda',
    answers:
      mode === 'classic'
        ? []
        : GIFT_SURVEY.map((q) => ({ templateId: q.id, answer: q.suggestions[0] })),
    ...DEFAULT_GIFT_PRESENTATION,
  })),
  {
    version: 3,
    catalogVersion: 2,
    mode: 'sliding',
    imageKey: 'coral-reef',
    answers: [],
    ...DEFAULT_GIFT_PRESENTATION,
  },
]
it.each(gifts)(
  'restores every accepted form of Gift v$version $mode at the current local base path',
  (gift) => {
    const source = buildGiftLink(gift, 'https://sender.example', '/different-site')
    for (const input of [source, encodeGift(gift), giftBackupCode(gift)]) {
      const restored = new URL(restoreGiftLink(input, 'http://127.0.0.1:5184', '/our-site/'))
      expect(restored.origin).toBe('http://127.0.0.1:5184')
      expect(restored.pathname).toBe('/our-site/gifts/play')
      expect(restored.search).toBe('')
      expect(decodeGift(restored.hash, restored.href.length)).toEqual(gift)
    }
  },
)
it.each([
  '',
  'abc',
  '{"version":1}',
  '#gift=abc',
  'SAL0-GIFT:abc',
  'https://sender.example/other',
  'javascript:alert(1)',
  'file:///gifts/play',
  'https://name:password@sender.example/gifts/play',
  'https://sender.example/not-gifts/play',
])('rejects unrelated, malformed or unsafe input: %s', (input) => {
  expect(() => restoreGiftLink(input, 'https://local.example')).toThrow(/complete gift link/)
})
it('rejects control characters, trailing data, raw unprefixed payloads and unknown schemas', () => {
  const gift = gifts[0]!
  const hash = encodeGift(gift)
  const full = buildGiftLink(gift, 'https://source.example')
  const unknown = '#gift=' + btoa(JSON.stringify({ ...gift, version: 99 })).replace(/=+$/, '')
  for (const input of [
    hash + '&extra=1',
    giftBackupCode(gift) + '.',
    hash.slice(6),
    full.slice(0, -12) + '\n' + full.slice(-12),
    '\u0000' + hash,
    hash + '\u200b',
    unknown,
  ])
    expect(() => restoreGiftLink(input, 'https://local.example')).toThrow()
})
it('rejects credential-bearing Gift URLs even when the entire payload is valid', () => {
  expect(() =>
    restoreGiftLink(
      'https://name:password@elsewhere.example/gifts/play' + encodeGift(gifts[0]!),
      'https://local.example',
    ),
  ).toThrow()
})
it('retains v1 incoming length limits and checks the newly built local URL too', () => {
  const gift = gifts[2]!
  const overV1 = 'https://sender.example/' + 'x'.repeat(1900) + '/gifts/play' + encodeGift(gift)
  expect(overV1.length).toBeGreaterThan(2000)
  expect(overV1.length).toBeLessThan(3000)
  expect(() => restoreGiftLink(overV1, 'https://local.example')).toThrow()
  expect(() =>
    restoreGiftLink(giftBackupCode(gift), 'https://local.example', '/' + 'x'.repeat(2000)),
  ).toThrow()
  expect(() => restoreGiftLink('SAL0-GIFT:' + 'a'.repeat(3000), 'https://local.example')).toThrow()
})
it('accepts a complete trailing-slash Gift URL without reusing its origin or query', () => {
  const url = new URL(
    'https://elsewhere.example/site/gifts/play/?source=mail' + encodeGift(gifts[2]!),
  )
  expect(restoreGiftLink(url.href, 'https://local.example', '/site')).toBe(
    buildGiftLink(gifts[2]!, 'https://local.example', '/site'),
  )
})
it('keeps one full URL in the email and adds recovery instructions without repeating a large code', () => {
  const link = buildGiftLink(gifts[3]!, 'https://source.example')
  const draft = new URL(giftEmailDraft(link))
  const body = draft.searchParams.get('body')!
  expect(body.split(link)).toHaveLength(2)
  expect(body).toContain('choose Open a gift')
  expect(body).not.toContain('SAL0-GIFT:')
  expect(draft.pathname).toBe('')
})

it.each(gifts)(
  'recovers Gift v$version $mode from our native-share and email message text',
  (gift) => {
    const url = buildGiftLink(gift, 'https://sender.example')
    const email = new URL(giftEmailDraft(url)).searchParams.get('body')!
    for (const input of [
      'I made you a puzzle gift. No sign-in needed. ' + url,
      'I made you a puzzle gift. No sign-in needed.\r\n' + url,
      email,
      ` \r\n\t${url}\r\n `,
      `Your gift is ready.\n${giftBackupCode(gift)}\nHave fun!`,
    ]) {
      const restored = new URL(restoreGiftLink(input, 'https://local.example', '/our-site'))
      expect(restored.origin).toBe('https://local.example')
      expect(restored.pathname).toBe('/our-site/gifts/play')
      expect(decodeGift(restored.hash, restored.href.length)).toEqual(gift)
    }
  },
)

it('rejects ambiguous messages rather than choosing one link or repairing split payloads', () => {
  const url = buildGiftLink(gifts[3]!, 'https://sender.example')
  const second = buildGiftLink(gifts[4]!, 'https://other.example')
  const code = giftBackupCode(gifts[3]!)
  for (const input of [
    `${url}\n${second}`,
    `${url} ${url}`,
    `(${url}) or ${second}`,
    `gift:${code} or ${second}`,
    `${url}\n${code}`,
    `${code} ${code}`,
    `${url}\nSAL0-GIFT:broken`,
    `More at https://other.example/\nYour gift: ${url}`,
    `Try ftp://other.example/ or ${url}`,
    `Here is your gift: ${url.slice(0, -15)}\n${url.slice(-15)}`,
    `Your backup: ${code.slice(0, -15)}\t${code.slice(-15)}`,
    `Here is your gift: ${url}.`,
    `Your backup: ${code}&extra=1`,
    `Here is a fragment: ${encodeGift(gifts[3]!)}`,
  ]) {
    expect(() => restoreGiftLink(input, 'https://local.example')).toThrow(/complete gift link/)
  }
})

it('does not weaken unsafe input or version limits when a gift is surrounded by prose', () => {
  const gift = gifts[2]!
  const hash = encodeGift(gift)
  const url = buildGiftLink(gift, 'https://sender.example')
  for (const input of [
    `A\u0000message ${url}`,
    `A\u200bmessage ${url}`,
    `A\u202emessage ${url}`,
    `Your gift: https://name:password@elsewhere.example/gifts/play${hash}`,
    `Your gift: file:///gifts/play${hash}`,
    `Your gift: ftp://elsewhere.example/gifts/play${hash}`,
    `Your gift: javascript:https://elsewhere.example/gifts/play${hash}`,
    `Your gift: https://elsewhere.example/not-a-gift${hash}`,
    `Your gift: https://elsewhere.example/gifts/play#gift=broken`,
    `${'x'.repeat(3000)}\n${url}`,
    `Your gift: https://sender.example/${'x'.repeat(1900)}/gifts/play${hash}`,
  ]) {
    expect(() => restoreGiftLink(input, 'https://local.example')).toThrow(/complete gift link/)
  }
  expect(() =>
    restoreGiftLink(`Your gift: ${url}`, 'https://local.example', '/' + 'x'.repeat(2000)),
  ).toThrow()
})
