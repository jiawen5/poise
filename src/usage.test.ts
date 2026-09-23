import { describe, expect, it } from 'vitest'
import { emptyStats } from './model'
import { activityCsv, IDLE_AFTER_MS, usageWindow, type UsageSnapshot } from './usage'

const snapshot = (at: number, visible = true, observedAt: number | null = null): UsageSnapshot => ({ at, visible, observedAt })

describe('privacy-preserving usage windows', () => {
  it('counts visible recent activity, but not idle or background app use', () => {
    expect(usageWindow(snapshot(1000), snapshot(6000), 1000)).toMatchObject({ from: 1000, activeUntil: 6000, monitored: false })
    expect(usageWindow(snapshot(IDLE_AFTER_MS + 1), snapshot(IDLE_AFTER_MS + 5001), 0)).toBeNull()
    expect(usageWindow(snapshot(1000, false), snapshot(6000, false), 1000)).toBeNull()
  })
  it('cuts active time off exactly at five minutes without interaction', () => {
    expect(usageWindow(snapshot(IDLE_AFTER_MS - 1000), snapshot(IDLE_AFTER_MS + 4000), 0)?.activeUntil).toBe(IDLE_AFTER_MS)
  })
  it('can count fresh background monitoring without claiming active app use', () => {
    expect(usageWindow(snapshot(1000, false, 900), snapshot(6000, false, 5800), 0))
      .toMatchObject({ monitored: true, activeUntil: null })
  })
  it('excludes stale camera frames, suspension and backward clock jumps', () => {
    expect(usageWindow(snapshot(1000, false, 900), snapshot(6000, false, 900), 0)).toBeNull()
    expect(usageWindow(snapshot(1000), snapshot(7001), 1000)).toBeNull()
    expect(usageWindow(snapshot(5000), snapshot(1000), 1000)).toBeNull()
  })
  it('exports real numeric totals with explicit units and no identifiers', () => {
    const csv = activityCsv([{ key: '2026-09-22', stats: { ...emptyStats(), activeMs: 5500, focusMs: 65_000, postureAlerts: 2, distanceAlerts: 1 } }])
    const [header, row] = csv.trim().split('\r\n').map(line => line.split(','))
    expect(header).toContain('Active app seconds')
    expect(row[header.indexOf('Active app seconds')]).toBe('5')
    expect(row[header.indexOf('Focus seconds')]).toBe('65')
    expect(row[header.indexOf('Posture alerts')]).toBe('2')
    expect(row[header.indexOf('Distance alerts')]).toBe('1')
    expect(header).not.toContain('User ID')
    expect(row).toHaveLength(header.length)
  })
})
