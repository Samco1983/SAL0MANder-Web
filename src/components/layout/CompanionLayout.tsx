import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@components/ui/Button'
import styles from './CompanionLayout.module.css'

const COLLAPSE_KEY = 'sal0mander.companion.collapsed'
const COMPANION_ID = 'sal0mander-companion-panel'

function readCollapsed(defaultCollapsed: boolean): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY)
    return stored === null ? defaultCollapsed : stored === 'true'
  } catch {
    return defaultCollapsed
  }
}

/**
 * Optional 42 / 58 split: web companion context beside the Unity stage.
 *
 * Contract for anything built on top of this:
 *   - `stage` is ALWAYS rendered, at every breakpoint, collapsed or not.
 *     Collapsing changes CSS only — Unity never unmounts, so a student's game
 *     is never restarted by a layout toggle.
 *   - `companion` is optional context. If it fails, is empty, or is collapsed,
 *     gameplay is unaffected. Never put anything gameplay-critical in it.
 *   - Below 60rem the companion becomes a bottom sheet over the stage, so small
 *     screens never give up playable area.
 */
export function CompanionLayout({
  companion,
  stage,
  defaultCollapsed = false,
  companionLabel = 'Companion panel',
  reveal = false,
}: {
  companion: ReactNode
  stage: ReactNode
  defaultCollapsed?: boolean
  companionLabel?: string
  /**
   * Something in the companion needs to be seen, whatever the student's
   * collapse preference is.
   *
   * Raise it and a collapsed panel opens; lower it and the preference is put
   * back. Nothing is persisted by either move — an auto-expand is the app
   * speaking, not the student changing their mind, so it must not overwrite
   * what they chose (2026-08-19 supervisor ruling on undeliverable results).
   *
   * Deliberately *not* a continuous force. Holding the panel open would make
   * "Hide companion" a button that visibly does nothing, which is the same
   * silent no-op this whole area of the code exists to avoid. It acts on the
   * rising edge only, so the student keeps the last word and a run of repeated
   * failures cannot re-open a panel they closed on purpose.
   */
  reveal?: boolean
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(defaultCollapsed))

  /**
   * What to put back when `reveal` drops — set only when the reveal actually
   * changed something, so a reveal over an already-open panel restores nothing.
   */
  const restoreRef = useRef<boolean | undefined>(undefined)
  /** Edge detector. Without it every re-render during a reveal re-expands. */
  const revealedRef = useRef(false)

  const toggle = useCallback(() => {
    // An explicit choice supersedes anything the reveal stashed: whatever the
    // student picks here is what they get back later, not what they had before.
    restoreRef.current = undefined
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next))
      } catch {
        /* non-fatal */
      }
      return next
    })
  }, [])

  /*
   * A layout effect, not a passive one, and the reason is assistive tech.
   *
   * The content being revealed is inserted in the same commit that raises
   * `reveal`, into an `aria-hidden` + `inert` panel. A passive effect opens the
   * panel a paint later, so there is a frame in which a `role="alert"` exists
   * inside a subtree screen readers are told to ignore — and an alert is
   * announced on insertion, not on becoming visible, so it can be missed
   * entirely. Running before paint collapses that window.
   *
   * Not provable in jsdom, which models neither paint nor the a11y tree. Flagged
   * for the real-browser + screen-reader acceptance pass rather than claimed.
   */
  useLayoutEffect(() => {
    if (reveal === revealedRef.current) return
    revealedRef.current = reveal

    if (reveal) {
      // Note what to restore only if the panel was actually closed. No focus is
      // moved: the revealed content carries `role="alert"`, which announces
      // without taking the keyboard away from a student mid-game.
      if (collapsed) {
        restoreRef.current = true
        setCollapsed(false)
      }
      return
    }

    const restore = restoreRef.current
    restoreRef.current = undefined
    if (restore !== undefined) setCollapsed(restore)
  }, [reveal, collapsed])

  return (
    <div className={styles.layout} data-collapsed={collapsed}>
      <aside
        id={COMPANION_ID}
        className={styles.companion}
        aria-label={companionLabel}
        // Hidden from AT when collapsed; still mounted so state survives.
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div className={styles.companionInner}>{companion}</div>
      </aside>

      <section className={styles.stage} aria-label="Game stage">
        <div className={styles.toggle}>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggle}
            aria-expanded={!collapsed}
            // Without this the button announces "expanded" with no subject —
            // a disclosure control that never says what it discloses.
            aria-controls={COMPANION_ID}
          >
            {collapsed ? 'Show companion' : 'Hide companion'}
          </Button>
        </div>
        {stage}
      </section>
    </div>
  )
}
