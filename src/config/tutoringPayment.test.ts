import { describe, expect, it } from 'vitest'
import { readTutoringPayment, tutoringPriceLabel } from './tutoringPayment'
import { readEnv } from './env'

describe('tutoring payment display', () => {
  it('does not claim Stripe is connected without an approved price and booking page', () => {
    expect(readEnv({}).classroom.payment).toEqual({ cents: null, required: false })
    expect(readTutoringPayment('45', false, 'https://calendar.app.google/abcdefgh').required).toBe(
      false,
    )
    expect(readTutoringPayment('45', true, '').required).toBe(false)
    expect(
      readEnv({
        VITE_TUTORING_PRICE_USD: '45',
        VITE_TUTORING_PAYMENTS_REQUIRED: 'true',
        VITE_CLASSROOM_BOOKING_URL: 'https://example.com',
      }).classroom.payment.required,
    ).toBe(false)
  })
  it.each(['', '-45', '0', '0.00', '1e3', 'NaN', 'Infinity', '45.123', '$45', '45,00'])(
    'rejects an invalid USD price: %s',
    (price) => {
      expect(readTutoringPayment(price, true, 'https://calendar.app.google/abcdefgh')).toEqual({
        cents: null,
        required: false,
      })
    },
  )
  it('parses cents exactly and formats only the agreed amount', () => {
    expect(readTutoringPayment('45.50', true, 'https://calendar.app.google/abcdefgh')).toEqual({
      cents: 4550,
      required: true,
    })
    expect(tutoringPriceLabel(4550)).toBe('$45.50')
    expect(tutoringPriceLabel(4500)).toBe('$45')
  })
})
