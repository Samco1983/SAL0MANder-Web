import type { ReactNode } from 'react'
import { cn } from '@lib/cn'
import styles from './Card.module.css'

export function Card({
  title,
  children,
  footer,
  className,
}: {
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <section className={cn(styles.card, className)}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  )
}
