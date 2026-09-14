// Combines conditional Tailwind class names while resolving conflicting utility classes.
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge conditionally supplied class names into one conflict-free Tailwind class string.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
