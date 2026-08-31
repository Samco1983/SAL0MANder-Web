import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerPicker } from './PlayerPicker'
import { MAX_PROFILES, createProfile, getActiveProfile } from '@auth/playerProfiles'

beforeEach(() => localStorage.clear())

describe('player picker', () => {
  it('offers presets so an empty box never invites a real name', () => {
    render(<PlayerPicker />)
    expect(screen.getByRole('button', { name: 'Player 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeInTheDocument()
  })

  it('picks a preset and says who is playing', async () => {
    const user = userEvent.setup()
    render(<PlayerPicker />)
    await user.click(screen.getByRole('button', { name: 'Player 1' }))

    expect(screen.getByRole('status')).toHaveTextContent('Playing as Player 1')
    expect(getActiveProfile()?.handle).toBe('Player 1')
  })

  it('accepts a made-up name', async () => {
    const user = userEvent.setup()
    render(<PlayerPicker />)

    await user.type(screen.getByLabelText('Or make one up'), 'Rocket')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(getActiveProfile()?.handle).toBe('Rocket')
  })

  it('lets a second player join the same device without taking the first one over', async () => {
    const user = userEvent.setup()
    render(<PlayerPicker />)

    await user.click(screen.getByRole('button', { name: 'Player 1' }))
    await user.click(screen.getByRole('button', { name: 'Player 2' }))

    expect(getActiveProfile()?.handle).toBe('Player 2')
    // Player 1 is still there to switch back to — a shared tablet is the point.
    expect(screen.getByRole('button', { name: 'Player 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('switches back to an existing player', async () => {
    const user = userEvent.setup()
    render(<PlayerPicker />)

    await user.click(screen.getByRole('button', { name: 'Player 1' }))
    await user.click(screen.getByRole('button', { name: 'Player 2' }))
    await user.click(screen.getByRole('button', { name: 'Player 1' }))

    expect(getActiveProfile()?.handle).toBe('Player 1')
  })

  it('explains a rejected name instead of looking like a broken button', async () => {
    const user = userEvent.setup()
    createProfile('Rocket')
    render(<PlayerPicker />)

    await user.type(screen.getByLabelText('Or make one up'), 'rocket')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Someone on this device is already using that name',
    )
  })

  it('says what to do when the device is full', async () => {
    const user = userEvent.setup()
    for (let i = 0; i < MAX_PROFILES - 1; i++) createProfile(`Kid ${i}`)
    render(<PlayerPicker />)

    await user.click(screen.getByRole('button', { name: 'Player 1' }))
    // The add controls disappear once full, rather than failing on submit.
    expect(screen.queryByLabelText('Or make one up')).not.toBeInTheDocument()
  })

  it('tells the reader where the name lives, without alarming a child', () => {
    render(<PlayerPicker />)
    expect(screen.getByText(/stay on this device and are never sent anywhere/i)).toBeInTheDocument()
    expect(screen.getByText(/nickname works better than a real name/i)).toBeInTheDocument()
  })

  it('reports the chosen player to the caller', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlayerPicker onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Player 1' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ handle: 'Player 1' }))
  })

  /**
   * The non-negotiable, asserted at the component boundary: nothing here is a
   * gate. The picker renders with no player chosen and demands nothing.
   */
  it('never demands a choice before anything else can happen', () => {
    render(<PlayerPicker />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Who's playing?" })).toBeInTheDocument()
  })
})
