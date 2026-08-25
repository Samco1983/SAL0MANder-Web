import { describe, expect, it } from 'vitest'
import { parseGhApiOutput, parseIssueUrl, runLiveProof } from './sal0-mission-control-live-proof.mjs'

function jsonResponse(body, status = 200, headersValue = {}) {
  const headers = new Headers(headersValue)
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers,
    async json() {
      return body
    },
  })
}

/** A minimal in-memory GitHub Issues API, just real enough that the actual
 * `githubMissionRequest()` dispatch/list/get/patch calls behave the same way
 * they would against the live API. */
function fakeGitHub() {
  const issues = new Map()
  let nextNumber = 900

  function payload(issue) {
    return {
      id: 9000 + issue.number,
      number: issue.number,
      html_url: `https://github.com/Samco1983/SAL0MANder-Web/issues/${issue.number}`,
      state: issue.state,
      updated_at: issue.updatedAt,
      body: issue.body,
    }
  }

  async function fetchGitHub(url, init = {}) {
    const parsed = new URL(url)
    const method = (init.method ?? 'GET').toUpperCase()

    if (method === 'POST' && parsed.pathname.endsWith('/issues')) {
      const input = JSON.parse(init.body)
      const number = nextNumber
      nextNumber += 1
      const issue = { number, state: 'open', body: input.body, updatedAt: new Date().toISOString() }
      issues.set(number, issue)
      return jsonResponse(payload(issue))
    }

    const issueMatch = /\/issues\/(\d+)$/.exec(parsed.pathname)
    if (issueMatch) {
      const number = Number(issueMatch[1])
      const issue = issues.get(number)
      if (!issue) return jsonResponse({ message: 'Not Found' }, 404)
      if (method === 'PATCH') {
        const input = JSON.parse(init.body)
        if (input.body !== undefined) issue.body = input.body
        if (input.state !== undefined) issue.state = input.state
        issue.updatedAt = new Date().toISOString()
      }
      return jsonResponse(payload(issue))
    }

    if (method === 'GET' && parsed.pathname.endsWith('/issues')) {
      const all = [...issues.values()]
        .sort((a, b) => b.number - a.number)
        .map((issue) => payload(issue))
      return jsonResponse(all)
    }

    throw new Error(`unhandled fake GitHub request: ${method} ${url}`)
  }

  return { fetchGitHub, issues }
}

const env = { GITHUB_TOKEN: 'test-token', GITHUB_REPOSITORY: 'Samco1983/SAL0MANder-Web' }
const instant = () => Promise.resolve()

describe('runLiveProof', () => {
  it('creates exactly one mission, verifies it, then retires it so it leaves no trace', async () => {
    const { fetchGitHub, issues } = fakeGitHub()

    const evidence = await runLiveProof(env, { fetchGitHub, title: 'Live proof — one bounded mission', sleep: instant })

    expect(evidence.steps.map((step) => step.step)).toEqual([
      'dispatch',
      'bounded_at_creation',
      'single_mission_fetch',
      'retired',
      'bounded_after_retirement',
    ])

    expect(issues.size).toBe(1)
    const [issue] = issues.values()
    expect(issue.state).toBe('closed')
    expect(issue.body).not.toContain('sal0-mission-control:v1')
  })

  it('is rerunnable: a second run creates its own independent bounded mission', async () => {
    const { fetchGitHub, issues } = fakeGitHub()

    const first = await runLiveProof(env, { fetchGitHub, title: 'Live proof run one', sleep: instant })
    const second = await runLiveProof(env, { fetchGitHub, title: 'Live proof run two', sleep: instant })

    expect(first.steps[0].missionId).not.toBe(second.steps[0].missionId)
    expect(issues.size).toBe(2)
    for (const issue of issues.values()) expect(issue.state).toBe('closed')
  })

  it('fails loudly rather than reporting success when dispatch is rejected', async () => {
    const fetchGitHub = () => jsonResponse({ message: 'nope' }, 500)

    await expect(runLiveProof(env, { fetchGitHub, title: 'Live proof failure case', sleep: instant })).rejects.toThrow(
      /dispatch failed/,
    )
  })

  it('fails loudly rather than reporting success when the test mission cannot be retired', async () => {
    const { fetchGitHub: real } = fakeGitHub()
    const fetchGitHub = (url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'PATCH') return jsonResponse({ message: 'nope' }, 500)
      return real(url, init)
    }

    await expect(runLiveProof(env, { fetchGitHub, title: 'Live proof retire failure', sleep: instant })).rejects.toThrow(
      /could not retire/,
    )
  })
})

describe('parseGhApiOutput', () => {
  it('splits `gh api -i` output into status, headers, and a parsed JSON body', async () => {
    const stdout = [
      'HTTP/2.0 201 Created',
      'Content-Type: application/json; charset=utf-8',
      'Link: <https://api.github.com/repos/o/r/issues?page=2>; rel="next"',
      '',
      '{"number":42,"html_url":"https://github.com/o/r/issues/42"}',
    ].join('\n')

    const result = parseGhApiOutput(stdout)

    expect(result.ok).toBe(true)
    expect(result.status).toBe(201)
    expect(result.headers.get('Content-Type')).toContain('application/json')
    expect(result.headers.get('Link')).toContain('rel="next"')
    await expect(result.json()).resolves.toEqual({ number: 42, html_url: 'https://github.com/o/r/issues/42' })
  })

  it('marks non-2xx statuses as not ok, matching the real fetch Response contract', async () => {
    const stdout = ['HTTP/2.0 404 Not Found', 'Content-Type: application/json', '', '{"message":"Not Found"}'].join(
      '\n',
    )

    const result = parseGhApiOutput(stdout)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })
})

describe('parseIssueUrl', () => {
  it('extracts owner, repo, and issue number from a github.com issue url', () => {
    expect(parseIssueUrl('https://github.com/Samco1983/SAL0MANder-Web/issues/64')).toEqual({
      owner: 'Samco1983',
      repo: 'SAL0MANder-Web',
      number: '64',
    })
  })

  it('rejects anything that is not a github.com issue url', () => {
    expect(() => parseIssueUrl('https://example.com/not-an-issue')).toThrow()
  })
})
