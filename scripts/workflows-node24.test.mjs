import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowsDir = resolve(import.meta.dirname, '../.github/workflows')

describe('GitHub Actions workflows stay off deprecated Node 20 action majors', () => {
  it('uses Node 24 action majors in deploy.yml and preserves dotfiles for .nojekyll', () => {
    const deploy = readFileSync(resolve(workflowsDir, 'deploy.yml'), 'utf8')
    expect(deploy).not.toMatch(/actions\/checkout@v[1-4]\b/)
    expect(deploy).not.toMatch(/actions\/setup-node@v[1-4]\b/)
    expect(deploy).not.toMatch(/actions\/upload-pages-artifact@v[1-4]\b/)
    expect(deploy).not.toMatch(/actions\/deploy-pages@v[1-4]\b/)

    expect(deploy).toContain('actions/checkout@v6')
    expect(deploy).toContain('actions/setup-node@v6')
    expect(deploy).toContain('actions/upload-pages-artifact@v5')
    expect(deploy).toContain('include-hidden-files: true')
    expect(deploy).toContain('actions/deploy-pages@v5')
  })

  it('uses Node 24 action majors in verify.yml', () => {
    const verify = readFileSync(resolve(workflowsDir, 'verify.yml'), 'utf8')
    expect(verify).not.toMatch(/actions\/checkout@v[1-4]\b/)
    expect(verify).not.toMatch(/actions\/setup-node@v[1-4]\b/)
    expect(verify).toContain('actions/checkout@v6')
    expect(verify).toContain('actions/setup-node@v6')
  })
})
