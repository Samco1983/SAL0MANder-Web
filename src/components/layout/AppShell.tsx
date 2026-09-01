import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { env } from '@config/env'
import { paths } from '@config/routes'
import { Wordmark } from '@components/brand/Wordmark'
import { ThemeToggle } from './ThemeToggle'
import styles from './AppShell.module.css'

/**
 * `internal` keeps a destination out of the public navigation without taking it
 * away from whoever needs it.
 *
 * The route still resolves — typing the URL works in production exactly as it
 * does locally. What changes is that a teacher evaluating the site, or a
 * student on a share link, is never handed "WebGL Host" and "Console" as though
 * they were part of the product. Removing the routes instead would cost the
 * team its own smoke-test surfaces to hide two links.
 */
type NavItem = { to: string; label: string; internal?: boolean }

const NAV: NavItem[] = [
  { to: paths.home, label: 'Home' },
  { to: paths.guestPlayIndex, label: 'Play' },
  { to: paths.profile, label: 'Profile' },
  { to: paths.unity, label: 'WebGL Host', internal: true },
  { to: paths.console, label: 'Console', internal: true },
]

/** What the public sees. In production, internal destinations are not listed. */
export function visibleNav(isProd: boolean): NavItem[] {
  return isProd ? NAV.filter((item) => !item.internal) : NAV
}

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

      {/*
        Says out loud what a screenshot cannot: this is working plumbing, not
        approved design. Visual identity is gated on Product/Gameplay Discovery
        (X-005), so anyone reviewing the app should judge the flows, not the
        look. Hidden in production so it can never reach a teacher.
      */}
      {env.isProd ? null : (
        <p className={styles.foundationBanner}>
          <strong>Foundation preview</strong> — real flows, placeholder visual design. Not approved
          P1 UX.
        </p>
      )}

      <header className={styles.header}>
        <Link to={paths.home} className={styles.brand} aria-label={`${env.appName} home`}>
          <Wordmark />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {visibleNav(env.isProd).map((item) => (
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
            {/*
              The footer runs on every page, so this line is read more than any
              other sentence on the site — including by a filter reviewer. It
              said "cloud companion platform. Gameplay runs in the Unity
              application", which describes the architecture to an engineer and
              tells a teacher nothing.
            */}
            {env.appName} — learning puzzles for the classroom.
          </span>

          {/*
            The trust pages were reachable only from the sitemap and from each
            other — /about had nothing linking to it at all. A crawler that
            lands on the home page follows links, and a district reviewer looks
            for exactly these four words in exactly this place. Four pages that
            exist but cannot be found are worth very little.

            Global, so every page carries them. The footer is hidden on the
            `fill` layout, which is the Guest Play stage, so a student mid-game
            never sees this.
          */}
          <nav className={styles.footerNav} aria-label="Site information">
            <Link className={styles.footerLink} to={paths.about}>
              About
            </Link>
            <Link className={styles.footerLink} to={paths.privacy}>
              Privacy
            </Link>
            <Link className={styles.footerLink} to={paths.terms}>
              Terms
            </Link>
            <a className={styles.footerLink} href="mailto:support@sal0mander.com">
              Contact
            </a>
          </nav>
          {env.isProd ? null : (
            <span className={styles.envBadge}>
              env: {env.appEnv} · contract: {env.api.contractVersion} ·{' '}
              {env.api.isConfigured ? 'api: live' : 'api: mock'}
            </span>
          )}
        </footer>
      )}
    </div>
  )
}
