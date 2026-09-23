export type TimerMode = 'focus' | 'shortBreak' | 'longBreak'
export type Sensitivity = 'gentle' | 'balanced' | 'sensitive'

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakAfter: number
  postureReminders: boolean
  sensitivity: Sensitivity
  sound: boolean
  postureSound: boolean
  distanceReminders: boolean
  distanceMinCm: number
  distanceMaxCm: number
  usageTracking: boolean
  notifications: boolean
}

export interface FocusSnapshot {
  remainingMs: number
  durationMs: number
}

export interface TimerState extends FocusSnapshot {
  mode: TimerMode
  deadline: number | null
  accountedAt: number | null
  completedInCycle: number
  suspendedFocus: FocusSnapshot | null
}

export const STAT_FIELDS = [
  'focusMs', 'sessions', 'breaks', 'exercises', 'postureSamples', 'alignedSamples',
  'distanceSamples', 'comfortableDistanceSamples', 'activeMs', 'monitoredMs', 'visits',
  'focusStarts', 'exerciseStarts', 'energyCheckIns', 'fatigueBreaks', 'postureAlerts', 'distanceAlerts',
] as const
export type StatField = typeof STAT_FIELDS[number]
export type DayStats = Record<StatField, number>
type LegacySettings = Pick<Settings, 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakAfter' | 'postureReminders' | 'sensitivity' | 'sound' | 'notifications'>
type LegacyDayStats = Pick<DayStats, 'focusMs' | 'sessions' | 'breaks' | 'exercises' | 'postureSamples' | 'alignedSamples'>

export interface SavedData {
  version: 2
  settings: Settings
  timer: TimerState
  history: Record<string, DayStats>
}

interface LegacySavedData {
  version: 1
  settings: LegacySettings
  timer: TimerState
  history: Record<string, LegacyDayStats>
}

export interface AppEvent {
  kind: 'focus-complete' | 'break-complete' | 'recovery'
  at: number
}

export interface AppState extends SavedData {
  event: AppEvent | null
}

export const STORAGE_KEY = 'poise.workspace.v1'
export const MINUTE = 60_000
export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 4,
  postureReminders: true,
  sensitivity: 'balanced',
  sound: false,
  postureSound: true,
  distanceReminders: true,
  distanceMinCm: 50,
  distanceMaxCm: 80,
  usageTracking: true,
  notifications: false,
}

export function durationFor(mode: TimerMode, settings: Settings): number {
  return settings[mode === 'focus' ? 'focusMinutes' : mode === 'shortBreak' ? 'shortBreakMinutes' : 'longBreakMinutes'] * MINUTE
}

export function createTimer(settings = DEFAULT_SETTINGS, mode: TimerMode = 'focus'): TimerState {
  return {
    mode,
    remainingMs: durationFor(mode, settings),
    durationMs: durationFor(mode, settings),
    deadline: null,
    accountedAt: null,
    completedInCycle: 0,
    suspendedFocus: null,
  }
}

export function createState(): AppState {
  return { version: 2, settings: { ...DEFAULT_SETTINGS }, timer: createTimer(), history: {}, event: null }
}

export function dayKey(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function emptyStats(): DayStats {
  return {
    focusMs: 0, sessions: 0, breaks: 0, exercises: 0, postureSamples: 0, alignedSamples: 0,
    distanceSamples: 0, comfortableDistanceSamples: 0, activeMs: 0, monitoredMs: 0, visits: 0,
    focusStarts: 0, exerciseStarts: 0, energyCheckIns: 0, fatigueBreaks: 0, postureAlerts: 0, distanceAlerts: 0,
  }
}

export function sumStats(days: DayStats[]): DayStats {
  const total = emptyStats()
  for (const day of days) {
    for (const field of STAT_FIELDS) total[field] += day[field]
  }
  return total
}

function updateDay(history: SavedData['history'], time: number, update: Partial<DayStats>): SavedData['history'] {
  const key = dayKey(time)
  const previous = { ...emptyStats(), ...history[key] }
  return { ...history, [key]: { ...previous, ...update } }
}

function incrementDay(history: SavedData['history'], time: number, increments: Partial<DayStats>): SavedData['history'] {
  const stats = { ...emptyStats(), ...history[dayKey(time)] }
  for (const field of STAT_FIELDS) stats[field] += increments[field] ?? 0
  return updateDay(history, time, stats)
}

function recordTime(history: SavedData['history'], from: number, to: number, field: 'focusMs' | 'activeMs' | 'monitoredMs'): SavedData['history'] {
  let result = history
  let cursor = from
  while (cursor < to) {
    const nextMidnight = new Date(cursor)
    nextMidnight.setHours(24, 0, 0, 0)
    const end = Math.min(to, nextMidnight.getTime())
    result = incrementDay(result, cursor, { [field]: end - cursor })
    cursor = end
  }
  return result
}

export function remainingTime(timer: TimerState, now: number): number {
  return timer.deadline === null ? timer.remainingMs : Math.max(0, Math.min(timer.durationMs, timer.deadline - now))
}

function advance(state: AppState, now: number): AppState {
  const { timer, settings } = state
  if (timer.deadline === null || timer.accountedAt === null) return state
  if (now < timer.accountedAt) {
    return { ...state, timer: { ...timer, deadline: now + timer.remainingMs, accountedAt: now } }
  }
  const until = Math.min(now, timer.deadline)
  let history = timer.mode === 'focus'
    ? recordTime(state.history, timer.accountedAt, until, 'focusMs')
    : state.history
  if (now < timer.deadline) {
    return { ...state, history, timer: { ...timer, remainingMs: remainingTime(timer, now), accountedAt: now } }
  }

  const stats = history[dayKey(timer.deadline)] ?? emptyStats()
  if (timer.mode === 'focus') {
    const completed = timer.completedInCycle + 1
    const isLong = completed >= settings.longBreakAfter
    const mode = isLong ? 'longBreak' : 'shortBreak'
    const durationMs = durationFor(mode, settings)
    history = updateDay(history, timer.deadline, { sessions: stats.sessions + 1 })
    return {
      ...state,
      history,
      timer: {
        ...createTimer(settings, mode),
        deadline: now + durationMs,
        accountedAt: now,
        completedInCycle: isLong ? 0 : completed,
      },
      event: { kind: 'focus-complete', at: now },
    }
  }

  history = updateDay(history, timer.deadline, { breaks: stats.breaks + 1 })
  return {
    ...state,
    history,
    timer: {
      ...createTimer(settings),
      ...timer.suspendedFocus,
      completedInCycle: timer.completedInCycle,
    },
    event: { kind: 'break-complete', at: now },
  }
}

export type Action =
  | { type: 'tick' | 'toggle' | 'pause' | 'reset' | 'skip-break' | 'exercise-complete' | 'exercise-started' | 'visit' | 'energy-checkin' | 'clear-history'; now: number }
  | { type: 'mode'; mode: TimerMode; now: number }
  | { type: 'recovery'; long: boolean; now: number }
  | { type: 'settings'; settings: Settings; now: number }
  | { type: 'posture-sample'; aligned: boolean | null; distanceInRange?: boolean | null; now: number }
  | { type: 'monitor-alert'; posture: boolean; distance: boolean; now: number }
  | { type: 'usage'; from: number; activeUntil: number | null; monitored: boolean; now: number }

function withUsage(state: AppState, now: number, increments: Partial<DayStats>): AppState {
  return state.settings.usageTracking && Object.keys(increments).length > 0
    ? { ...state, history: incrementDay(state.history, now, increments) }
    : state
}

export function appReducer(previous: AppState, action: Action): AppState {
  const restored = previous.version === 2 ? previous : migrateSavedData(previous)
  if (!restored) throw new Error('The current workspace data could not be upgraded.')
  const state = advance(restored === previous ? previous : { ...restored, event: previous.event }, action.now)
  const { timer, settings } = state
  switch (action.type) {
    case 'tick':
      return state
    case 'toggle':
      return {
        ...withUsage(state, action.now, timer.deadline === null && timer.mode === 'focus' ? { focusStarts: 1 } : {}),
        timer: timer.deadline !== null
          ? { ...timer, deadline: null, accountedAt: null }
          : { ...timer, deadline: action.now + timer.remainingMs, accountedAt: action.now },
      }
    case 'pause':
      return timer.deadline === null ? state : { ...state, timer: { ...timer, deadline: null, accountedAt: null } }
    case 'reset':
      return {
        ...state,
        timer: {
          ...timer,
          remainingMs: timer.durationMs,
          deadline: null,
          accountedAt: null,
        },
      }
    case 'skip-break':
      if (timer.mode === 'focus') return state
      return {
        ...state,
        timer: { ...createTimer(settings), ...timer.suspendedFocus, completedInCycle: timer.completedInCycle },
      }
    case 'mode': {
      if (action.mode === timer.mode) return state
      if (action.mode === 'focus') {
        return {
          ...state,
          timer: { ...createTimer(settings), ...timer.suspendedFocus, completedInCycle: timer.completedInCycle },
        }
      }
      const suspendedFocus = timer.mode === 'focus'
        ? { remainingMs: timer.remainingMs, durationMs: timer.durationMs }
        : timer.suspendedFocus
      return {
        ...state,
        timer: { ...createTimer(settings, action.mode), suspendedFocus, completedInCycle: timer.completedInCycle },
      }
    }
    case 'recovery': {
      const mode = action.long ? 'longBreak' : 'shortBreak'
      const durationMs = durationFor(mode, settings)
      return {
        ...withUsage(state, action.now, { energyCheckIns: 1, fatigueBreaks: 1 }),
        timer: {
          ...createTimer(settings, mode),
          deadline: action.now + durationMs,
          accountedAt: action.now,
          completedInCycle: timer.completedInCycle,
          suspendedFocus: timer.mode === 'focus'
            ? { remainingMs: timer.remainingMs, durationMs: timer.durationMs }
            : timer.suspendedFocus,
        },
        event: { kind: 'recovery', at: action.now },
      }
    }
    case 'settings': {
      const isFresh = timer.deadline === null && timer.remainingMs === timer.durationMs
      const durationMs = durationFor(timer.mode, action.settings)
      return {
        ...state,
        settings: action.settings,
        timer: {
          ...timer,
          ...(isFresh ? { durationMs, remainingMs: durationMs } : {}),
          completedInCycle: Math.min(timer.completedInCycle, action.settings.longBreakAfter - 1),
        },
      }
    }
    case 'posture-sample': {
      if (timer.mode !== 'focus' || timer.deadline === null) return state
      const stats = { ...emptyStats(), ...state.history[dayKey(action.now)] }
      const measuredPosture = typeof action.aligned === 'boolean'
      const measuredDistance = typeof action.distanceInRange === 'boolean'
      if (!measuredPosture && !measuredDistance) return state
      return {
        ...state,
        history: updateDay(state.history, action.now, {
          postureSamples: stats.postureSamples + Number(measuredPosture),
          alignedSamples: stats.alignedSamples + Number(action.aligned === true),
          distanceSamples: stats.distanceSamples + Number(measuredDistance),
          comfortableDistanceSamples: stats.comfortableDistanceSamples + Number(action.distanceInRange === true),
        }),
      }
    }
    case 'exercise-complete': {
      const stats = state.history[dayKey(action.now)] ?? emptyStats()
      return { ...state, history: updateDay(state.history, action.now, { exercises: stats.exercises + 1 }) }
    }
    case 'exercise-started':
      return withUsage(state, action.now, { exerciseStarts: 1 })
    case 'visit':
      return withUsage(state, action.now, { visits: 1 })
    case 'energy-checkin':
      return withUsage(state, action.now, { energyCheckIns: 1 })
    case 'monitor-alert':
      return withUsage(state, action.now, { postureAlerts: Number(action.posture), distanceAlerts: Number(action.distance) })
    case 'usage': {
      const elapsed = action.now - action.from
      if (!settings.usageTracking || elapsed <= 0 || elapsed > 6000) return state
      let history = state.history
      if (action.activeUntil !== null) {
        history = recordTime(history, action.from, Math.min(action.now, action.activeUntil), 'activeMs')
      }
      if (action.monitored) history = recordTime(history, action.from, action.now, 'monitoredMs')
      return history === state.history ? state : { ...state, history }
    }
    case 'clear-history':
      return { ...state, history: {} }
  }
}

export function formatTime(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function formatMinutes(ms: number): string {
  const minutes = Math.floor(ms / MINUTE)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

export function formatUsageTime(ms: number): string {
  return ms < MINUTE ? `${Math.floor(ms / 1000)}s` : formatMinutes(ms)
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validLegacySettings(value: unknown): value is LegacySettings {
  return record(value)
    && finite(value.focusMinutes, 1, 120)
    && finite(value.shortBreakMinutes, 1, 30)
    && finite(value.longBreakMinutes, 1, 60)
    && [value.focusMinutes, value.shortBreakMinutes, value.longBreakMinutes].every(Number.isInteger)
    && finite(value.longBreakAfter, 2, 8) && Number.isInteger(value.longBreakAfter)
    && typeof value.postureReminders === 'boolean'
    && ['gentle', 'balanced', 'sensitive'].includes(String(value.sensitivity))
    && typeof value.sound === 'boolean'
    && typeof value.notifications === 'boolean'
}

export function validSettings(value: unknown): value is Settings {
  return record(value)
    && typeof value.postureSound === 'boolean'
    && typeof value.distanceReminders === 'boolean'
    && typeof value.usageTracking === 'boolean'
    && finite(value.distanceMinCm, 20, 150) && Number.isInteger(value.distanceMinCm)
    && finite(value.distanceMaxCm, 30, 200) && Number.isInteger(value.distanceMaxCm)
    && value.distanceMaxCm > value.distanceMinCm
    && validLegacySettings(value)
}

function validSnapshot(value: unknown): value is FocusSnapshot {
  return record(value)
    && finite(value.durationMs, MINUTE, 120 * MINUTE)
    && finite(value.remainingMs, 0, value.durationMs)
}

function validTimer(timer: unknown): timer is TimerState {
  if (!record(timer) || !validSnapshot(timer)) return false
  if (!['focus', 'shortBreak', 'longBreak'].includes(String(timer.mode))) return false
  if (!finite(timer.completedInCycle, 0, 7) || !Number.isInteger(timer.completedInCycle)) return false
  if (timer.suspendedFocus !== null && !validSnapshot(timer.suspendedFocus)) return false
  if (timer.deadline !== null && !finite(timer.deadline)) return false
  if (timer.accountedAt !== null && !finite(timer.accountedAt)) return false
  if ((timer.deadline === null) !== (timer.accountedAt === null)) return false
  if (typeof timer.deadline === 'number' && typeof timer.accountedAt === 'number'
    && (timer.deadline < timer.accountedAt || timer.deadline - timer.accountedAt > timer.durationMs)) return false
  return true
}

function validLegacyHistory(history: unknown): history is Record<string, LegacyDayStats> {
  return record(history) && Object.keys(history).length <= 10000 && Object.entries(history).every(([key, stats]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(key) && record(stats)
    && ['focusMs', 'sessions', 'breaks', 'exercises', 'postureSamples', 'alignedSamples'].every(field => finite(stats[field]))
    && Number(stats.alignedSamples) <= Number(stats.postureSamples),
  )
}

export function validSavedData(value: unknown): value is SavedData {
  if (!record(value) || value.version !== 2 || !validSettings(value.settings) || !validTimer(value.timer)) return false
  if (!validLegacyHistory(value.history)) return false
  return Object.values(value.history).every((stats: unknown) => record(stats)
    && STAT_FIELDS.every(field => finite(stats[field]))
    && Number(stats.comfortableDistanceSamples) <= Number(stats.distanceSamples))
}

function validLegacyData(value: unknown): value is LegacySavedData {
  return record(value) && value.version === 1 && validLegacySettings(value.settings)
    && validTimer(value.timer) && validLegacyHistory(value.history)
}

export function migrateSavedData(value: unknown): SavedData | null {
  if (validSavedData(value)) return value
  if (!validLegacyData(value)) return null
  const history: SavedData['history'] = {}
  for (const [key, stats] of Object.entries(value.history)) history[key] = { ...emptyStats(), ...stats }
  const upgraded: SavedData = {
    version: 2, settings: { ...DEFAULT_SETTINGS, ...value.settings }, timer: value.timer, history,
  }
  return validSavedData(upgraded) ? upgraded : null
}

export function loadState(storage: Pick<Storage, 'getItem'>): { state: AppState; warning: string | null } {
  try {
    const text = storage.getItem(STORAGE_KEY)
    if (!text) return { state: createState(), warning: null }
    const data: unknown = JSON.parse(text)
    const restored = migrateSavedData(data)
    if (!restored) throw new Error('Saved data has an invalid format.')
    return { state: { ...restored, event: null }, warning: null }
  } catch (error) {
    console.warn('Poise could not restore saved activity.', error)
    return {
      state: createState(),
      warning: 'Your saved activity could not be restored. This session is starting fresh.',
    }
  }
}

export function serializable(state: AppState): SavedData {
  const history: SavedData['history'] = {}
  for (const [key, stats] of Object.entries(state.history)) history[key] = { ...emptyStats(), ...stats }
  return { version: 2, settings: { ...DEFAULT_SETTINGS, ...state.settings }, timer: state.timer, history }
}
