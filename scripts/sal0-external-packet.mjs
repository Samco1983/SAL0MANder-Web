#!/usr/bin/env node
/**
 * Build a redacted Mission Control packet for external/manual agent handoff.
 *
 * The council packet contains full coordination document bodies. That is useful
 * locally, but too broad for routine handoff to another model. This packet keeps
 * the source pointers, role names, repo state, and recent commits while omitting
 * document bodies and secrets-shaped lines.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const COORDINATION_DIR = join(ROOT, 'docs', 'coordination')
const OPS_DIR = join(COORDINATION_DIR, 'ops')
const OUT_FILE = join(OPS_DIR, 'EXTERNAL-HANDOFF-LATEST.json')
const ROLES_FILE = join(COORDINATION_DIR, 'AGENT_ROLES.json')

const SOURCE_FILES = [
  'docs/coordination/CURRENT_STATE.md',
  'docs/coordination/MISSION-CONTROL-CORE.md',
  'docs/coordination/SESSION-FAILSAFES.md',
  'docs/coordination/SURFACE-MAP.md',
  'docs/coordination/EVIDENCE-PROMPTS.md',
  'docs/coordination/PROPOSAL-EXECUTE-STAGE.md',
]

const SECRET_LINE = /\b(token|secret|password|credential|api[_ -]?key|auth\.json|\.env)\b/i

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp-${process.pid}`
  writeFileSync(tempPath, contents)
  renameSync(tempPath, path)
}

function fileSummary(path) {
  const fullPath = join(ROOT, path)
  if (!existsSync(fullPath)) {
    return { path, exists: false }
  }
  const body = readFileSync(fullPath, 'utf8')
  const safeLines = body.split('\n').filter((line) => !SECRET_LINE.test(line))
  const headings = safeLines
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
    .slice(0, 12)
  return {
    path,
    exists: true,
    lineCount: body.split('\n').length,
    headings,
    redaction: 'body omitted; secret-shaped lines excluded from derived headings',
  }
}

function recentCommits() {
  return git(['log', '-10', '--format=%h%x00%s'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('\0')
      return { hash, subject }
    })
}

function roleSummary() {
  const roles = JSON.parse(readFileSync(ROLES_FILE, 'utf8'))
  return {
    controlLayer: roles.controlLayer?.displayName ?? 'Mission Control Core',
    agents: roles.agents.map((agent) => ({
      id: agent.id,
      number: agent.number,
      displayName: agent.displayName,
      role: agent.clearRole,
      lane: agent.primaryLane,
      surfaceLabel: agent.surfaceLabel,
    })),
  }
}

function packetHash(packet) {
  return createHash('sha256').update(JSON.stringify(packet, null, 2)).digest('hex')
}

const packet = {
  schemaVersion: 'sal0-external-handoff-packet-v0',
  createdAt: new Date().toISOString(),
  repo: {
    root: ROOT,
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', '--short', 'HEAD']),
    status: git(['status', '--short']),
  },
  missionControl: roleSummary(),
  sourcePointers: SOURCE_FILES.map(fileSummary),
  recentCommits: recentCommits(),
  rules: [
    'Use this as a redacted orientation packet only.',
    'Do not infer hidden document contents from omitted bodies.',
    'Ask for a specific file excerpt when more context is required.',
    'Do not touch Unity, secrets, auth files, live Make scenarios, or unrelated repos.',
  ],
}

packet.hash = packetHash(packet)
atomicWrite(OUT_FILE, `${JSON.stringify(packet, null, 2)}\n`)
console.log(`wrote ${OUT_FILE}`)
console.log(`hash ${packet.hash}`)
