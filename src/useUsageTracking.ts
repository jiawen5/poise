import { useCallback, useEffect, useRef, type Dispatch } from 'react'
import type { Action } from './model'
import { IDLE_AFTER_MS, USAGE_SAMPLE_MS, usageWindow, type UsageSnapshot } from './usage'

export function useUsageTracking(enabled: boolean, observedAt: number | null, dispatch: Dispatch<Action>) {
  const observation = useRef(observedAt)
  observation.current = observedAt
  const visitRecorded = useRef(false)
  const resetRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) return
    let lastActivityAt = Date.now()
    const snapshot = (): UsageSnapshot => ({
      at: Date.now(), visible: !document.hidden, observedAt: observation.current,
    })
    let previous = snapshot()
    if (!visitRecorded.current) {
      visitRecorded.current = true
      dispatch({ type: 'visit', now: previous.at })
    }
    const sample = () => {
      const current = snapshot()
      const action = usageWindow(previous, current, lastActivityAt)
      previous = current
      if (action) dispatch(action)
    }
    const activity = () => {
      const now = Date.now()
      if (now - lastActivityAt > IDLE_AFTER_MS) sample()
      lastActivityAt = now
    }
    const visibility = () => {
      sample()
      if (!document.hidden) lastActivityAt = Date.now()
    }
    resetRef.current = () => { previous = snapshot() }
    const interval = window.setInterval(sample, USAGE_SAMPLE_MS)
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('pointermove', activity, { passive: true })
    window.addEventListener('keydown', activity)
    window.addEventListener('scroll', activity, { passive: true, capture: true })
    window.addEventListener('focus', activity)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearInterval(interval)
      resetRef.current = null
      window.removeEventListener('pointerdown', activity)
      window.removeEventListener('pointermove', activity)
      window.removeEventListener('keydown', activity)
      window.removeEventListener('scroll', activity, true)
      window.removeEventListener('focus', activity)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [enabled, dispatch])

  return useCallback(() => resetRef.current?.(), [])
}
