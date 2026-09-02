import { cloneElement, isValidElement } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'btn font-semibold normal-case tracking-normal disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'btn-primary',
        outline: 'btn-outline btn-primary',
        ghost: 'btn-ghost',
        success: 'btn-success',
      },
      size: {
        default: 'btn-md',
        sm: 'btn-sm',
        lg: 'btn-lg',
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
