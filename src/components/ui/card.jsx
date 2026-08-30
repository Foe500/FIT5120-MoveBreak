import { cn } from '@/lib/utils'

function Card({ className, ...props }) {
  return (
    <section
      className={cn('rounded-xl border border-blue-100 bg-white shadow-[0_8px_20px_rgba(42,90,150,0.08)]', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}

function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-extrabold leading-tight text-slate-900', className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div className={cn(className)} {...props} />
}

export { Card, CardContent, CardHeader, CardTitle }
