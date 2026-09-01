import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('App composition root', () => {
  it('mounts the real router inside the theme provider', async () => {
    render(<App />)

    expect(await screen.findByRole('link', { name: /try a sample activity/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /theme: system/i })).toBeVisible()
    expect(document.documentElement.dataset.theme).toMatch(/light|dark/)
  })
})
