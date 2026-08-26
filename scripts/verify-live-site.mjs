#!/usr/bin/env node
/**
 * The last check of all: does the PUBLISHED site work for a visitor?
 *
 * Everything else in this pipeline inspects dist/ — our own output, on our own
 * runner, before anything ships. That is a mirror. It told us the site was fine
 * for three days while samco1983.github.io served a blank page and every
 * teacher's share link 404'd, because a later step rebuilt dist and destroyed
 * the artifact each earlier check had certified.
 *
 * So this one runs AFTER deployment, against the real URL, over the public
 * internet. It is the only check here that can fail for reasons our repo
 * cannot see.
 *
 * ASSERTS ON CONTENT, NEVER ON STATUS. A 200 means a server answered, not that
 * a student got a lesson — and this project has already been burned by a proxy
 * that answered every request with an empty 200 and turned a whole scoreboard
 * green. Every assertion below reads bytes.
 *
 * Usage: node scripts/verify-live-site.mjs https://samco1983.github.io/SAL0MANder-Web/
 */
import { localAssetRefs } from './verify-deploy-artifact.mjs'

const bust = () => `?_=${Date.now()}-${Math.random().toString(36).slice(2)}`

async function get(base, path) {
  const url = new URL(path, base).toString() + bust()
  const r = await fetch(url, { cache: 'no-store', redirect: 'follow' })
  return { status: r.status, body: await r.text(), url }
}

/* 502/503/504 right after a fresh deploy is CDN edge propagation, not a real
 * failure — GitHub Pages has repeatedly shown a hashed asset settle within
 * seconds of a deploy that just published it (the `pages-outage-hotfix`
 * pattern, PRs #54/#55, and the run this retry was added because of). A real
 * missing-asset bug (404, or a 200 with the wrong bytes) is not a gateway
 * status and must still fail immediately — retrying those would just make a
 * genuine outage take longer to report. */
export const isTransientGatewayStatus = (status) => status === 502 || status === 503 || status === 504

export async function getWithRetries(base, path, { attempts = 4, delayMs = 3000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await get(base, path)
    if (!isTransientGatewayStatus(last.status)) return last
    if (attempt < attempts) await sleep(delayMs)
  }
  return last
}

export async function verifyLiveSite(base) {
  const failures = []

  /* CANARY FIRST. If a nonsense path returns real content, something between us
   * and the site is answering on its behalf and NOTHING below can be trusted.
   * Better to refuse to judge than to report a confident wrong answer. */
  const canary = await get(base, `__sal0_canary_${Math.random().toString(36).slice(2)}__.txt`)
  if (canary.status === 200 && canary.body.length > 0 && !/<!doctype html>/i.test(canary.body)) {
    return {
      unknown: true,
      lines: [
        'UNKNOWN  a bogus path returned content — an intermediary is answering, not the site',
        `         ${canary.status}, ${canary.body.length} bytes`,
      ],
    }
  }

  const home = await get(base, '')

  /* 1. The document must reference assets under the deploy base. This is the
   *    exact defect that shipped: un-prefixed hrefs resolve to the domain root,
   *    every asset 404s, React never mounts, and the page renders blank while
   *    still answering 200. */
  const refs = localAssetRefs(home.body)
  const basePath = new URL(base).pathname
  const scripts = refs.filter((r) => r.split(/[?#]/, 1)[0].endsWith('.js'))
  if (scripts.length === 0) {
    failures.push(`the homepage references no javascript at all (${home.body.length} bytes) — it cannot be the app`)
  }
  for (const r of refs) {
    if (!r.startsWith('/')) {
      failures.push(`asset "${r}" is relative — it resolves differently from deep links and must be rooted at the deploy base`)
    } else if (!r.startsWith(basePath)) {
      failures.push(`asset "${r}" sits outside the deploy base "${basePath}" — the browser will request it from the wrong origin path and the page will render blank`)
    }
  }

  /* 2. Every local asset must actually be fetchable, with real bytes. A correct href
   *    to a file that was never uploaded fails identically for a student. */
  for (const r of refs.filter((ref) => ref.startsWith(basePath))) {
    const a = await getWithRetries(base, r)
    if (a.status !== 200 || a.body.length === 0) {
      failures.push(`asset ${r} -> ${a.status}, ${a.body.length} bytes — referenced but not served`)
    }
  }

  /* 3. The SPA fallback. Pages has no rewrite, so a hard load of a share link is
   *    answered with 404.html; without it, every link a teacher pastes is dead
   *    while still working in-app, which is the one way links are actually used. */
  const deep = await get(base, 'play/demo-activity')
  /*
   * "Is it HTML and biggish" is NOT enough, and I shipped that version by
   * accident: GitHub's own 404 page is 9kB of valid HTML, so the weak assertion
   * passed while every share link was dead. The fallback must serve OUR app —
   * meaning the same script references the homepage carries. Anything else is a
   * stranger's page wearing a 200.
   */
  const deepRefs = localAssetRefs(deep.body)
  const servesOurApp = scripts.length > 0 && scripts.some((s) => deepRefs.includes(s))
  if (!servesOurApp) {
    const whose = /GitHub Pages/i.test(deep.body) ? "GitHub's 404 page, not ours" : 'not the app'
    failures.push(`a share link (/play/demo-activity) served ${whose} (${deep.body.length} bytes) — every link a teacher pastes is dead on a hard load`)
  }

  return {
    unknown: false,
    failures,
    lines: [
      `live: ${base}`,
      `  homepage ${home.body.length} bytes, ${scripts.length} script ref(s)`,
      `  share link ${deep.body.length} bytes`,
      ...failures.map((f) => `  FAIL  ${f}`),
      failures.length === 0 ? 'LIVE SITE OK' : `LIVE SITE BROKEN — ${failures.length} fault(s)`,
    ],
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('verify-live-site.mjs')
if (isMain) {
  const base = (process.argv[2] ?? '').replace(/\/?$/, '/')
  if (!base.startsWith('http')) {
    console.error('usage: node scripts/verify-live-site.mjs <deployed-url>')
    process.exit(2)
  }

  const result = await verifyLiveSite(base)
  const log = result.unknown ? console.error : console.log
  for (const line of result.lines) log(line)
  process.exit(result.unknown ? 2 : result.failures.length === 0 ? 0 : 1)
}
