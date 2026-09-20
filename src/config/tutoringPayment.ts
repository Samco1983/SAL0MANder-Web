/** Public display settings only. Google Calendar / Stripe owns payment and booking. */
export function readTutoringPayment(price: string, required: boolean, bookingUrl: string) {
  const input = price.trim()
  const valid = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(input)
  const [whole, fraction = ''] = input.split('.')
  const amount = valid ? Number(whole) * 100 + Number(fraction.padEnd(2, '0')) : 0
  const cents = amount > 0 ? amount : null
  return { cents, required: !!bookingUrl && cents !== null && required }
}

export function tutoringPriceLabel(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)
}
