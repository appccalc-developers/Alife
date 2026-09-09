import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Keep a tab workspace from collapsing during lazy loading or shorter tab views.
// A new workspace (key) or content width starts a fresh height measurement.
const AppStableTabBody = ({ children }: { children: ReactNode }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState(0)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return
    let previousWidth = -1
    let retainedHeight = 0
    const measure = () => {
      const bounds = content.getBoundingClientRect()
      const width = Math.round(bounds.width)
      const height = Math.ceil(bounds.height)
      retainedHeight = width === previousWidth ? Math.max(retainedHeight, height) : height
      previousWidth = width
      setMinHeight(retainedHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div data-stable-tab-body className="min-w-0" style={{ minHeight, overflowAnchor: 'none' }}>
      <div ref={contentRef} className="flow-root min-w-0">{children}</div>
    </div>
  )
}

export default AppStableTabBody
