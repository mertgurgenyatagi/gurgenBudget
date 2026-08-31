import { useEffect, useLayoutEffect, useRef } from 'react'
import { BaseIncome } from './BaseIncome'
import { BaseSpend } from './BaseSpend'
import { Dashboard } from './Dashboard'
import { DailyLog } from './DailyLog'
import { FlexIncome } from './FlexIncome'
import { FlexSpend } from './FlexSpend'
import { Settings } from './Settings'
import { Wishlist } from './Wishlist'

// Ring order: increasing index = swipe left. Matches PROJECT.md's
// "swipe right once -> Calendar, swipe left once -> Wishlist, swipe left
// twice -> Settings, continuing left -> the four Month Setup screens,
// then back around to Calendar, closing the ring."
const PAGES = [
  <Dashboard key="dashboard" />,
  <Wishlist key="wishlist" />,
  <Settings key="settings" />,
  <BaseIncome key="base-income" />,
  <FlexIncome key="flex-income" />,
  <BaseSpend key="base-spend" />,
  <FlexSpend key="flex-spend" />,
  <DailyLog key="calendar" />,
]

const N = PAGES.length
const EASE = 'transform 380ms cubic-bezier(.22,.9,.32,1.1)'
const DIST_THRESHOLD_RATIO = 0.22
const FLICK_THRESHOLD = 0.5 // px/ms

export function Ring() {
  const screenRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(1) // 1..N maps to real page 0..N-1; 0 and N+1 are clones
  const slotWidthRef = useRef(0)
  const dragState = useRef({
    dragging: false,
    startX: 0,
    baseTranslate: 0,
    currentTranslate: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
  })

  const setTransform = (px: number, animate: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animate ? EASE : 'none'
    track.style.transform = `translateX(${px}px)`
  }

  const targetFor = (i: number) => -i * slotWidthRef.current

  const goTo = (i: number, animate = true) => {
    indexRef.current = i
    setTransform(targetFor(i), animate)
  }

  useLayoutEffect(() => {
    const measure = () => {
      slotWidthRef.current = screenRef.current?.clientWidth ?? window.innerWidth
      // Mobile browsers fire resize when their address bar hides/shows on
      // scroll, which can happen mid-swipe. Re-snapping the transform then
      // would yank the ring out from under the finger, so skip it while a
      // drag is in progress — the drag's own math already tracks the finger
      // correctly and will re-sync on the next pointerup.
      if (!dragState.current.dragging) {
        setTransform(targetFor(indexRef.current), false)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const handleTransitionEnd = () => {
      if (indexRef.current === 0) {
        indexRef.current = N
        setTransform(targetFor(N), false)
      } else if (indexRef.current === N + 1) {
        indexRef.current = 1
        setTransform(targetFor(1), false)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const s = dragState.current
      s.dragging = true
      track.classList.add('dragging')
      s.startX = e.clientX
      s.lastX = e.clientX
      s.lastT = performance.now()
      s.velocity = 0
      s.baseTranslate = targetFor(indexRef.current)
      s.currentTranslate = s.baseTranslate
      setTransform(s.baseTranslate, false)
      track.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const s = dragState.current
      if (!s.dragging) return
      const now = performance.now()
      const dt = now - s.lastT
      if (dt > 0) s.velocity = (e.clientX - s.lastX) / dt
      s.lastX = e.clientX
      s.lastT = now
      const delta = e.clientX - s.startX
      s.currentTranslate = s.baseTranslate + delta
      setTransform(s.currentTranslate, false)
    }

    const onPointerUp = () => {
      const s = dragState.current
      if (!s.dragging) return
      s.dragging = false
      track.classList.remove('dragging')

      const delta = s.currentTranslate - s.baseTranslate
      const distThreshold = slotWidthRef.current * DIST_THRESHOLD_RATIO

      let next = indexRef.current
      if (delta < -distThreshold || s.velocity < -FLICK_THRESHOLD) {
        next = indexRef.current + 1
      } else if (delta > distThreshold || s.velocity > FLICK_THRESHOLD) {
        next = indexRef.current - 1
      }
      goTo(next, true)
    }

    track.addEventListener('transitionend', handleTransitionEnd)
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    track.addEventListener('pointercancel', onPointerUp)

    return () => {
      track.removeEventListener('transitionend', handleTransitionEnd)
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
      track.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  const paddedPages = [PAGES[N - 1], ...PAGES, PAGES[0]]

  return (
    <div ref={screenRef} className="ring-screen">
      <div ref={trackRef} className="ring-track">
        {paddedPages.map((page, i) => (
          <div className="ring-slot" key={i}>
            {page}
          </div>
        ))}
      </div>
    </div>
  )
}
