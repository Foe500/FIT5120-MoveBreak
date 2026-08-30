import { cloneElement, isValidElement } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
        outline: 'border border-blue-500 bg-white text-blue-700 hover:bg-blue-50',
        ghost: 'text-blue-700 hover:bg-blue-50',
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
