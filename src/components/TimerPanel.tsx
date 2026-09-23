import { ArrowRight, Coffee, Leaf, Pause, Play, RotateCcw, Settings2 } from 'lucide-react'
import { formatTime, type Settings, type TimerMode, type TimerState } from '../model'

const modes: { id: TimerMode; label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'shortBreak', label: 'Short break' },
  { id: 'longBreak', label: 'Long break' },
]

export function TimerPanel({ timer, settings, onToggle, onReset, onMode, onSkip, onSettings }: {
  timer: TimerState
  settings: Settings
  onToggle: () => void
  onReset: () => void
  onMode: (mode: TimerMode) => void
  onSkip: () => void
  onSettings: () => void
}) {
  const isBreak = timer.mode !== 'focus'
  const running = timer.deadline !== null
  const started = timer.remainingMs < timer.durationMs
  const round = timer.completedInCycle + 1

  return (
    <section className={`panel timer-panel ${isBreak ? 'break-mode' : ''}`} aria-labelledby="timer-heading">
      <div className="panel-heading">
        <h2 id="timer-heading">{isBreak ? <Coffee size={18} /> : <Leaf size={18} />} {isBreak ? 'A well-earned pause' : 'Your focus timer'}</h2>
        <button className="icon-button subtle" aria-label="Timer settings" onClick={onSettings}><Settings2 size={18} /></button>
      </div>
      <div className="timer-tabs" role="group" aria-label="Timer mode">
        {modes.map(mode => (
          <button key={mode.id} aria-pressed={timer.mode === mode.id} className={timer.mode === mode.id ? 'active' : ''} onClick={() => onMode(mode.id)}>
            {mode.label}
          </button>
        ))}
      </div>
      <div className="clock">
        <svg className="clock-ring" viewBox="0 0 280 280" aria-hidden="true">
          <circle className="clock-track" cx="140" cy="140" r="124" />
          <circle className="clock-progress" cx="140" cy="140" r="124" pathLength="100" strokeDasharray="100"
            strokeDashoffset={100 - timer.remainingMs / timer.durationMs * 100} />
          <circle className="clock-inner" cx="140" cy="140" r="112" />
        </svg>
        <div className="clock-content">
          <span className="clock-eyebrow">{isBreak ? 'BREATHE A LITTLE' : running ? 'IN YOUR FOCUS ERA' : 'ONE THING AT A TIME'}</span>
          <div className="clock-time" role="timer" aria-label={`${isBreak ? 'Break' : 'Focus'} time remaining`}>{formatTime(timer.remainingMs)}</div>
          <span className="clock-caption"><span className={`status-dot ${running ? 'running' : ''}`} />{running ? isBreak ? 'Rest is productive, too' : 'A little progress, every second' : started ? 'Ready when you are' : isBreak ? 'You have earned this' : 'Make space for what matters'}</span>
        </div>
      </div>
      <div className="timer-actions">
        <button className="button primary start-button" onClick={onToggle}>
          {running ? <Pause size={17} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {running ? 'Pause timer' : started ? isBreak ? 'Continue break' : 'Continue focusing' : isBreak ? 'Start break' : 'Start focusing'}
        </button>
        <button className="button reset-button" aria-label="Reset timer" title="Reset timer" onClick={onReset}><RotateCcw size={18} /></button>
      </div>
      <div className="timer-footer">
        {isBreak ? (
          <>
            <span><Leaf size={14} />{timer.suspendedFocus ? 'Your focus time is saved' : 'A fresh start is on the way'}</span>
            <button className="text-button" onClick={onSkip}>{timer.suspendedFocus ? 'Return to focus' : 'Skip break'} <ArrowRight size={13} /></button>
          </>
        ) : (
          <>
            <span className="round-indicator">
              <span className="round-dots" aria-hidden="true">
                {Array.from({ length: settings.longBreakAfter }, (_, index) => <i className={index < timer.completedInCycle ? 'complete' : index === timer.completedInCycle ? 'current' : ''} key={index} />)}
              </span>
              Round {round} of {settings.longBreakAfter}
            </span>
            <span className="long-break-note">A longer pause after {settings.longBreakAfter} rounds</span>
          </>
        )}
      </div>
    </section>
  )
}
