import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { GiftPicturePicker } from './GiftPicturePicker'

it('lets a sender choose a new picture using its stable key', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const { rerender } = render(<GiftPicturePicker selectedKey="red-panda" onSelect={onSelect} />)
  expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(PUZZLE_LIBRARY.length)
  await user.click(screen.getByRole('button', { name: 'Choose Mountain steam train' }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('mountain-steam-train')
  rerender(<GiftPicturePicker selectedKey="mountain-steam-train" onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Choose Mountain steam train' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByText(/Selected picture: Mountain steam train/)).toBeVisible()
  expect(screen.getByRole('img', { name: /black steam locomotive/ })).toHaveAttribute(
    'height',
    '954',
  )
})

it('combines theme and case-insensitive search without changing the chosen picture', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<GiftPicturePicker selectedKey="red-panda" onSelect={onSelect} />)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'Animals')
  await user.type(screen.getByRole('searchbox', { name: 'Find a picture' }), '  DINOSAUR  ')
  expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Choose Dinosaur valley' })).toBeVisible()
  expect(screen.getByText(/Selected picture: Red panda forest/)).toBeVisible()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'Space')
  expect(screen.queryAllByRole('button', { name: /^Choose / })).toHaveLength(0)
  expect(screen.getByText(/No pictures match/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Show all pictures' }))
  expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(PUZZLE_LIBRARY.length)
  expect(screen.getByRole('button', { name: 'Choose Red panda forest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(onSelect).not.toHaveBeenCalled()
})

it('keeps picture selection operable with a normal keyboard button action', async () => {
  const user = userEvent.setup()
  function Example() {
    const [selected, setSelected] = useState('')
    return <GiftPicturePicker selectedKey={selected} onSelect={setSelected} />
  }
  render(<Example />)
  const airship = screen.getByRole('button', { name: 'Choose Sunset airship' })
  airship.focus()
  await user.keyboard('[Enter]')
  expect(airship).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/Selected picture: Sunset airship/)).toBeVisible()
})
