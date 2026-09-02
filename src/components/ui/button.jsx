import { cloneElement, isValidElement } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-[var(--color-primary)] bg-[var(--color-primary)] text-[#fff] shadow-[var(--shadow-action)] hover:bg-[var(--color-primary-hover)]',
        outline:
          'border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-heading)] hover:bg-[var(--color-soft-green)]',
        ghost: 'text-[#315b3c] hover:bg-[var(--color-soft-green)]',
        success:
          'border border-[var(--color-success)] bg-[var(--color-success)] text-[#fff] hover:bg-[var(--color-success-hover)]',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({ asChild = false, className, variant, size, ...props }) {
  const classes = cn(buttonVariants({ variant, size, className }))

  if (asChild && isValidElement(props.children)) {
    return cloneElement(props.children, {
      className: cn(classes, props.children.props.className),
    })
  }

  return <button className={classes} {...props} />
}

export { Button }
