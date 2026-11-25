import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const oxlintPath = resolve(import.meta.dirname, '../.oxlintrc.json')

describe('oxlint no-console configuration for CLI scripts', () => {
  it('keeps eslint/no-console enabled for app source while permitting CLI stdout in scripts/', () => {
    const config = JSON.parse(readFileSync(oxlintPath, 'utf8'))
    expect(config.rules['eslint/no-console']).toEqual(['warn', { allow: ['warn', 'error'] }])

    const scriptsOverride = config.overrides.find(
      (entry) =>
        Array.isArray(entry.files) &&
        entry.files.includes('scripts/**/*.mjs') &&
        entry.rules?.['eslint/no-console'] === 'off',
    )
    expect(scriptsOverride).toBeDefined()
  })
})
