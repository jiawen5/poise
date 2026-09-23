import { useState } from 'react'
import { Bell, Check, RotateCcw, Ruler, ShieldCheck, SlidersHorizontal, Volume2 } from 'lucide-react'
import { DEFAULT_SETTINGS, validSettings, type Settings } from '../model'
import { playChime, playWarning, prepareSound } from '../sound'

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`toggle ${checked ? 'checked' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>
}

export function SettingsPanel({ settings, onSave, onNotice, onClear }: {
  settings: Settings
  onSave: (settings: Settings) => void
  onNotice: (title: string, message: string, error?: boolean) => void
  onClear: () => void
}) {
  const [draft, setDraft] = useState({ ...settings })
  const supported = typeof Notification !== 'undefined'
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported')
  const [requesting, setRequesting] = useState(false)

  async function toggleSound(warning = false) {
    const enabled = warning ? draft.postureSound : draft.sound
    if (!enabled) {
      try {
        await prepareSound()
        if (warning) playWarning()
        else playChime()
      } catch (error) {
        onNotice('Sound is unavailable', error instanceof Error ? error.message : 'Your browser could not enable sound.', true)
        return
      }
    }
    setDraft(previous => warning
      ? { ...previous, postureSound: !previous.postureSound }
      : { ...previous, sound: !previous.sound })
  }

  async function toggleNotifications() {
    if (draft.notifications) {
      setDraft(previous => ({ ...previous, notifications: false }))
      return
    }
    if (!supported) {
      onNotice('Desktop reminders are unavailable', 'In-app reminders will still work in this browser.', true)
      return
    }
    setRequesting(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') setDraft(previous => ({ ...previous, notifications: true }))
      else onNotice('In-app reminders are still on', 'To use desktop reminders, allow notifications for this site in your browser settings.')
    } catch (error) {
      console.warn('Notification permission could not be requested.', error)
      onNotice('Notifications could not be enabled', 'Check your browser permissions. In-app reminders will still work.', true)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="settings-page">
      <form onSubmit={event => {
        event.preventDefault()
        if (!validSettings(draft)) {
          onNotice('Check your preferences', 'Use valid durations and a distance range with the maximum greater than the minimum.', true)
          return
        }
        onSave(draft)
      }}>
        <section className="panel settings-section">
          <div className="settings-heading"><span className="soft-icon peach"><SlidersHorizontal size={21} /></span><div><h2>Find your rhythm.</h2><p>A routine that fits you, not the other way around.</p></div></div>
          <div className="duration-inputs">
            <label>Focus time<div className="number-input"><input aria-label="Focus duration in minutes" type="number" min="1" max="120" step="1" required value={draft.focusMinutes} onChange={event => setDraft({ ...draft, focusMinutes: Number(event.target.value) })} /><span>min</span></div><small>1-120 minutes</small></label>
            <label>Short break<div className="number-input"><input aria-label="Short break duration in minutes" type="number" min="1" max="30" step="1" required value={draft.shortBreakMinutes} onChange={event => setDraft({ ...draft, shortBreakMinutes: Number(event.target.value) })} /><span>min</span></div><small>1-30 minutes</small></label>
            <label>Long break<div className="number-input"><input aria-label="Long break duration in minutes" type="number" min="1" max="60" step="1" required value={draft.longBreakMinutes} onChange={event => setDraft({ ...draft, longBreakMinutes: Number(event.target.value) })} /><span>min</span></div><small>1-60 minutes</small></label>
            <label>Long break after<div className="number-input"><input aria-label="Focus rounds before a long break" type="number" min="2" max="8" step="1" required value={draft.longBreakAfter} onChange={event => setDraft({ ...draft, longBreakAfter: Number(event.target.value) })} /><span>rounds</span></div><small>2-8 focus rounds</small></label>
          </div>
          <p className="setting-note">Breaks start automatically when focus time ends. Your next focus session waits for you. Duration changes apply to the next fresh timer, not a session in progress.</p>
        </section>
        <section className="panel settings-section">
          <div className="settings-heading"><span className="soft-icon sage"><Bell size={21} /></span><div><h2>A nudge, not a nag.</h2><p>Choose how Poise checks in with you.</p></div></div>
          <div className="setting-row"><div><h3>Gentle posture reminders</h3><p>A check-in when you drift from your calibrated posture.</p></div><Toggle checked={draft.postureReminders} label="Posture reminders" onChange={() => setDraft({ ...draft, postureReminders: !draft.postureReminders })} /></div>
          <div className="setting-row sensitivity-row"><div><h3>Posture sensitivity</h3><p>Allow natural movement before showing a reminder.</p></div>
            <div className="sensitivity-buttons" role="group" aria-label="Posture reminder sensitivity">
              {(['gentle', 'balanced', 'sensitive'] as const).map(sensitivity => <button type="button" className={draft.sensitivity === sensitivity ? 'selected' : ''} aria-pressed={draft.sensitivity === sensitivity} key={sensitivity} onClick={() => setDraft({ ...draft, sensitivity })}>{sensitivity}</button>)}
            </div>
          </div>
          <div className="setting-row"><div><h3>Posture and distance warning sounds</h3><p>On by default when you enable the camera. A soft warning follows sustained drift, not every little movement.</p></div><Toggle checked={draft.postureSound} label="Posture warning sounds" onChange={() => void toggleSound(true)} /></div>
          <div className="setting-row"><div><h3>Timer reminder sounds</h3><p>Optional chimes when a focus session or recovery break changes.</p></div><Toggle checked={draft.sound} label="Reminder sounds" onChange={() => void toggleSound()} /></div>
          <div className="setting-row"><div><h3>Desktop reminders</h3><p>{permission === 'unsupported' ? 'Not supported here. You will still get in-app reminders.' : permission === 'denied' ? 'Blocked by your browser. Update site permissions to enable.' : 'Optional browser alerts. Permission is only requested when enabled.'}</p></div><Toggle checked={draft.notifications && permission === 'granted'} label="Desktop reminders" disabled={requesting || !supported} onChange={() => void toggleNotifications()} /></div>
          <p className="setting-note"><Volume2 size={14} />Posture and distance warnings share a 90-second cooldown. Sensitivity sets the sustained-drift delay: 15, 10, or 6 seconds.</p>
        </section>
        <section className="panel settings-section">
          <div className="settings-heading"><span className="soft-icon sage"><Ruler size={21} /></span><div><h2>A little room to focus.</h2><p>Calibrated screen-distance estimates, without guessing an absolute distance.</p></div></div>
          <div className="setting-row"><div><h3>Screen-distance reminders</h3><p>Warn when you stay too close or too far from your calibrated viewing distance.</p></div><Toggle checked={draft.distanceReminders} label="Screen-distance reminders" onChange={() => setDraft({ ...draft, distanceReminders: !draft.distanceReminders })} /></div>
          <div className="duration-inputs distance-preferences">
            <label>Minimum distance<div className="number-input"><input aria-label="Minimum screen distance in centimeters" type="number" min="20" max="150" step="1" required value={draft.distanceMinCm} onChange={event => setDraft({ ...draft, distanceMinCm: Number(event.target.value) })} /><span>cm</span></div></label>
            <label>Maximum distance<div className="number-input"><input aria-label="Maximum screen distance in centimeters" type="number" min="30" max="200" step="1" required value={draft.distanceMaxCm} onChange={event => setDraft({ ...draft, distanceMaxCm: Number(event.target.value) })} /><span>cm</span></div></label>
          </div>
          <p className="setting-note">Centimeter limits only apply after entering a measured starting distance in the camera card and calibrating. Otherwise, the relative range is 80-125% of your setup distance. Face the camera; turning your head can make estimates unavailable. Choose a range comfortable for your setup, not a medical target.</p>
        </section>
        <section className="panel settings-section">
          <div className="setting-row usage-setting-row"><div><h3>Local usage insights</h3><p>Record sampled active-app and monitoring time, visits, warning counts, starts, and energy check-ins. No identities, key content, website history, or video are collected or uploaded.</p></div><Toggle checked={draft.usageTracking} label="Local usage insights" onChange={() => setDraft({ ...draft, usageTracking: !draft.usageTracking })} /></div>
          <p className="setting-note">Turning this off pauses extra usage insights. Your normal focus, break, reset, and aggregate posture/distance progress still works. Existing totals remain until you clear activity history.</p>
        </section>
        <div className="settings-actions"><button className="button primary" type="submit"><Check size={17} />Save preferences</button><button className="button secondary" type="button" onClick={() => { setDraft({ ...DEFAULT_SETTINGS }); onNotice('A fresh set of preferences', 'Defaults are ready. Save preferences to apply them.') }}><RotateCcw size={16} />Restore defaults</button></div>
      </form>
      <section className="panel settings-section privacy-settings">
        <div className="settings-heading"><span className="soft-icon lavender"><ShieldCheck size={21} /></span><div><h2>Your space stays yours.</h2><p>No account. No uploads. No watching eyes but your own.</p></div></div>
        <p>Video frames and posture calibration stay in memory on this device. Only your preferences and activity totals are saved in your browser. Your camera never starts automatically.</p>
        <div className="setting-row"><div><h3>Clear activity history</h3><p>Delete focus, break, reset, posture, distance, and usage totals. Keep your preferences.</p></div><button type="button" className="button danger-outline" onClick={onClear}>Clear history</button></div>
      </section>
    </div>
  )
}
