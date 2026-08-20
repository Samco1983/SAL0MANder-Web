import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const repo = process.env.SAL0_REPO || '/Users/samuel_saldivar/Desktop/SAL0MANder-Web'
const repoSlug = 'Samco1983/SAL0MANder-Web'
const blockersPath = join(repo, 'docs/coordination/BLOCKERS.md')
const outPath = join(repo, 'docs/coordination/ops/CURRENT-TASK.md')

const agent = process.env.SAL0_AGENT || 'SAL0-04'
const aliases = new RegExp(process.env.SAL0_AGENT_ALIASES || 'claude|SAL0-04', 'i')

function field(block, name) {
  const match = block.match(new RegExp(`^${name}:[^\\S\\n]*(.*)$`, 'm'))
  return match ? match[1].trim() : ''
}

function findAutoBlocker() {
  if (!existsSync(blockersPath)) return null
  const text = readFileSync(blockersPath, 'utf8').replace(/```[\s\S]*?```/g, '')
  const blocks = text.split(/^### /m).slice(1)

  for (const block of blocks) {
    if (field(block, 'CLEARED')) continue
    if (field(block, 'AUTO').toLowerCase() !== 'yes') continue
    if (!aliases.test(field(block, 'WHO CAN'))) continue

    return {
      title: block.split('\n', 1)[0].trim(),
      why: field(block, 'BLOCKED'),
      command: field(block, 'COMMAND'),
    }
  }
  return null
}

function ghIssueList() {
  const result = spawnSync(
    'gh',
    ['issue', 'list', '--repo', repoSlug, '--state', 'open', '--json', 'number,title,body,labels', '--limit', '100'],
    { cwd: repo, encoding: 'utf8', timeout: 20000 },
  )

  if (result.error?.code === 'ENOENT') {
    throw new Error('gh not found')
  }
  if (result.status !== 0) {
    throw new Error(`could not read GitHub issues: ${result.stderr || result.stdout}`.trim())
  }
  return JSON.parse(result.stdout || '[]')
}

function findIssue() {
  const issues = ghIssueList()
  return (
    issues
      .filter((issue) => issue.title.toUpperCase().includes('[WEB]'))
      .filter((issue) => {
        const labels = (issue.labels || []).map((label) => String(label.name || '').toLowerCase())
        return !labels.includes('in-progress') && !labels.includes('blocked')
      })
      .sort((a, b) => a.number - b.number)[0] || null
  )
}

function atomicWrite(path, body) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, body)
  renameSync(tmp, path)
}

function blockerTask(blocker) {
  return `You are ${agent}. Clear a blocker another agent published. This outranks the
issue queue: a blocker is already stopping work.

BLOCKER:
${blocker.title}

WHY IT IS STUCK:
${blocker.why}

WHAT CLEARS IT:
${blocker.command}

RULES:
- Work only in ${repo}. Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read docs/coordination/AGENT-DOCTRINE.md first. It binds you.
- Do the thing. Do not write a document about the thing.
- Never read, print, move, or commit secrets, tokens, .env files, or auth files.
- Never run destructive git: no reset --hard, clean -fd, checkout -f, rebase,
  force push, or remote changes.
- Run \`npm run verify\`. It must pass. Check the exit code, not the words.
- Do not commit. The loop commits if and only if verify passes.

WHEN DONE, edit docs/coordination/BLOCKERS.md and fill in that entry:
  CLEARED:   <current UTC> ${agent}
  HUMAN:     no

Set HUMAN to \`yes\` ONLY if a person was asked or intervened. That field is the
experiment: an entry cleared with HUMAN: yes is evidence of a relay, which is
the thing this replaces. If you cannot clear it, leave both fields empty and say
exactly what stopped you.

END YOUR REPLY WITH:
ONE THING THAT CHANGED: <what changed, or NOTHING CHANGED>
ONE THING STILL UNVERIFIED: <what you could not check>
`
}

function issueTask(issue) {
  return `You are ${agent}. Work GitHub issue #${issue.number}.

TITLE:
${issue.title}

ISSUE BODY:
${issue.body || '(no description)'}

RULES:
- Work only in ${repo}. Never touch /Users/samuel_saldivar/SAL0MANDER-Puzzle-Prototype.
- Read CLAUDE.md, docs/CHARTER-WEB-POINT-PERSON.md and
  docs/coordination/AGENT-DOCTRINE.md first. They bind you.
- Change code. Do not write a proposal or a plan document unless the issue
  explicitly asks for a written artifact.
- Scope: one coherent batch toward this issue. Do not start a second issue.
- Never read, print, move, or commit secrets, tokens, .env files, or auth files.
- Never run destructive git: no reset --hard, clean -fd, checkout -f, rebase,
  force push, or remote changes.
- Run \`npm run verify\`. It must pass. Check the exit code, not the words.
- Do not commit. The loop commits if and only if verify passes.

IF SOMETHING STOPS YOU, publish it rather than waiting. Append an entry to
docs/coordination/BLOCKERS.md in the existing format, with AUTO: yes only for
safe code changes. Then keep working on something else. Never idle.

WHEN YOU FINISH, end your reply with exactly these three lines:
ISSUE: ${issue.number}
ONE THING THAT CHANGED: <what changed, or NOTHING CHANGED>
ONE THING STILL UNVERIFIED: <what you could not check>
`
}

const blocker = findAutoBlocker()
if (blocker) {
  atomicWrite(outPath, blockerTask(blocker))
  console.log(`blocker: ${blocker.title}`)
  process.exit(0)
}

try {
  const issue = findIssue()
  if (!issue) {
    console.error(`NOTHING QUEUED - no auto blockers for ${agent}, no unclaimed [WEB] issues`)
    process.exit(2)
  }
  atomicWrite(outPath, issueTask(issue))
  console.log(`issue: ${issue.number}`)
} catch (error) {
  console.error(`BLOCKED - NEED OWNER - ${error.message}`)
  process.exit(1)
}
