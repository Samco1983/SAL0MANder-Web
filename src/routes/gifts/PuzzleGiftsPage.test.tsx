import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@app/providers/ThemeProvider'
import { GIFT_SURVEY } from '@/gifts/giftSurvey'
import { decodeGift, restoreGiftLink } from '@/gifts/giftLink'
import { giftOriginCopy } from '@/gifts/giftOrigin'
import { PuzzleGiftsPage } from './PuzzleGiftsPage'

function show() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <PuzzleGiftsPage />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
afterEach(() => vi.unstubAllGlobals())
async function answerNine(user: ReturnType<typeof userEvent.setup>) {
  for (let index = 0; index < GIFT_SURVEY.length; index++) {
    const item = GIFT_SURVEY[index]!
    if (item.id === 'ice-cream')
      await user.type(screen.getByRole('textbox', { name: item.ask }), 'Pistachio')
    else await user.click(screen.getByRole('button', { name: item.suggestions[0] }))
    await user.click(
      screen.getByRole('button', { name: index === 8 ? 'Review favorites' : 'Next favorite' }),
    )
  }
}
function sharedGift() {
  return decodeGift(
    new URL(screen.getByRole('textbox', { name: 'Share link' }).getAttribute('value')!).hash,
  )
}

it('describes sharing for the current origin without a hardcoded unpublished claim', () => {
  show()
  const copy = giftOriginCopy(window.location.origin)
  expect(screen.getByText(copy.summary)).toBeVisible()
  expect(screen.getByText((content) => content.includes(copy.notice))).toBeVisible()
  expect(screen.queryByText(/Local prototype|not live public gifts yet/)).toBeNull()
})

it('offers gift recovery and a complete selectable backup when clipboard access fails', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
  show()
  expect(screen.getByRole('link', { name: 'Open a gift' })).toHaveAttribute('href', '/gifts/play')
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await user.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  const field = screen.getByRole('textbox', { name: 'Full backup code' }) as HTMLTextAreaElement
  expect(field).toHaveAttribute('readonly')
  expect(field).not.toBeDisabled()
  expect(restoreGiftLink(field.value, window.location.origin)).toBe(
    screen.getByRole('link', { name: 'Open gift' }).getAttribute('href'),
  )
  await user.click(screen.getByRole('button', { name: 'Copy backup code' }))
  expect(screen.getByText(/Select the full code above/)).toBeVisible()
})

it.each(['opened', 'cancelled', 'unavailable'])(
  'does not attach gift A’s late %s share outcome to edited gift B',
  async (outcome) => {
    const user = userEvent.setup()
    let settle: () => void = () => {}
    const nativeShare = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = () =>
            outcome === 'opened'
              ? resolve()
              : reject(
                  new DOMException('Closed', outcome === 'cancelled' ? 'AbortError' : 'DataError'),
                )
        }),
    )
    vi.stubGlobal('navigator', { ...navigator, share: nativeShare })
    show()
    await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
    await user.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
    await user.click(screen.getByRole('button', { name: 'Create gift link' }))
    await user.click(screen.getByRole('button', { name: 'Share…' }))
    await user.click(screen.getByRole('button', { name: /Red panda forest/ }))
    await user.click(screen.getByRole('button', { name: 'Create gift link' }))
    expect(sharedGift().imageKey).toBe('red-panda')
    expect(screen.getByRole('button', { name: 'Share…' })).toBeDisabled()
    await act(async () => settle())
    expect(screen.getByRole('button', { name: 'Share…' })).toBeEnabled()
    expect(
      screen.queryByText(/Your device handled|Share closed|Sharing is unavailable here/),
    ).toBeNull()
    expect(nativeShare).toHaveBeenCalledTimes(1)
  },
)

