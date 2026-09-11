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

it('filters to verified photos and keeps the selected artwork when filters are cleared', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<GiftPicturePicker selectedKey="red-panda" onSelect={onSelect} />)
  const real = PUZZLE_LIBRARY.filter((picture) => picture.photoCredit)
  expect(real.length).toBeGreaterThanOrEqual(4)
  await user.click(screen.getByRole('checkbox', { name: 'Real photos only' }))
  expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(real.length)
  expect(screen.queryByRole('button', { name: 'Choose Forest guardian' })).toBeNull()
  for (const picture of real) {
    expect(screen.getByRole('button', { name: 'Choose ' + picture.name })).toBeVisible()
    expect(
      screen
        .getAllByRole('link', { name: picture.photoCredit!.author })
        .some((link) => link.getAttribute('href') === picture.photoCredit!.source),
    ).toBe(true)
  }
  await user.click(screen.getByRole('button', { name: 'Show all pictures' }))
  expect(screen.getByRole('button', { name: 'Choose Red panda forest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(onSelect).not.toHaveBeenCalled()
})

it('finds both puppy and race-car photos using common search spellings', async () => {
  const user = userEvent.setup()
  render(<GiftPicturePicker selectedKey="" onSelect={vi.fn()} />)
  const search = screen.getByRole('searchbox', { name: 'Find a picture' })
  for (const query of ['puppy', 'puppies']) {
    await user.clear(search)
    await user.type(search, query)
    expect(screen.getByRole('button', { name: 'Choose Sleeping puppies' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose Puggle puppy in flowers' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(2)
  }
  for (const query of ['racecar', 'race cars']) {
    await user.clear(search)
    await user.type(search, query)
    expect(screen.getByRole('button', { name: 'Choose Orange Indy race car' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose Red Indy race car' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Choose / })).toHaveLength(2)
  }
})
