import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { env, readEnv } from '@config/env'
import { PUBLIC_TUTORING_BOOKING_URL } from '@config/classroom'
import { LearningOffers } from './LearningOffers'
import { learningOfferLinks } from '@config/learningOffers'

vi.mock('@config/env', async (load) => {
  const original = await load<typeof import('@config/env')>()
  return {
    ...original,
    env: {
      ...original.env,
      get classroom() {
        return original.env.classroom
      },
      get sites() {
        return original.env.sites
      },
    },
  }
})

afterEach(() => vi.restoreAllMocks())

describe('optional learning offers', () => {
  it('uses the real default scheduler independently of the tutoring site origin', () => {
    const defaults = readEnv({})
    expect(learningOfferLinks(defaults.classroom.bookingUrl)).toMatchObject({
      tutoring: PUBLIC_TUTORING_BOOKING_URL,
      hasBooking: true,
    })
    vi.spyOn(env, 'sites', 'get').mockReturnValue({
      tutoring: 'https://salomandermath.com',
      puzzles: '',
    })
    render(<LearningOffers />)
    expect(screen.getByRole('link', { name: 'See tutoring times' })).toHaveAttribute(
      'href',
      PUBLIC_TUTORING_BOOKING_URL,
    )
    expect(screen.getByRole('link', { name: 'See tutoring times' })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(screen.getByRole('region', { name: 'Learning with Sam' })).toHaveTextContent(
      'Free puzzles and picture gifts stay free.',
    )
    expect(screen.getByRole('region', { name: 'Learning with Sam' })).toHaveTextContent(
      'planned membership tiers',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each(['', 'https://salomandermath.com', 'javascript:alert(1)'])(
    'offers an inquiry instead of a broken booking when configured as %s',
    (value) => {
      const configured = readEnv({ VITE_CLASSROOM_BOOKING_URL: value })
      vi.spyOn(env, 'classroom', 'get').mockReturnValue(configured.classroom)
      render(<LearningOffers compact />)
      const inquiry = screen.getByRole('link', { name: 'Ask about tutoring' })
      expect(inquiry).toHaveAttribute(
        'href',
        'mailto:sal@salomandermath.com?subject=Tutoring%20inquiry',
      )
      expect(inquiry).not.toHaveAttribute('target')
      expect(screen.queryByRole('link', { name: 'Tutoring with Sam' })).toBeNull()
      expect(screen.getByRole('link', { name: /Packets & curriculum inquiry/ })).toHaveAttribute(
        'href',
        expect.stringContaining('mailto:sal@salomandermath.com?subject='),
      )
    },
  )
})