it('requires a picture and nine answers, supports reviewing edits, and preserves the original shared snapshot', async () => {
  const user = userEvent.setup()
  show()
  expect(screen.getByRole('button', { name: 'Create gift link' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: /Slide & Solve/ })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await answerNine(user)
  expect(screen.getByText('9 of 9 answered')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(sharedGift()).toMatchObject({
    version: 2,
    mode: 'learning',
    imageKey: 'salamander-forest',
    answers: GIFT_SURVEY.map((item) => ({
      templateId: item.id,
      answer: item.id === 'ice-cream' ? 'Pistachio' : item.suggestions[0],
    })),
  })
  const original = screen.getByRole('link', { name: 'Open gift' }).getAttribute('href')!
  const email = new URL(screen.getByRole('link', { name: 'Email draft' }).getAttribute('href')!)
  expect(email.pathname).toBe('')
  expect(email.searchParams.get('body')).toContain(original)
  await user.click(screen.getByRole('button', { name: 'Edit favorite color' }))
  const field = screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })
  expect(field).toHaveFocus()
  await user.clear(field)
  await user.type(field, 'Teal')
  expect(screen.queryByRole('link', { name: 'Open gift' })).toBeNull()
  expect(decodeGift(new URL(original).hash)).toMatchObject({
    answers: expect.arrayContaining([{ templateId: 'color', answer: 'Blue' }]),
  })
  expect(screen.queryByLabelText(/email|password|recipient/i)).toBeNull()
})

it('clears survey answers on Classic and requires them again when returning', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await user.type(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask }), 'Teal')
  await user.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  expect(screen.queryByRole('textbox')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(sharedGift()).toMatchObject({ mode: 'classic', answers: [] })
  await user.click(screen.getByRole('radio', { name: /Mystery Reveal/ }))
  expect(screen.getByRole('button', { name: 'Create gift link' })).toBeDisabled()
  expect(screen.getByText('0 of 9 answered')).toBeVisible()
})

it('suggests an occasion effect until explicitly chosen, then retains the user choice', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await user.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  await user.click(screen.getByRole('radio', { name: 'Birthday' }))
  expect(screen.getByRole('radio', { name: 'Balloons' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Hearts' }))
  await user.click(screen.getByRole('radio', { name: 'Thank you' }))
  expect(screen.getByRole('radio', { name: 'Hearts' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Envelope' }))
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(sharedGift()).toMatchObject({
    occasion: 'thank-you',
    celebration: 'hearts',
    wrapper: 'envelope',
  })
})

it('keeps invalid typed answers visible and explains how to repair them', async () => {
  const user = userEvent.setup()
  show()
  const field = screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })
  await user.type(field, '<b>Teal</b>')
  expect(field).toHaveValue('<b>Teal</b>')
  expect(screen.getByRole('alert')).toHaveTextContent('plain text')
  expect(screen.getByRole('button', { name: 'Next favorite' })).toBeDisabled()
  await user.clear(field)
  await user.type(field, 'Blue')
  await user.click(screen.getByRole('button', { name: 'Next favorite' }))
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask })).toHaveValue('Blue')
})

it('keeps manual sharing available when the device chooser is absent', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('navigator', { ...navigator, share: undefined })
  show()
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await user.click(screen.getByRole('radio', { name: /Classic Jigsaw/ }))
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  await user.click(screen.getByRole('button', { name: 'Share…' }))
  expect(screen.getByText(/Sharing is unavailable here/)).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Share link' })).toHaveAttribute('readonly')
  expect(screen.getByRole('button', { name: 'Copy link' })).toBeEnabled()
})

it('creates a picture-only Slide & Solve gift and clears the survey across mode changes', async () => {
  const user = userEvent.setup()
  show()
  await user.type(screen.getByRole('textbox', { name: GIFT_SURVEY[0].ask }), 'Teal')
  await user.click(screen.getByRole('button', { name: /Forest guardian/ }))
  await user.click(screen.getByRole('radio', { name: /Slide & Solve/ }))
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText(/Slide rows and columns around the 3 × 3 picture grid/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Create gift link' }))
  expect(sharedGift()).toMatchObject({ version: 3, mode: 'sliding', answers: [] })
  await user.click(screen.getByRole('radio', { name: /Mystery Reveal/ }))
  expect(screen.getByText('0 of 9 answered')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Create gift link' })).toBeDisabled()
})
