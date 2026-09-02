import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', {
  variants: {
    variant: {
      default: 'bg-[var(--color-soft-blue)] text-[#315d74]',
      secondary: 'bg-[#f0ece4] text-[#5d625f]',
      success: 'bg-[#e3eee1] text-[#315b3c]',
      warning: 'bg-[var(--color-soft-coral)] text-[#96513d]',
      muted: 'bg-[#f0ece4] text-[#77736c]',
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
