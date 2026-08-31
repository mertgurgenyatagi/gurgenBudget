import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

export interface RingScreen {
  key: string
  render: () => ReactNode
}

/**
 * The app-wide swipe ring, taken from Dashboard exhibit design #17 and extended
 * across every screen. It's a circular ring, not a list: swiping past the last
 * screen comes back around to the first.
 *
 * Only three panels are mounted at a time — previous, current, next — and the
 * scroll position is silently re-centred after each swipe settles. That's what
 * makes the ring endless while keeping the browser's own scroll-snap physics,
 * and it never changes the URL: navigation here is in-memory, for a seamless feel.
 */
export function Ring({ screens, index, onIndexChange }: {
  screens: RingScreen[]
  index: number
  onIndexChange: (next: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const count = screens.length
  const wrap = (i: number) => ((i % count) + count) % count

  const window = [wrap(index - 1), index, wrap(index + 1)]

  // Re-centre on the middle panel before paint, so the swap is invisible.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (el) el.scrollLeft = el.clientWidth
  }, [index, count])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    let timer: number | undefined
    const settle = () => {
      const width = el.clientWidth
      if (width === 0) return
      const delta = Math.round(el.scrollLeft / width) - 1
      if (delta !== 0) onIndexChange(wrap(index + delta))
    }

    // Nothing re-renders mid-scroll; the index only moves once the swipe settles.
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(settle, 90)
    }

    const onResize = () => {
      el.scrollLeft = el.clientWidth
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    globalThis.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      globalThis.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [index, count, onIndexChange])

  return (
    <div className="ring">
      <div className="ring-track" ref={trackRef}>
        {window.map((screenIndex, slot) => (
          <div className="ring-panel" key={`${screens[screenIndex].key}-${slot}`}>
            {screens[screenIndex].render()}
          </div>
        ))}
      </div>
      <div className="ring-dots">
        {screens.map((screen, i) => (
          <i key={screen.key} className={i === index ? 'on' : undefined} />
        ))}
      </div>
    </div>
  )
}
