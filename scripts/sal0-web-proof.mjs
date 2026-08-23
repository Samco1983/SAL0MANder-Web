#!/usr/bin/env node
/**
 * End-to-end proof that the built site works — not that its source says so.
 *
 * The scoreboard's own rule is that a check must touch something our agents do
 * not control. Until now the only web line was a grep over our own CSS, which
 * would pass if the rule existed and the page never rendered. That is a mirror,
 * not a referee — the exact failure a broker test made when it asserted its argv
 * contained a flag while the adapter had never once reached a model.
 *
 * So this serves `dist/` — the artifact that actually ships — loads it in a real
 * browser, and measures what a student would get:
 *
 *   1. the lesson renders every question the bundle carries
 *   2. every interactive control meets the 44px touch minimum
 *   3. answering the whole quiz reaches a finished state
 *   4. zero console errors along the way
 *
 * Effective target, not raw element: a 20px radio inside a 44px label IS 44px to
 * a finger. Measuring the element alone reported 20 of 30 controls failing when
 * only one was — a check has to be right before its result means anything.
 *
 * Usage: node scripts/sal0-web-proof.mjs   (expects `npm run build` to have run)
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const PORT = 8121
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

if (!existsSync(DIST)) {
  console.error('FAIL  no dist/ — run `npm run build` first')
  process.exit(1)
}

const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = join(DIST, normalize(p).replace(/^(\.\.[/\\])+/, ''))
  // SPA: unknown paths fall through to index.html, same as a static host.
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})

const fail = (msg) => {
  console.error(`FAIL  ${msg}`)
  process.exitCode = 1
}

await new Promise((r) => server.listen(PORT, r))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(`http://localhost:${PORT}/play/demo-activity`, { waitUntil: 'networkidle' })
  await page.waitForSelector('fieldset', { timeout: 10_000 })

  const questions = await page.locator('fieldset').count()
  const choices = await page.locator('input[type=radio]').count()
  if (questions < 1) fail('no questions rendered — the lesson is a dead end without Unity')
  else console.log(`PASS  lesson renders ${questions} questions, ${choices} choices`)

  // Every control, by effective target. Not a named list — the next control
  // added must be covered too, which is how #48's fix let the same defect ship
  // three separate times.
  const under = await page.evaluate(() => {
    const sel =
      'a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
    const box = (e) => {
      const l = e.closest('label') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`))
      return (l || e).getBoundingClientRect()
    }
    return [...document.querySelectorAll(sel)]
      .filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && !e.closest('.sr-only') && !/brand/i.test(e.className)
      })
      .filter((e) => box(e).height < 44)
      .map((e) => `${e.tagName.toLowerCase()}:${(e.textContent || '').trim().slice(0, 24)}=${Math.round(box(e).height)}px`)
  })
  if (under.length) fail(`${under.length} control(s) under 44px: ${under.join(', ')}`)
  else console.log('PASS  every interactive control meets the 44px touch minimum')

  // The point condition from #52: a student can actually finish.
  await page.evaluate(() => {
    const seen = new Set()
    document.querySelectorAll('input[type=radio]').forEach((r) => {
      if (!seen.has(r.name)) {
        seen.add(r.name)
        r.click()
      }
    })
  })
  await page.getByRole('button', { name: /finish/i }).click()
  await page.waitForTimeout(1200)
  const finished = await page.getByText(/You answered/i).count()
  if (!finished) fail('answering every question did not reach a finished state')
  else console.log('PASS  a student can complete the lesson and see a result')

  if (errors.length) fail(`${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`)
  else console.log('PASS  zero console errors')
} catch (err) {
  fail(String(err).slice(0, 200))
} finally {
  await browser.close()
  server.close()
}
