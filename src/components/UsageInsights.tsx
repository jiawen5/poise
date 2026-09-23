import { Activity, Bell, Download, Monitor, Ruler, ShieldCheck } from 'lucide-react'
import { formatUsageTime, type DayStats } from '../model'
import { activityCsv } from '../usage'

export function UsageInsights({ days, total, enabled, onSettings, onNotice }: {
  days: { key: string; stats: DayStats }[]
  total: DayStats
  enabled: boolean
  onSettings: () => void
  onNotice: (title: string, message: string, error?: boolean) => void
}) {
  function exportReport() {
    let url: string | null = null
    try {
      url = URL.createObjectURL(new Blob([activityCsv(days)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `poise-activity-${days[days.length - 1].key}.csv`
      document.body.append(link)
      link.click()
      link.remove()
    } catch (error) {
      console.warn('The local activity report could not be prepared.', error)
      onNotice('Report export is unavailable', 'This browser could not create the download. Your activity is still stored locally.', true)
    } finally {
      if (url) {
        const createdUrl = url
        window.setTimeout(() => URL.revokeObjectURL(createdUrl), 1000)
      }
    }
  }

  return (
    <section className="panel usage-insights" aria-labelledby="usage-heading">
      <div className="section-heading"><div><span className="eyebrow">ONLY ON THIS DEVICE</span><h2 id="usage-heading">How you use your space.</h2><p>Local usage insights for the last seven days.</p></div>
        <button className="button secondary usage-export" onClick={exportReport} aria-label="Export 7-day activity report"><Download size={15} />Export CSV</button>
      </div>
      <div className="usage-metrics">
        <div><Activity size={18} /><strong>{formatUsageTime(total.activeMs)}</strong><span>Active app time</span></div>
        <div><Monitor size={18} /><strong>{formatUsageTime(total.monitoredMs)}</strong><span>Monitored time</span></div>
        <div><Bell size={18} /><strong>{total.postureAlerts}</strong><span>Posture warnings</span></div>
        <div><Ruler size={18} /><strong>{total.distanceAlerts}</strong><span>Distance warnings</span></div>
      </div>
      <div className="usage-events">
        <span><strong>{total.visits}</strong> workspace visits</span>
        <span><strong>{total.focusStarts}</strong> focus starts / resumes</span>
        <span><strong>{total.exerciseStarts}</strong> resets started</span>
        <span><strong>{total.energyCheckIns}</strong> energy check-ins</span>
        <span><strong>{total.fatigueBreaks}</strong> fatigue breaks</span>
      </div>
      <div className="usage-table-wrap table-scroll">
        <table className="activity-table usage-table">
          <caption>Daily usage on this device</caption>
          <thead><tr><th>Day</th><th>Active app</th><th>Monitored</th><th>Posture warnings</th><th>Distance warnings</th></tr></thead>
          <tbody>{days.slice().reverse().map(day => <tr key={day.key}>
            <td>{day.key.slice(5)}</td><td>{formatUsageTime(day.stats.activeMs)}</td><td>{formatUsageTime(day.stats.monitoredMs)}</td>
            <td>{day.stats.postureAlerts}</td><td>{day.stats.distanceAlerts}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="usage-explanation">Time is sampled every 5 seconds, not billed or inferred while the app is closed. Active time requires a visible page and activity within the last 5 minutes. Monitored time requires fresh, calibrated posture or distance observations. Visits count app loads, not unique people. Zero means no recorded activity, including days before these insights were enabled.</p>
      <div className="usage-privacy-row"><span><ShieldCheck size={14} />{enabled ? 'Usage insights on. Nothing is uploaded.' : 'Extra usage tracking is paused.'}</span><button className="text-button" onClick={onSettings}>Manage tracking</button></div>
    </section>
  )
}
