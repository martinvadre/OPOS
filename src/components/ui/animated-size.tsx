import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function AnimatedSize({ children, open = true }: { children: ReactNode; open?: boolean }) {
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const element = content.current
    if (!element) return
    const measure = () => setHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div className="min-w-0 overflow-hidden transition-[height] duration-250 ease-in-out motion-reduce:transition-none" style={{ height: open ? height : 0 }}><div ref={content} className="flow-root min-w-0">{children}</div></div>
}
