import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', {
  variants: {
    variant: {
      default: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      muted: 'bg-slate-100 text-slate-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge }
