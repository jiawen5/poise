import { describe, expect, it } from 'vitest'
import { appReducer, createState, createTimer, dayKey, DEFAULT_SETTINGS, emptyStats, formatTime, loadState, MINUTE, serializable, validSavedData, validSettings } from './model'

const NOW = new Date(2026, 8, 21, 10).getTime()

describe('Pomodoro clock', () => {
  it('uses a deadline rather than drifting interval ticks', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'tick', now: NOW + 92_400 })
    expect(state.timer.remainingMs).toBe(25 * MINUTE - 92_400)
    expect(state.history[dayKey(NOW)].focusMs).toBe(92_400)
    expect(formatTime(state.timer.remainingMs)).toBe('23:28')
  })

  describe('local usage and data compatibility', () => {
    it('upgrades the previous saved format without losing history, timer or preferences', () => {
      const legacy = {
        version: 1,
        settings: {
          focusMinutes: 35, shortBreakMinutes: 7, longBreakMinutes: 20, longBreakAfter: 3,
          postureReminders: false, sensitivity: 'gentle', sound: false, notifications: false,
        },
        timer: { ...createTimer({ ...DEFAULT_SETTINGS, focusMinutes: 35 }), remainingMs: 20 * MINUTE },
        history: { '2026-09-21': { focusMs: 15 * MINUTE, sessions: 2, breaks: 1, exercises: 3, postureSamples: 20, alignedSamples: 18 } },
      }
      const { state, warning } = loadState({ getItem: () => JSON.stringify(legacy) })
      expect(warning).toBeNull()
      expect(state.version).toBe(2)
      expect(state.timer.remainingMs).toBe(20 * MINUTE)
      expect(state.settings).toMatchObject({ focusMinutes: 35, postureReminders: false, sound: false, postureSound: true, distanceReminders: true, usageTracking: true })
      expect(state.history['2026-09-21']).toMatchObject({ focusMs: 15 * MINUTE, exercises: 3, activeMs: 0, distanceAlerts: 0, distanceSamples: 0 })
      expect(validSavedData(serializable(state))).toBe(true)
    })
    it('records local feature usage without counting pause as another focus start', () => {
      let state = appReducer(createState(), { type: 'visit', now: NOW })
      state = appReducer(state, { type: 'toggle', now: NOW })
      state = appReducer(state, { type: 'toggle', now: NOW + 1000 })
      state = appReducer(state, { type: 'toggle', now: NOW + 2000 })
      state = appReducer(state, { type: 'exercise-started', now: NOW + 2500 })
      state = appReducer(state, { type: 'energy-checkin', now: NOW + 2700 })
      state = appReducer(state, { type: 'recovery', long: false, now: NOW + 3000 })
      expect(state.history[dayKey(NOW)]).toMatchObject({ visits: 1, focusStarts: 2, exerciseStarts: 1, energyCheckIns: 2, fatigueBreaks: 1 })
    })
    it('counts the warning categories that actually triggered', () => {
      let state = appReducer(createState(), { type: 'monitor-alert', posture: true, distance: false, now: NOW })
      state = appReducer(state, { type: 'monitor-alert', posture: false, distance: true, now: NOW + 90_000 })
      state = appReducer(state, { type: 'monitor-alert', posture: true, distance: true, now: NOW + 180_000 })
      expect(state.history[dayKey(NOW)]).toMatchObject({ postureAlerts: 2, distanceAlerts: 2 })
    })
    it('splits sampled usage across midnight and stops active time at the idle deadline', () => {
      const from = new Date(2026, 8, 21, 23, 59, 58).getTime()
      const state = appReducer(createState(), { type: 'usage', from, now: from + 5000, activeUntil: from + 3000, monitored: true })
      expect(state.history['2026-09-21']).toMatchObject({ activeMs: 2000, monitoredMs: 2000 })
      expect(state.history['2026-09-22']).toMatchObject({ activeMs: 1000, monitoredMs: 3000 })
    })
    it('does not fill unobserved gaps or track extra usage while disabled', () => {
      let state = appReducer(createState(), { type: 'usage', from: NOW, now: NOW + 60_000, activeUntil: NOW + 60_000, monitored: true })
      expect(state.history).toEqual({})
      state = appReducer(state, { type: 'settings', settings: { ...state.settings, usageTracking: false }, now: NOW })
      state = appReducer(state, { type: 'usage', from: NOW, now: NOW + 5000, activeUntil: NOW + 5000, monitored: true })
      state = appReducer(state, { type: 'monitor-alert', posture: true, distance: true, now: NOW + 5000 })
      state = appReducer(state, { type: 'exercise-started', now: NOW + 5000 })
      expect(state.history).toEqual({})
      state = appReducer(state, { type: 'toggle', now: NOW + 5000 })
      state = appReducer(state, { type: 'tick', now: NOW + 65_000 })
      expect(state.history[dayKey(NOW)]).toMatchObject({ focusMs: MINUTE, focusStarts: 0, postureAlerts: 0 })
    })
    it('records posture and distance quality independently, ignoring unavailable estimates', () => {
      let state = appReducer(createState(), { type: 'toggle', now: NOW })
      state = appReducer(state, { type: 'posture-sample', aligned: true, distanceInRange: null, now: NOW + 1000 })
      state = appReducer(state, { type: 'posture-sample', aligned: null, distanceInRange: false, now: NOW + 2000 })
      state = appReducer(state, { type: 'posture-sample', aligned: true, distanceInRange: true, now: NOW + 3000 })
      expect(state.history[dayKey(NOW)]).toMatchObject({ postureSamples: 2, alignedSamples: 2, distanceSamples: 2, comfortableDistanceSamples: 1 })
    })
    it('validates the new settings and distance-history invariants', () => {
      expect(validSettings(DEFAULT_SETTINGS)).toBe(true)
      expect(validSettings({ ...DEFAULT_SETTINGS, distanceMinCm: 80, distanceMaxCm: 50 })).toBe(false)
      expect(validSettings({ ...DEFAULT_SETTINGS, distanceMinCm: 50.5 })).toBe(false)
      const state = createState()
      state.history[dayKey(NOW)] = { ...emptyStats(), distanceSamples: 2, comfortableDistanceSamples: 3 }
      expect(validSavedData(state)).toBe(false)
    })
  })

  it('pauses without recording paused time and resumes exactly', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'pause', now: NOW + MINUTE })
    state = appReducer(state, { type: 'toggle', now: NOW + 10 * MINUTE })
    expect(state.timer.deadline).toBe(NOW + 34 * MINUTE)
    expect(state.history[dayKey(NOW)].focusMs).toBe(MINUTE)
  })

  it('preserves remaining time if the system clock moves backward', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'tick', now: NOW + MINUTE })
    state = appReducer(state, { type: 'tick', now: NOW - MINUTE })
    expect(state.timer.remainingMs).toBe(24 * MINUTE)
    expect(state.history[dayKey(NOW)].focusMs).toBe(MINUTE)
    state = appReducer(state, { type: 'tick', now: NOW })
    expect(state.timer.remainingMs).toBe(23 * MINUTE)
    expect(state.history[dayKey(NOW)].focusMs).toBe(2 * MINUTE)
  })

  it('starts a full break after focus expires, even after a suspended tab', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'tick', now: NOW + 70 * MINUTE })
    expect(state.timer.mode).toBe('shortBreak')
    expect(state.timer.deadline).toBe(NOW + 75 * MINUTE)
    expect(state.history[dayKey(NOW)]).toMatchObject({ focusMs: 25 * MINUTE, sessions: 1, breaks: 0 })
    state = appReducer(state, { type: 'tick', now: NOW + 70 * MINUTE })
    expect(state.history[dayKey(NOW)].sessions).toBe(1)
  })

  it('uses a long break after four completed focus sessions', () => {
    let state = createState()
    state.timer.completedInCycle = 3
    state = appReducer(state, { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'tick', now: NOW + 25 * MINUTE })
    expect(state.timer.mode).toBe('longBreak')
    expect(state.timer.remainingMs).toBe(15 * MINUTE)
    expect(state.timer.completedInCycle).toBe(0)
  })

  it('preserves interrupted focus across a fatigue break', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'recovery', long: false, now: NOW + 3 * MINUTE })
    expect(state.timer.suspendedFocus?.remainingMs).toBe(22 * MINUTE)
    expect(state.timer.mode).toBe('shortBreak')
    state = appReducer(state, { type: 'tick', now: NOW + 8 * MINUTE })
    expect(state.timer.mode).toBe('focus')
    expect(state.timer.remainingMs).toBe(22 * MINUTE)
    expect(state.timer.deadline).toBeNull()
    expect(state.history[dayKey(NOW)]).toMatchObject({ sessions: 0, breaks: 1, focusMs: 3 * MINUTE })
  })

  it('does not count skipped breaks, and restores interrupted work', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'mode', mode: 'shortBreak', now: NOW + MINUTE })
    state = appReducer(state, { type: 'skip-break', now: NOW + 2 * MINUTE })
    expect(state.timer.remainingMs).toBe(24 * MINUTE)
    expect(state.history[dayKey(NOW)].breaks).toBe(0)
  })

  it('does not change an active session when durations are edited', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'settings', settings: { ...state.settings, focusMinutes: 40 }, now: NOW + MINUTE })
    expect(state.timer.durationMs).toBe(25 * MINUTE)
    expect(state.timer.deadline).toBe(NOW + 25 * MINUTE)
  })

  it('splits focus time across local midnight', () => {
    const start = new Date(2026, 8, 21, 23, 55).getTime()
    let state = appReducer(createState(), { type: 'toggle', now: start })
    state = appReducer(state, { type: 'tick', now: start + 10 * MINUTE })
    expect(state.history['2026-09-21'].focusMs).toBe(5 * MINUTE)
    expect(state.history['2026-09-22'].focusMs).toBe(5 * MINUTE)
  })

  it('can restore an active clock without double-counting recorded focus', () => {
    let state = appReducer(createState(), { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'tick', now: NOW + MINUTE })
    const saved = JSON.parse(JSON.stringify(serializable(state)))
    expect(validSavedData(saved)).toBe(true)
    state = appReducer({ ...saved, event: null }, { type: 'tick', now: NOW + 2 * MINUTE })
    expect(state.history[dayKey(NOW)].focusMs).toBe(2 * MINUTE)
  })

  it('only records posture observations during running focus sessions', () => {
    let state = appReducer(createState(), { type: 'posture-sample', aligned: true, now: NOW })
    expect(state.history).toEqual({})
    state = appReducer(state, { type: 'toggle', now: NOW })
    state = appReducer(state, { type: 'posture-sample', aligned: true, now: NOW + 5000 })
    expect(state.history[dayKey(NOW)].alignedSamples).toBe(1)
  })

  it('rejects malformed, non-finite and inconsistent stored data', () => {
    expect(validSavedData(serializable(createState()))).toBe(true)
    expect(validSavedData({ ...serializable(createState()), timer: { durationMs: NaN } })).toBe(false)
    const state = createState()
    expect(validSavedData({ ...state, settings: { ...state.settings, focusMinutes: 2.5 } })).toBe(false)
    state.timer.deadline = NOW
    expect(validSavedData(state)).toBe(false)
    state.timer.deadline = null
    state.history['2026-09-21'] = { ...emptyStats(), alignedSamples: 2 }
    expect(validSavedData(state)).toBe(false)
  })
})
