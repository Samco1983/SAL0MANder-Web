import type { ReactNode } from 'react'
import { cn } from '@lib/cn'
import styles from './Card.module.css'

export function Card({
  title,
  headingLevel = 3,
  children,
  footer,
  className,
}: {
  title?: ReactNode
  headingLevel?: 2 | 3
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section className={cn(styles.card, className)}>
      {title ? <Heading className={styles.title}>{title}</Heading> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  )
}
