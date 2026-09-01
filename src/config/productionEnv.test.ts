import { describe, expect, it } from 'vitest'
import { readEnv } from './env'

/**
 * The deploy sets `VITE_APP_ENV`. This pins what depends on it.
 *
 * Until 2026-08-30 the workflow never set it, so the production build fell back
 * to the schema's `'local'` default and the public site rendered as a developer
 * preview — "Foundation preview — placeholder visual design" across the top, an
 * "env: local · api: mock" footer, and every `<PlaceholderNotice>` listing what
 * had not been built. Nothing failed. The site simply told teachers it was
 * unfinished.
 */
describe('production environment', () => {
  it('is not production unless VITE_APP_ENV says so — the deploy must set it', () => {
    const fellBack = readEnv({})
    expect(fellBack.appEnv).toBe('local')
    expect(fellBack.isProd).toBe(false)
  })

  it('turns on every production gate when the deploy sets it', () => {
    const deployed = readEnv({ VITE_APP_ENV: 'production' })
    expect(deployed.appEnv).toBe('production')
    // isProd is the single flag behind the banner, the diagnostics footer,
    // every PlaceholderNotice, and the internal nav links.
    expect(deployed.isProd).toBe(true)
  })

  it('does not treat staging or development as production', () => {
    expect(readEnv({ VITE_APP_ENV: 'staging' }).isProd).toBe(false)
    expect(readEnv({ VITE_APP_ENV: 'development' }).isProd).toBe(false)
  })
})
