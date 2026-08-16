import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { env } from '@config/env'
import { paths } from '@config/routes'
import { ThemeToggle } from './ThemeToggle'
import styles from './AppShell.module.css'

type NavItem = { to: string; label: string }

const NAV: NavItem[] = [
  { to: paths.home, label: 'Home' },
  { to: paths.guestPlayIndex, label: 'Play' },
  { to: paths.profile, label: 'Profile' },
  { to: paths.unity, label: 'WebGL Host' },
]

/**
 * Responsive application shell.
 *
 * `fill` switches the shell from a scrolling document to a fixed-viewport
 * layout. Unity-hosting routes need the second mode: the WebGL canvas must own
 * a stable box rather than sit inside a growing page.
 */
export function AppShell({
  children,
  fill = false,
  contained = true,
}: {
  children: ReactNode
  fill?: boolean
  contained?: boolean
}) {
  return (
    <div className={styles.shell} data-fill={fill}>
      <a className={`${styles.skipLink} sr-only`} href="#main">
        Skip to main content
      </a>

      <header className={styles.header}>
        <Link to={paths.home} className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            S0
          </span>
          {env.appName}
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === paths.home}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {item.label}
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>
      </header>

      <main id="main" className={styles.main} data-contained={contained && !fill}>
        {children}
      </main>

      {fill ? null : (
        <footer className={styles.footer}>
          <span>
            {env.appName} — cloud companion platform. Gameplay runs in the Unity application.
          </span>
          <span className={styles.envBadge}>
            env: {env.appEnv} · contract: {env.api.contractVersion} ·{' '}
            {env.api.isConfigured ? 'api: live' : 'api: mock'}
          </span>
        </footer>
      )}
    </div>
  )
}
