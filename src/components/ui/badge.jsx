import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('badge badge-sm w-fit gap-1 font-semibold', {
  variants: {
    variant: {
      default: 'badge-info badge-soft',
      secondary: 'badge-neutral badge-soft',
      success: 'badge-success badge-soft',
      warning: 'badge-warning badge-soft',
      muted: 'badge-ghost',
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
