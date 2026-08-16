import { useCallback, useState, type ReactNode } from 'react'
import { Button } from '@components/ui/Button'
import styles from './CompanionLayout.module.css'

const COLLAPSE_KEY = 'sal0mander.companion.collapsed'

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
}: {
  companion: ReactNode
  stage: ReactNode
  defaultCollapsed?: boolean
  companionLabel?: string
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(defaultCollapsed))

  const toggle = useCallback(() => {
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

  return (
    <div className={styles.layout} data-collapsed={collapsed}>
      <aside
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
            aria-controls={undefined}
          >
            {collapsed ? 'Show companion' : 'Hide companion'}
          </Button>
        </div>
        {stage}
      </section>
    </div>
  )
}
