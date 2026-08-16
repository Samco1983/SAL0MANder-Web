import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@lib/cn'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type CommonProps = {
  variant?: Variant
  size?: Size
  children: ReactNode
  className?: string
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Consumes semantic tokens only. Visual language here is deliberately plain —
 * final SAL0MANder UX is a later, approval-gated pass.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={cn(styles.button, styles[variant], styles[size], className)} {...rest}>
      {children}
    </button>
  )
}

/** Navigation styled as a button. Stays an anchor so it is keyboard/SR correct. */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={cn(styles.button, styles[variant], styles[size], className)}>
      {children}
    </Link>
  )
}
