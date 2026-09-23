import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity, ArrowRight, BarChart3, Bell, Check, CheckCheck, ChevronRight, Coffee, Heart,
  LayoutDashboard, Leaf, Meh, Moon, PersonStanding, Settings2, ShieldCheck, Smile, Sparkles,
  Sun, Timer, X,
} from 'lucide-react'
import { emptyStats, formatMinutes, formatTime, type Settings, type TimerMode } from './model'
import { exercises, type Exercise } from './exercises'
import { Sprout, PlantIllustration } from './Illustrations'
import { useAppState } from './useAppState'
import { usePostureMonitor } from './usePostureMonitor'
import { useUsageTracking } from './useUsageTracking'
import { playChime, playWarning, prepareSound } from './sound'
import { TimerPanel } from './components/TimerPanel'
import { PosturePanel } from './components/PosturePanel'
import { ExerciseCard } from './components/ExerciseCard'
import { ExerciseDialog } from './components/ExerciseDialog'
import { ProgressPanel } from './components/ProgressPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Modal } from './components/Modal'
import './enhancements.css'

type Page = 'overview' | 'progress' | 'exercises' | 'settings'
interface Toast { id: number; title: string; message: string; error: boolean }
type Dialog = 'privacy' | 'reset' | 'clear' | null

const navigation: { page: Page; label: string; icon: typeof Leaf }[] = [
  { page: 'overview', label: 'My workspace', icon: LayoutDashboard },
  { page: 'progress', label: 'My progress', icon: BarChart3 },
  { page: 'exercises', label: 'Rest & reset', icon: PersonStanding },
  { page: 'settings', label: 'Preferences', icon: Settings2 },
]

const headings: Record<Page, { eyebrow: string; title: string; subtitle: string }> = {
  overview: { eyebrow: 'A LITTLE FOCUS. A LITTLE BALANCE.', title: 'Good work starts with you.', subtitle: 'Find your flow, mind your posture, and make room for a little pause.' },
  progress: { eyebrow: 'EVERY LITTLE MOMENT COUNTS.', title: 'Look at you, showing up.', subtitle: 'A gentle look at your rhythm over the last seven days.' },
  exercises: { eyebrow: 'REST IS PART OF THE PROCESS.', title: 'Come back a little lighter.', subtitle: 'Simple, guided resets for your body, your eyes, and your mind.' },
  settings: { eyebrow: 'MAKE YOURSELF AT HOME.', title: 'Your day. Your own rhythm.', subtitle: 'Small adjustments to make this space work better for you.' },
}

function pageFromHash(): Page {
  const hash = window.location.hash.slice(1)
  return hash === 'progress' || hash === 'exercises' || hash === 'settings' ? hash : 'overview'
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.error ? 15_000 : 10_000)
    return () => clearTimeout(timeout)
  }, [toast.id, toast.error, onDismiss])
  return (
    <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>
      <span className="toast-icon">{toast.error ? <Bell size={19} /> : <Leaf size={19} />}</span>
      <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
      <button className="icon-button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss reminder"><X size={16} /></button>
    </div>
  )
}

function Statistic({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string | number; detail: string; color: string }) {
  return <div className="statistic" title={detail}><span className={`stat-icon ${color}`}>{icon}</span><div><span className="stat-label">{label}</span><div className="stat-number">{value}<span>today</span></div></div></div>
}

