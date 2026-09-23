import { Coffee, Flame, Leaf, ScanLine, Sprout, Timer } from 'lucide-react'
import { dayKey, emptyStats, formatMinutes, sumStats, type SavedData } from '../model'
import { UsageInsights } from './UsageInsights'

export function ProgressPanel({ history, usageTracking, onSettings, onNotice }: {
  history: SavedData['history']
  usageTracking: boolean
  onSettings: () => void
  onNotice: (title: string, message: string, error?: boolean) => void
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return { date, key: dayKey(date.getTime()), stats: history[dayKey(date.getTime())] ?? emptyStats() }
  })
  const total = sumStats(days.map(day => day.stats))
  const maximum = Math.max(30 * 60_000, ...days.map(day => day.stats.focusMs))
  const aligned = total.postureSamples ? Math.round(total.alignedSamples / total.postureSamples * 100) : null
  const comfortableDistance = total.distanceSamples ? Math.round(total.comfortableDistanceSamples / total.distanceSamples * 100) : null

  return (
    <div className="progress-page">
      <div className="progress-summary">
        <div className="panel progress-metric"><Timer size={20} /><strong>{formatMinutes(total.focusMs)}</strong><span>Time well focused</span></div>
        <div className="panel progress-metric"><Flame size={20} /><strong>{total.sessions}</strong><span>Completed focus rounds</span></div>
        <div className="panel progress-metric"><Coffee size={20} /><strong>{total.breaks}</strong><span>Restful breaks</span></div>
        <div className="panel progress-metric"><Sprout size={20} /><strong>{total.exercises}</strong><span>Guided resets</span></div>
      </div>
      <UsageInsights days={days} total={total} enabled={usageTracking} onSettings={onSettings} onNotice={onNotice} />
      <section className="panel rhythm-panel" aria-labelledby="rhythm-heading">
        <div className="section-heading"><div><span className="eyebrow">PROGRESS, NOT PERFECTION</span><h2 id="rhythm-heading">Your week, at your pace.</h2></div><span className="quiet-pill">Last 7 days</span></div>
        <div className="activity-chart" aria-label="Daily focus time for the last seven days">
          {days.map((day, index) => (
            <div className={`chart-day ${index === 6 ? 'today' : ''}`} key={day.key}>
              <span className="chart-value">{formatMinutes(day.stats.focusMs)}</span>
              <div className="chart-column"><div className="chart-bar" style={{ height: `${Math.max(2, day.stats.focusMs / maximum * 100)}%` }} /></div>
              <span className="chart-label">{index === 6 ? 'Today' : day.date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            </div>
          ))}
        </div>
        {total.focusMs === 0 && <p className="chart-empty"><Leaf size={16} />Your next focus session is the start of something good.</p>}
      </section>
      <div className="progress-details">
        <section className="panel posture-summary">
          <span className="soft-icon sage"><ScanLine size={23} /></span><h2>A little more awareness.</h2>
          <strong>{aligned === null ? 'Not measured yet' : `${aligned}% aligned`}</strong>
          <p>{aligned === null ? 'Enable your camera, calibrate your posture, and start focusing. Your observations will show up here.' : `Across ${total.postureSamples} observed check-ins during focused work this week. Small shifts are normal; moving regularly matters, too.`}</p>
          <p className="small-note">An estimate relative to your own baseline, not a medical assessment.</p>
          <div className="distance-progress"><h3>Comfortable screen distance</h3><strong>{comfortableDistance === null ? 'Not measured yet' : `${comfortableDistance}% in range`}</strong><p>{comfortableDistance === null ? 'Face your camera and calibrate to include distance in your focused-work check-ins.' : `Across ${total.distanceSamples} reliable distance check-ins during focused work.`}</p></div>
        </section>
        <section className="panel activity-table-panel">
          <h2>The little things add up.</h2>
          <div className="table-scroll">
            <table className="activity-table">
              <thead><tr><th>Day</th><th>Focus</th><th>Rounds</th><th>Breaks</th><th>Resets</th></tr></thead>
              <tbody>{days.slice().reverse().map(day => (
                <tr key={day.key}><td>{day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td>{formatMinutes(day.stats.focusMs)}</td><td>{day.stats.sessions}</td><td>{day.stats.breaks}</td><td>{day.stats.exercises}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
