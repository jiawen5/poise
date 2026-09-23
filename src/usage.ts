import type { Action, DayStats } from './model'

export const IDLE_AFTER_MS = 5 * 60_000
export const USAGE_SAMPLE_MS = 5000

export interface UsageSnapshot {
  at: number
  visible: boolean
  observedAt: number | null
}

export function usageWindow(previous: UsageSnapshot, current: UsageSnapshot, lastActivityAt: number): Extract<Action, { type: 'usage' }> | null {
  const elapsed = current.at - previous.at
  if (elapsed <= 0 || elapsed > 6000) return null
  const activeUntil = previous.visible ? Math.min(current.at, lastActivityAt + IDLE_AFTER_MS) : null
  const fresh = (sample: UsageSnapshot) => sample.observedAt !== null
    && sample.at >= sample.observedAt && sample.at - sample.observedAt <= 2500
  const monitored = fresh(previous) && fresh(current)
  if ((activeUntil === null || activeUntil <= previous.at) && !monitored) return null
  return { type: 'usage', from: previous.at, now: current.at, activeUntil, monitored }
}

export function activityCsv(days: { key: string; stats: DayStats }[]): string {
  const columns: { label: string; value: (stats: DayStats) => number }[] = [
    { label: 'Focus seconds', value: stats => Math.floor(stats.focusMs / 1000) },
    { label: 'Completed rounds', value: stats => stats.sessions },
    { label: 'Completed breaks', value: stats => stats.breaks },
    { label: 'Completed resets', value: stats => stats.exercises },
    { label: 'Active app seconds', value: stats => Math.floor(stats.activeMs / 1000) },
    { label: 'Monitored seconds', value: stats => Math.floor(stats.monitoredMs / 1000) },
    { label: 'Workspace visits', value: stats => stats.visits },
    { label: 'Focus starts and resumes', value: stats => stats.focusStarts },
    { label: 'Reset starts', value: stats => stats.exerciseStarts },
    { label: 'Energy check-ins', value: stats => stats.energyCheckIns },
    { label: 'Fatigue breaks', value: stats => stats.fatigueBreaks },
    { label: 'Posture alerts', value: stats => stats.postureAlerts },
    { label: 'Distance alerts', value: stats => stats.distanceAlerts },
    { label: 'Posture samples', value: stats => stats.postureSamples },
    { label: 'Aligned samples', value: stats => stats.alignedSamples },
    { label: 'Distance samples', value: stats => stats.distanceSamples },
    { label: 'Distance in range samples', value: stats => stats.comfortableDistanceSamples },
  ]
  return [
    ['Date', ...columns.map(column => column.label)].join(','),
    ...days.map(day => [day.key, ...columns.map(column => column.value(day.stats))].join(',')),
  ].join('\r\n') + '\r\n'
}
