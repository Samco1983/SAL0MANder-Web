import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GiftPresentation } from '@/gifts/giftPresentation'
import styles from './PuzzleGifts.module.css'

export function GiftOpening({
  wrapper,
  children,
}: {
  wrapper: GiftPresentation['wrapper']
  children: ReactNode
}) {
  const [state, setState] = useState<'wrapped' | 'opening' | 'open'>('wrapped')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (state === 'open') card.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [state])
  return state === 'open' ? (
    <div ref={card}>
      <div className={styles.coveredCard} aria-label="Covered puzzle card">
        <span aria-hidden="true">✦</span>
        <span>Your picture is a surprise</span>
      </div>
      {children}
    </div>
  ) : (
    <button
      className={styles.openGift}
      disabled={state === 'opening'}
      onClick={() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setState('open')
        else {
          setState('opening')
          timer.current = setTimeout(() => setState('open'), 450)
        }
      }}
    >
      <span
        className={styles.parcel}
        data-wrapper={wrapper}
        data-opening={state === 'opening'}
        aria-hidden="true"
      >
        <span>✦</span>
      </span>
      <span>
        {state === 'opening'
          ? 'Unwrapping…'
          : wrapper === 'box'
            ? 'Open gift box'
            : 'Open envelope'}
      </span>
    </button>
  )
}
