// Provides small composable card primitives with shared visual treatment and class merging.
import { cn } from '@/lib/utils'

// Render the shared card container with optional caller-provided classes and HTML attributes.
function Card({ className, ...props }) {
  return (
    <section
      className={cn(
        'rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

// Render the compact title row shared by dashboard and content cards.
function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}

// Render a semantically consistent card heading.
function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-extrabold leading-tight text-[var(--color-heading)]', className)} {...props} />
}

// Render the flexible content area used inside a card.
function CardContent({ className, ...props }) {
  return <div className={cn(className)} {...props} />
}

export { Card, CardContent, CardHeader, CardTitle }
