import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function CategorySelector({ categories, value, onChange }: { categories: string[]; value: string | null; onChange: (value: string | null) => void }) {
  const nav = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number }>()

  useLayoutEffect(() => {
    const element = nav.current
    const active = element?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!element || !active) return
    const measure = () => setPill({ left: active.offsetLeft, width: active.offsetWidth })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element); observer.observe(active)
    const padding = parseFloat(getComputedStyle(element).paddingLeft)
    const left = active.offsetLeft - padding, right = active.offsetLeft + active.offsetWidth + padding
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (left < element.scrollLeft) element.scrollTo({ left, behavior: reducedMotion ? 'instant' : 'smooth' })
    else if (right > element.scrollLeft + element.clientWidth) element.scrollTo({ left: right - element.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' })
    return () => observer.disconnect()
  }, [value, categories])

  return <nav ref={nav} aria-label="Menu categories" className="relative flex h-[calc(var(--radius-card)*2)] min-w-0 max-w-full items-center overflow-x-auto rounded-full bg-background p-1 shadow-sm">
    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 h-[26pt] -translate-y-1/2 rounded-full bg-primary transition-[left,width] duration-250 ease-in-out motion-reduce:transition-none" style={{ left: pill?.left ?? 0, width: pill?.width ?? 0 }} />
    {[null, ...categories].map(category => <Button key={category === null ? 'all' : `category:${category}`} size="sm" variant="ghost" className={`relative z-10 h-[26pt] shrink-0 rounded-full px-4 transition-colors duration-250 ease-in-out motion-reduce:transition-none ${value === category ? 'text-white hover:bg-transparent hover:text-white' : 'hover:bg-transparent'}`} aria-pressed={value === category} onClick={() => onChange(category)}>{category === null ? 'All' : category || 'Uncategorized'}</Button>)}
  </nav>
}
