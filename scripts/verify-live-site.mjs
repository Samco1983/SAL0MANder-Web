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

const base = (process.argv[2] ?? '').replace(/\/?$/, '/')
if (!base.startsWith('http')) {
  console.error('usage: node scripts/verify-live-site.mjs <deployed-url>')
  process.exit(2)
}

const failures = []
const bust = () => `?_=${Date.now()}-${Math.random().toString(36).slice(2)}`

async function get(path) {
  const url = new URL(path, base).toString() + bust()
  const r = await fetch(url, { cache: 'no-store', redirect: 'follow' })
  return { status: r.status, body: await r.text(), url }
}

/* CANARY FIRST. If a nonsense path returns real content, something between us
 * and the site is answering on its behalf and NOTHING below can be trusted.
 * Better to refuse to judge than to report a confident wrong answer. */
const canary = await get(`__sal0_canary_${Math.random().toString(36).slice(2)}__.txt`)
if (canary.status === 200 && canary.body.length > 0 && !/<!doctype html>/i.test(canary.body)) {
  console.error('UNKNOWN  a bogus path returned content — an intermediary is answering, not the site')
  console.error(`         ${canary.status}, ${canary.body.length} bytes`)
  process.exit(2)
}

const home = await get('')

/* 1. The document must reference assets under the deploy base. This is the
 *    exact defect that shipped: un-prefixed hrefs resolve to the domain root,
 *    every asset 404s, React never mounts, and the page renders blank while
 *    still answering 200. */
const refs = localAssetRefs(home.body)
const basePath = new URL(base).pathname
const scripts = refs.filter((r) => r.endsWith('.js'))
if (scripts.length === 0) {
  failures.push(`the homepage references no javascript at all (${home.body.length} bytes) — it cannot be the app`)
}
for (const r of scripts) {
  if (r.startsWith('/') && !r.startsWith(basePath)) {
    failures.push(`asset "${r}" sits outside the deploy base "${basePath}" — the browser will request it from the wrong origin path and the page will render blank`)
  }
}

/* 2. Those assets must actually be fetchable, with real bytes. A correct href
 *    to a file that was never uploaded fails identically for a student. */
for (const r of scripts.slice(0, 3)) {
  const a = await get(r)
  if (a.status !== 200 || a.body.length < 100) {
    failures.push(`asset ${r} -> ${a.status}, ${a.body.length} bytes — referenced but not served`)
  }
}

/* 3. The SPA fallback. Pages has no rewrite, so a hard load of a share link is
 *    answered with 404.html; without it, every link a teacher pastes is dead
 *    while still working in-app, which is the one way links are actually used. */
const deep = await get('play/demo-activity')
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

console.log(`live: ${base}`)
console.log(`  homepage ${home.body.length} bytes, ${scripts.length} script ref(s)`)
console.log(`  share link ${deep.body.length} bytes`)
for (const f of failures) console.log(`  FAIL  ${f}`)
console.log(failures.length === 0 ? 'LIVE SITE OK' : `LIVE SITE BROKEN — ${failures.length} fault(s)`)
process.exit(failures.length === 0 ? 0 : 1)
