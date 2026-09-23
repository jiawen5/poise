import { useEffect, useReducer, useRef, useState } from 'react'
import { appReducer, createState, dayKey, loadState, serializable, STORAGE_KEY } from './model'

export function useAppState() {
  const [restored] = useState(() => {
    try {
      return loadState(window.localStorage)
    } catch (error) {
      console.warn('Browser storage is unavailable.', error)
      return { state: createState(), warning: 'Browser storage is unavailable. Your activity will not be saved after closing this page.' }
    }
  })
  const [state, dispatch] = useReducer(appReducer, restored.state)
  const [storageWarning, setStorageWarning] = useState(restored.warning)
  const [todayKey, setTodayKey] = useState(() => dayKey(Date.now()))
  const latest = useRef(state)

  useEffect(() => {
    latest.current = state
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable(state)))
    } catch (error) {
      console.warn('Activity could not be saved.', error)
      setStorageWarning('Your browser could not save activity. Keep this page open to preserve your current session.')
    }
  }, [state])

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setTodayKey(dayKey(now))
      dispatch({ type: 'tick', now })
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    const onVisibility = () => { if (!document.hidden) tick() }
    const onPageHide = () => {
      try {
        const updated = appReducer(latest.current, { type: 'tick', now: Date.now() })
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable(updated)))
      } catch (error) {
        console.warn('The final timer update could not be saved.', error)
        setStorageWarning('Your last timer update could not be saved by this browser.')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  return { state, dispatch, storageWarning, todayKey }
}
