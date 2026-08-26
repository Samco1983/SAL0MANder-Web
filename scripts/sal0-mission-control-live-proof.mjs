#!/usr/bin/env node
/**
 * Live proof: Mission Control creates one bounded test mission.
 *
 * Runs the real `githubMissionRequest()` dispatch/list/get contract from
 * `edge/mission-control/worker.js` against the real GitHub API, using the
 * already-authenticated `gh` CLI as the HTTP transport. This process never
 * reads, stores, or prints a token -- `gh` holds its own credential and this
 * script only ever sees `gh api`'s stdout.
 *
 * Rerunnable: every run creates a fresh, uniquely-titled test mission,
 * verifies it round-trips through the shipped contract exactly once, then
 * retires it so the live Mission Log carries no trace of it afterward.
 *
 * Usage: node scripts/sal0-mission-control-live-proof.mjs
 */
import { spawnSync } from 'node:child_process'
import { parseGhApiOutput, runLiveProof } from './lib/sal0-mission-control-live-proof.mjs'

const REPOSITORY = 'Samco1983/SAL0MANder-Web'

function fetchGitHubViaCli(url, init = {}) {
  const parsed = new URL(url)
  const args = ['api', `${parsed.pathname}${parsed.search}`, '--method', (init.method ?? 'GET').toUpperCase(), '-i']
  const spawnOptions = { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  if (init.body) {
    args.push('--input', '-')
    spawnOptions.input = typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  }
  const result = spawnSync('gh', args, spawnOptions)
  if (result.error) throw result.error
  return Promise.resolve(parseGhApiOutput(result.stdout ?? ''))
}

function preflight() {
  const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' })
  if (auth.status !== 0) {
    console.error('BLOCKED: `gh auth status` did not succeed. Run `gh auth login` first.')
    process.exit(2)
  }
}

async function main() {
  preflight()

  const env = { GITHUB_TOKEN: 'gh-cli-managed', GITHUB_REPOSITORY: REPOSITORY }
  console.log(`live proof: dispatching one bounded test mission against ${REPOSITORY}`)

  let evidence
  try {
    evidence = await runLiveProof(env, { fetchGitHub: fetchGitHubViaCli })
  } catch (error) {
    console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  console.log(`  title: ${evidence.title}`)
  for (const step of evidence.steps) {
    console.log(`  OK  ${step.step} ${JSON.stringify({ ...step, step: undefined })}`)
  }
  console.log('LIVE PROOF OK — one bounded test mission was created, verified, and retired')
  process.exit(0)
}

main()
