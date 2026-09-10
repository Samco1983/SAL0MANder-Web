import { expect, it } from 'vitest'
import { giftOriginCopy } from './giftOrigin'

it.each([
  'http://localhost:5184',
  'https://LOCALHOST.',
  'http://preview.localhost:5184',
  'http://127.0.0.1:5184',
  'http://127.42.3.4',
  'http://[::1]:5184',
])('keeps a local-only notice for loopback origin %s', (origin) => {
  expect(giftOriginCopy(origin).summary).toContain('Local preview')
  expect(giftOriginCopy(origin).notice).toContain('only open on this computer')
})

it.each([
  'https://sal0mander.com',
  'https://samco1983.github.io',
  'https://preview.example.test',
  'http://192.168.1.10:5184',
  'https://localhost.example.com',
])('does not infer deployment or delivery from non-loopback origin %s', (origin) => {
  const copy = giftOriginCopy(origin)
  expect(copy.summary).toBe('Nine pieces · No account needed')
  expect(copy.notice).toBe(
    'Share the full link. Recipients need access to this website to open the gift.',
  )
})
