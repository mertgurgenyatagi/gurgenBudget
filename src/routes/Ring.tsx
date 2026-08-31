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
// "swipe right once -> Calendar, swipe left once -> Wishlist, continuing
// left -> the four Month Setup screens, then Settings, then back around to
// Calendar, closing the ring." Settings sits between Flex Spend and
// Calendar, one swipe right of Calendar.
const PAGES = [
  <Dashboard key="dashboard" />,
  <Wishlist key="wishlist" />,
  <BaseIncome key="base-income" />,
  <FlexIncome key="flex-income" />,
  <BaseSpend key="base-spend" />,
  <FlexSpend key="flex-spend" />,
  <Settings key="settings" />,
  <DailyLog key="calendar" />,
]

const N = PAGES.length
const EASE = 'transform 380ms cubic-bezier(.22,.9,.32,1.1)'
const DIST_THRESHOLD_RATIO = 0.22
const FLICK_THRESHOLD = 0.5 // px/ms
// Below this much horizontal movement, a pointerdown is treated as a tap on
// whatever's underneath it, not the start of a swipe — see onPointerMove.
const DRAG_START_THRESHOLD = 8 // px

export function Ring() {
  const screenRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(1) // 1..N maps to real page 0..N-1; 0 and N+1 are clones
  const slotWidthRef = useRef(0)
  const dragState = useRef({
    dragging: false,
    pointerId: null as number | null,
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

    // 0 and N+1 are the clone slots used for the infinite-loop illusion.
    // Landing on one is meant to be momentary: transitionend swaps it back
    // to the matching real index (N or 1) once the settle animation
    // finishes naturally. But starting a new drag before that animation
    // completes cuts the transition short, so transitionend never fires —
    // indexRef is left stranded on a clone, and the next swipe walks it
    // further out of the padded array's range into genuinely empty slots.
    // Fast/chained swiping makes that interruption common, so every new
    // gesture re-checks and corrects this before trusting indexRef.
    const normalizeIndex = () => {
      if (indexRef.current === 0) {
        indexRef.current = N
        setTransform(targetFor(N), false)
      } else if (indexRef.current === N + 1) {
        indexRef.current = 1
        setTransform(targetFor(1), false)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      normalizeIndex()
      const s = dragState.current
      // Note the pointer down, but don't capture it yet — see onPointerMove.
      // Capturing here unconditionally used to steal every click in the
      // ring: once an element has pointer capture, the browser retargets
      // both the pointerup *and* the click it synthesizes to the capturing
      // element, not whatever's visually under the pointer. That made
      // every button/input inside a ring slot unclickable, invisible as
      // long as ring slots had nothing interactive in them.
      s.pointerId = e.pointerId
      s.dragging = false
      s.startX = e.clientX
      s.lastX = e.clientX
      s.lastT = performance.now()
      s.velocity = 0
      s.baseTranslate = targetFor(indexRef.current)
      s.currentTranslate = s.baseTranslate
    }

    const onPointerMove = (e: PointerEvent) => {
      const s = dragState.current
      if (s.pointerId !== e.pointerId) return
      const now = performance.now()
      const dt = now - s.lastT
      if (dt > 0) s.velocity = (e.clientX - s.lastX) / dt
      s.lastX = e.clientX
      s.lastT = now
      const delta = e.clientX - s.startX

      if (!s.dragging) {
        if (Math.abs(delta) < DRAG_START_THRESHOLD) return
        // Crossed the deadzone — this is a real swipe now, not a tap.
        // Capture starts here, once we're sure, so a tap's own click still
        // fires normally on whatever the user actually pressed.
        s.dragging = true
        track.classList.add('dragging')
        track.setPointerCapture(e.pointerId)
      }

      s.currentTranslate = s.baseTranslate + delta
      setTransform(s.currentTranslate, false)
    }

    const onPointerUp = (e: PointerEvent) => {
      const s = dragState.current
      if (s.pointerId !== e.pointerId) return
      s.pointerId = null
      if (!s.dragging) return // never became a drag — let the tap's click through

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

    track.addEventListener('transitionend', normalizeIndex)
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', onPointerUp)
    track.addEventListener('pointercancel', onPointerUp)

    return () => {
      track.removeEventListener('transitionend', normalizeIndex)
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
