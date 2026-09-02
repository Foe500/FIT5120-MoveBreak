import { cn } from '@/lib/utils'

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

function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}

function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-extrabold leading-tight text-[var(--color-heading)]', className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div className={cn(className)} {...props} />
}

export { Card, CardContent, CardHeader, CardTitle }
