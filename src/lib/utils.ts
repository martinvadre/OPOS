import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the custom theme tokens (--spacing-inset, --radius-card),
// otherwise `py-0` can't override `py-inset` and both end up applied.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['inset'],
      radius: ['card'],
    },
  },
})

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
