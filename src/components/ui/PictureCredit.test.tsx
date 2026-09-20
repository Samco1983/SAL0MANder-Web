import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { PictureCredit } from './PictureCredit'

describe('picture provenance', () => {
  it('identifies original generated artwork without presenting a photographer or open license', () => {
    const picture = PUZZLE_LIBRARY.find((entry) => entry.key === 'fictional-neon-tuner-v1')!
    render(<PictureCredit picture={picture} />)
    expect(screen.getByText(/Original AI-generated artwork · SAL0MANder/)).toBeVisible()
    expect(screen.queryByText(/Photo:/)).toBeNull()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it.each([
    ['photo-lion-cub', 'Lion Cub'],
    ['photo-tiger-looking', 'Tiger Looking at Me'],
    ['photo-rainbow-ice-cream', 'Free Rainbow Sprinkle Ice Cream Cone Creative Commons'],
  ])(
    'retains the supplied title, author, source, license and modifications for %s',
    (key, title) => {
      const picture = PUZZLE_LIBRARY.find((entry) => entry.key === key)!
      const { container } = render(<PictureCredit picture={picture} />)
      const credit = picture.photoCredit!
      expect(container).toHaveTextContent(title)
      expect(screen.getByRole('link', { name: credit.author })).toHaveAttribute(
        'href',
        credit.source,
      )
      expect(screen.getByRole('link', { name: credit.license })).toHaveAttribute(
        'href',
        credit.licenseUrl,
      )
      expect(container).toHaveTextContent('Resized; WebP format')
      expect(screen.getAllByRole('link')).toHaveLength(2)
    },
  )
})
