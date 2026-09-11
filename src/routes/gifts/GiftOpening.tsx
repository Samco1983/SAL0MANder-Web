import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PuzzlePicture } from '@content/puzzleLibrary'
import type { GiftPresentation } from '@/gifts/giftPresentation'
import styles from './GiftOpening.module.css'

export const GIFT_OPENING_MS = 900

export function GiftOpening({
  wrapper,
  picture,
  children,
}: {
  wrapper: GiftPresentation['wrapper']
  picture?: PuzzlePicture
  children: ReactNode
}) {
  const [state, setState] = useState<'wrapped' | 'opening' | 'open'>('wrapped')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (state === 'open') card.current?.querySelector('button')?.focus()
  }, [state])
  function unwrap() {
    if (state !== 'wrapped') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setState('open')
    else {
      setState('opening')
      timer.current = setTimeout(() => setState('open'), GIFT_OPENING_MS)
    }
  }
  return (
    <div className={styles.reveal} data-state={state} data-wrapper={wrapper}>
      <div className={styles.scene} aria-hidden="true">
        <span className={styles.glow} />
        <div className={styles.sparks}>
          {Array.from({ length: 12 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  '--angle': `${index * 30}deg`,
                  '--delay': `${(index % 3) * 35}ms`,
                } as CSSProperties
              }
            >
              ✦
            </i>
          ))}
        </div>
        <div className={styles.parcel}>
          <div className={styles.lid}>
            <span />
          </div>
          <div className={styles.front}>
            <span>✦</span>
          </div>
        </div>
        <div className={styles.pieces}>
          {Array.from({ length: 9 }, (_, index) => {
            const column = index % 3
            const row = Math.floor(index / 3)
            return (
              <span
                className={styles.piece}
                key={index}
                style={
                  {
                    '--x': `${(column - 1) * 66}px`,
                    '--y': `${(row - 1) * 66 - 56}px`,
                    '--burst-x': `${(column - 1) * 102 + (row - 1) * 15}px`,
                    '--burst-y': `${-156 + row * 52}px`,
                    '--twist': `${(index % 2 ? 1 : -1) * (14 + index * 5)}deg`,
                    '--delay': `${index * 8}ms`,
                    ...(picture
                      ? {
                          backgroundImage: `url("${import.meta.env.BASE_URL.replace(/\/$/, '')}${picture.src}")`,
                          backgroundPosition: `${column * 50}% ${row * 50}%`,
                        }
                      : {}),
                  } as CSSProperties
                }
              >
                {!picture && <span>{index === 4 ? '✦' : '?'}</span>}
              </span>
            )
          })}
        </div>
      </div>
      {state !== 'open' ? (
        <button className={styles.openGift} disabled={state === 'opening'} onClick={unwrap}>
          {state === 'opening'
            ? 'Unwrapping…'
            : wrapper === 'box'
              ? 'Open gift box'
              : 'Open envelope'}
        </button>
      ) : (
        <div ref={card} className={styles.contents}>
          <p
            className={styles.caption}
            aria-label={picture ? 'Your puzzle picture' : 'Covered puzzle card'}
          >
            {picture ? `${picture.name} · Made for you` : 'Your picture is a surprise'}
          </p>
          {children}
        </div>
      )}
      {state === 'wrapped' && <p className={styles.hint}>A little tap. A big surprise.</p>}
    </div>
  )
}