export default function App() {
  const { state, dispatch, storageWarning, todayKey } = useAppState()
  const [page, setPage] = useState<Page>(pageFromHash)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [energy, setEnergy] = useState<'good' | 'tired' | 'reset' | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [warningAudioError, setWarningAudioError] = useState<string | null>(null)
  const toastId = useRef(0)
  const delivered = useRef(state.event)
  const date = new Date()
  const today = state.history[todayKey] ?? emptyStats()

  useEffect(() => {
    const handleHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  useEffect(() => {
    document.title = state.timer.deadline === null
      ? 'Poise - Find your focus. Feel your best.'
      : `${formatTime(state.timer.remainingMs)} ${state.timer.mode === 'focus' ? 'Focus' : 'Rest'} - Poise`
  }, [state.timer])

  const navigate = useCallback((next: Page) => {
    window.location.hash = next
    setPage(next)
  }, [])

  const showToast = useCallback((title: string, message: string, error = false) => {
    const toast = { id: ++toastId.current, title, message, error }
    setToasts(previous => [...previous.slice(-2), toast])
  }, [])
  const dismissToast = useCallback((id: number) => setToasts(previous => previous.filter(toast => toast.id !== id)), [])

  const notify = useCallback((title: string, message: string, warning = false) => {
    showToast(title, message)
    if (warning ? state.settings.postureSound : state.settings.sound) {
      try {
        if (warning) { playWarning(); setWarningAudioError(null) }
        else playChime()
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Your browser could not play the reminder sound.'
        if (warning) setWarningAudioError(detail)
        showToast('A quiet reminder, for now', detail, true)
      }
    }
    if (state.settings.notifications && typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(`Poise: ${title}`, { body: message, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: 'poise-reminder' })
          notification.onclick = () => { window.focus(); notification.close() }
          window.setTimeout(() => notification.close(), 15_000)
        } catch (error) {
          console.warn('The browser could not show a desktop reminder.', error)
          showToast('Your reminder is right here', 'Desktop notifications are unavailable in this browser.', true)
        }
      } else {
        showToast('Desktop reminders are blocked', 'Allow site notifications in your browser settings. In-app reminders will still work.')
      }
    }
  }, [showToast, state.settings.sound, state.settings.postureSound, state.settings.notifications])

  const monitor = usePostureMonitor({
    sensitivity: state.settings.sensitivity,
    reminders: state.settings.postureReminders,
    distanceReminders: state.settings.distanceReminders,
    distanceRange: { minCm: state.settings.distanceMinCm, maxCm: state.settings.distanceMaxCm },
    onReminder: reminder => {
      dispatch({ type: 'monitor-alert', posture: reminder.posture, distance: reminder.distance, now: Date.now() })
      notify(reminder.posture ? 'A little posture check-in' : 'A little more screen space', reminder.message, true)
    },
    onSample: (aligned, distanceInRange) => dispatch({ type: 'posture-sample', aligned, distanceInRange, now: Date.now() }),
  })
  const resetUsageWindow = useUsageTracking(
    state.settings.usageTracking,
    monitor.stage === 'monitoring' ? monitor.observedAt : null,
    dispatch,
  )

  async function prepareWarningSound(test = false) {
    try {
      await prepareSound()
      if (test) playWarning()
      setWarningAudioError(null)
      return true
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Your browser could not enable warning sounds.'
      setWarningAudioError(detail)
      showToast('Warning sound needs your attention', detail, true)
      return false
    }
  }

  function startCamera() {
    if (state.settings.postureSound) void prepareWarningSound()
    void monitor.start()
  }

  async function toggleWarningSound() {
    const enabled = !state.settings.postureSound
    if (enabled && !await prepareWarningSound(true)) return
    dispatch({ type: 'settings', settings: { ...state.settings, postureSound: enabled }, now: Date.now() })
    if (!enabled) setWarningAudioError(null)
  }

  useEffect(() => {
    if (!state.event || delivered.current === state.event) return
    delivered.current = state.event
    if (state.event.kind === 'focus-complete') {
      notify('Nice work. Time for a little pause.', `Your ${state.timer.durationMs / 60_000}-minute break has started. Rest your eyes, soften your shoulders, or try a guided reset.`)
      setEnergy(null)
    } else if (state.event.kind === 'break-complete') {
      notify('Welcome back, a little refreshed.', 'Your focus timer is ready. Start again whenever you feel ready.')
      setEnergy(null)
    } else {
      notify('It is okay to take a little space.', state.timer.suspendedFocus
        ? 'Your recovery break has started. Your unfinished focus time is saved for later.'
        : 'Your recovery break has started. Give yourself a little time away from the screen.')
    }
  }, [state.event, state.timer.durationMs, state.timer.suspendedFocus, notify])

  async function toggleTimer() {
    if (state.settings.sound && state.timer.deadline === null) {
      try { await prepareSound() } catch (error) {
        showToast('Sound could not be enabled', error instanceof Error ? error.message : 'Your timer will still run with in-app reminders.', true)
      }
    }
    dispatch({ type: 'toggle', now: Date.now() })
  }

  function selectMode(mode: TimerMode) {
    dispatch({ type: 'mode', mode, now: Date.now() })
  }

  function selectExercise(next: Exercise) {
    if (state.timer.mode === 'focus') dispatch({ type: 'pause', now: Date.now() })
    setExercise(next)
  }

  function chooseEnergy(choice: 'good' | 'tired' | 'reset') {
    setEnergy(choice)
    if (choice === 'good') {
      dispatch({ type: 'energy-checkin', now: Date.now() })
      showToast('That is a good place to be.', 'Keep your own pace, and remember that little movements are welcome.')
    }
    else dispatch({ type: 'recovery', long: choice === 'reset', now: Date.now() })
  }

  function saveSettings(settings: Settings) {
    dispatch({ type: 'settings', settings, now: Date.now() })
    showToast('A rhythm that feels like you.', 'Your preferences are applied. A session already in progress keeps its duration.')
  }

  const heading = headings[page]
  const cameraOn = ['ready', 'monitoring', 'calibrating', 'starting'].includes(monitor.stage)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Poise home"><span className="brand-mark"><Sprout /></span><span>poise<span className="brand-period">.</span></span></a>
        <p className="brand-tagline">A healthier kind of productive.</p>
        <div className="nav-label">YOUR LITTLE SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(item => <a className={page === item.page ? 'active' : ''} key={item.page} href={`#${item.page}`} aria-label={item.label} aria-current={page === item.page ? 'page' : undefined}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>{page === item.page && <span className="nav-active-dot" />}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="grow-card">
            <PlantIllustration />
            <h3>Good things<br />take little pauses.</h3>
            <p>You do not have to do it all<br />in one sitting.</p>
            <button onClick={() => navigate('exercises')}>Take a little break <ArrowRight size={14} /></button>
          </div>
          <button className="privacy-link" aria-label="Privacy and posture information" onClick={() => setDialog('privacy')}><ShieldCheck size={15} />Private by nature.<ChevronRight size={13} /></button>
          <div className="sidebar-footnote">Made for a more balanced you.</div>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1}>
        <header className="page-header">
          <div><span className="eyebrow">{heading.eyebrow}</span><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
          <div className="header-right"><span className="date-label"><Sun size={16} />{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><button className="header-bell icon-button" aria-label="Reminder preferences" onClick={() => navigate('settings')}><Bell size={19} /></button></div>
        </header>

        {storageWarning && <div className="storage-warning" role="alert"><ShieldCheck size={18} /><span>{storageWarning}</span></div>}
        {page !== 'overview' && (state.timer.deadline !== null || cameraOn) && (
          <button className="workspace-status" onClick={() => navigate('overview')}>
            <span><span className="status-dot running" />{state.timer.deadline !== null ? `${state.timer.mode === 'focus' ? 'Focus' : 'Break'} in progress - ${formatTime(state.timer.remainingMs)}` : 'Your posture companion is active'}{state.timer.deadline !== null && cameraOn ? ' / Camera on' : ''}</span>
            <span>Back to workspace <ArrowRight size={14} /></span>
          </button>
        )}

        <div hidden={page !== 'overview'}>
          <section className="stats-strip" aria-label="Your activity today">
            <Statistic icon={<Timer size={21} />} label="Focus time" value={formatMinutes(today.focusMs)} detail="Time on your running focus timer today" color="peach" />
            <Statistic icon={<CheckCheck size={21} />} label="Focus rounds" value={today.sessions} detail="Fully completed focus sessions today" color="sage" />
            <Statistic icon={<Activity size={21} />} label="Posture balance" value={today.postureSamples ? `${Math.round(today.alignedSamples / today.postureSamples * 100)}%` : '--'} detail="Aligned observations as a percentage of calibrated, visible posture check-ins during focused work" color="lavender" />
            <Statistic icon={<Coffee size={21} />} label="Mindful breaks" value={today.breaks} detail="Fully completed short and long break timers today" color="sand" />
          </section>
          <div className="workspace-grid">
            <TimerPanel timer={state.timer} settings={state.settings} onToggle={() => void toggleTimer()} onReset={() => {
              if (state.timer.remainingMs < state.timer.durationMs) setDialog('reset')
              else dispatch({ type: 'reset', now: Date.now() })
            }} onMode={selectMode} onSkip={() => dispatch({ type: 'skip-break', now: Date.now() })} onSettings={() => navigate('settings')} />
            <PosturePanel monitor={monitor} onHelp={() => setDialog('privacy')} onStartCamera={startCamera}
              warningSound={state.settings.postureSound} audioError={warningAudioError}
              onToggleSound={() => void toggleWarningSound()} onTestSound={() => void prepareWarningSound(true)}
              distanceRange={{ minCm: state.settings.distanceMinCm, maxCm: state.settings.distanceMaxCm }} />
          </div>
          <section className="energy-check" aria-labelledby="energy-heading">
            <span className="energy-icon"><Heart size={22} strokeWidth={1.5} /></span>
            <div className="energy-copy"><h2 id="energy-heading">A quick check-in. How are you feeling?</h2><p>Your energy matters just as much as your to-do list.</p></div>
            <div className="energy-options">
              <button className={energy === 'good' ? 'selected' : ''} aria-pressed={energy === 'good'} onClick={() => chooseEnergy('good')}><Smile size={17} />Feeling good</button>
              <button className={energy === 'tired' ? 'selected' : ''} aria-pressed={energy === 'tired'} onClick={() => chooseEnergy('tired')} title="Save your focus and start a short recovery break"><Meh size={17} />A little tired</button>
              <button className={energy === 'reset' ? 'selected' : ''} aria-pressed={energy === 'reset'} onClick={() => chooseEnergy('reset')} title="Save your focus and start a long recovery break"><Moon size={16} />Need a reset</button>
            </div>
          </section>
          <section className="reset-section" aria-labelledby="reset-heading">
            <div className="section-heading"><div><h2 id="reset-heading">Small pauses. Big difference.</h2><p>A few feel-good ways to come back refreshed.</p></div><button className="text-button" onClick={() => navigate('exercises')}>Explore all resets <ArrowRight size={15} /></button></div>
            <div className="exercise-grid">{exercises.slice(0, 3).map(item => <ExerciseCard exercise={item} onSelect={selectExercise} key={item.id} />)}</div>
          </section>
        </div>

        {page === 'progress' && <ProgressPanel history={state.history} usageTracking={state.settings.usageTracking}
          onSettings={() => navigate('settings')} onNotice={showToast} />}
        {page === 'exercises' && (
          <div className="exercises-page">
            <div className="reset-intro"><span className="soft-icon sage"><Sparkles size={23} /></span><div><h2>A reset is not a reward. It is part of your rhythm.</h2><p>Pick what feels right. Your focus timer pauses while you take a guided reset.</p></div><span className="reset-count"><strong>{today.exercises}</strong>resets today</span></div>
            <div className="exercise-grid all-exercises">{exercises.map(item => <ExerciseCard exercise={item} onSelect={selectExercise} key={item.id} />)}</div>
            <div className="wellness-note"><Heart size={18} /><p>Make these movements your own. Stay within a comfortable range, and stop if you feel pain or dizziness. These general wellness suggestions are not medical advice.</p></div>
          </div>
        )}
        {page === 'settings' && <SettingsPanel settings={state.settings} onSave={saveSettings} onNotice={showToast} onClear={() => setDialog('clear')} />}
        <footer className="page-footer"><span><Leaf size={13} />Less strain. More flow.</span><span>A little better, one moment at a time.</span></footer>
      </main>

      <div className="toast-stack" aria-label="Reminders">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />)}</div>

      {exercise && <ExerciseDialog key={exercise.id} exercise={exercise} onClose={() => setExercise(null)}
        onStart={() => dispatch({ type: 'exercise-started', now: Date.now() })} onComplete={() => {
        dispatch({ type: 'exercise-complete', now: Date.now() })
      }} />}
      {dialog === 'privacy' && (
        <Modal title="A companion, not a camera crew." onClose={() => setDialog(null)} className="privacy-dialog">
          <span className="privacy-modal-icon"><ShieldCheck size={28} /></span>
          <p className="modal-subtitle">Your space, your body, your privacy.</p>
          <div className="privacy-facts">
            <div><Check size={17} /><p><strong>Your camera is always your choice.</strong> It starts only when you enable it, and you can turn it off at any time.</p></div>
            <div><Check size={17} /><p><strong>Everything happens on your device.</strong> A locally served MediaPipe model estimates head and shoulder landmarks. Video is never recorded, stored, or uploaded.</p></div>
            <div><Check size={17} /><p><strong>Your comfortable posture is the starting point.</strong> Sit comfortably upright with supported feet and a front-facing camera. Set your baseline, then move naturally. Sustained changes trigger gentle reminders, not every little shift.</p></div>
            <div><Check size={17} /><p><strong>Estimates, not diagnoses.</strong> A webcam cannot measure spinal health or know whether you are tired. Use the energy check-in whenever you need rest. Recalibrate after moving your camera or chair.</p></div>
            <div><Check size={17} /><p><strong>Screen distance is an estimate.</strong> Face your camera and keep it near your screen. Changes in visible eye spacing estimate distance relative to calibration. Enter a measured eye-to-screen starting distance for approximate centimeters; no unmeasured centimeter value is assumed.</p></div>
            <div><Check size={17} /><p><strong>Warnings you can hear.</strong> Posture and distance warning sounds are on by default after you enable the camera. Mute them or try Test warning sound in the posture card. Browser audio restrictions, computer volume, and background suspension can affect alerts.</p></div>
            <div><Check size={17} /><p><strong>Keep working, with a little awareness.</strong> After calibration, check-ins continue in other tabs at a lower rate. Your browser can still suspend background pages; keep this page visible for the most reliable monitoring. The camera stays on until you turn it off or close the page.</p></div>
            <div><Check size={17} /><p><strong>Usage stays local.</strong> My progress shows sampled active-app and calibrated-monitoring time, warnings, visits, check-ins, and exercise activity. No identities, key content, websites, frames, or raw landmarks are collected. Pause extra usage insights, export a report, or clear activity in Preferences and My progress.</p></div>
          </div>
          <button className="button primary full-width" onClick={() => setDialog(null)}>A little peace of mind <Leaf size={16} /></button>
        </Modal>
      )}
      {dialog === 'reset' && (
        <Modal title="A fresh start?" onClose={() => setDialog(null)}>
          <p className="modal-subtitle">This resets your current {state.timer.mode === 'focus' ? 'focus' : 'break'} timer. Focus time already recorded will stay in your activity.</p>
          <div className="dialog-actions"><button className="button secondary" onClick={() => setDialog(null)}>Keep my timer</button><button className="button primary" onClick={() => { dispatch({ type: 'reset', now: Date.now() }); setDialog(null) }}>Reset timer</button></div>
        </Modal>
      )}
      {dialog === 'clear' && (
        <Modal title="Let go of your activity history?" onClose={() => setDialog(null)}>
          <p className="modal-subtitle">This permanently clears all saved focus, break, reset, posture, distance, and usage totals on this browser. Your timer and preferences stay as they are. New activity will be recorded from this moment.</p>
          <div className="dialog-actions"><button className="button secondary" onClick={() => setDialog(null)}>Keep my history</button><button className="button danger" onClick={() => { resetUsageWindow(); dispatch({ type: 'clear-history', now: Date.now() }); setDialog(null); showToast('A fresh page.', 'Your activity history has been cleared on this device.') }}>Clear history</button></div>
        </Modal>
      )}
    </div>
  )
}
