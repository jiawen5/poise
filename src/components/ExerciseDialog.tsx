import { useEffect, useRef, useState } from 'react'
import { Check, Leaf, Pause, Play } from 'lucide-react'
import { type Exercise, exerciseSeconds } from '../exercises'
import { formatTime } from '../model'
import { ExerciseMedia } from './ExerciseMedia'
import { Modal } from './Modal'

export function ExerciseDialog({ exercise, onClose, onComplete, onStart }: {
  exercise: Exercise
  onClose: () => void
  onComplete: () => void
  onStart?: () => void
}) {
  const durationMs = exerciseSeconds(exercise) * 1000
  const [remaining, setRemaining] = useState(durationMs)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const deadline = useRef(0)
  const started = useRef(false)
  const recorded = useRef(false)
  const complete = useRef(onComplete)
  complete.current = onComplete

  const finish = () => {
    setRunning(false)
    setDone(true)
    if (!recorded.current) {
      recorded.current = true
      complete.current()
    }
  }

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = Math.max(0, deadline.current - Date.now())
      setRemaining(left)
      if (left === 0) {
        finish()
      }
    }
    const interval = window.setInterval(tick, 200)
    const visibility = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', visibility)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility) }
  }, [running])

  const toggle = () => {
    if (done) return
    if (running) {
      const left = Math.max(0, deadline.current - Date.now())
      setRemaining(left)
      if (left === 0) {
        finish()
        return
      }
    } else {
      deadline.current = Date.now() + remaining
      if (!started.current) {
        started.current = true
        onStart?.()
      }
    }
    setRunning(!running)
  }
  const elapsed = durationMs - remaining
  let cumulative = 0
  const found = exercise.steps.findIndex(step => {
    cumulative += step.seconds * 1000
    return elapsed < cumulative
  })
  const stepIndex = found === -1 ? exercise.steps.length - 1 : found
  const step = exercise.steps[stepIndex]

  return (
    <Modal title={done ? 'A little better. A little lighter.' : exercise.title} onClose={onClose} className="exercise-dialog">
      <p className="modal-subtitle">{done ? 'You made a little time for yourself. That counts.' : 'No rush. This moment is just for you.'}</p>
      <div className={`exercise-stage ${exercise.color}`}>
        <ExerciseMedia kind={exercise.id} running={running} completed={done} />
        {done ? <div className="exercise-done"><Check size={28} /></div> : <span className="exercise-clock">{formatTime(remaining)}</span>}
      </div>
      {done ? (
        <div className="exercise-instruction"><h3>Reset complete</h3><p>Your reset has been added to your activity. Return to focus whenever you are ready.</p></div>
      ) : (
        <div className="exercise-instruction">
          <span className="eyebrow">STEP {stepIndex + 1} OF {exercise.steps.length}</span>
          <h3>{step.title}</h3>
          <p>{step.instruction}</p>
        </div>
      )}
      <div className="exercise-step-dots" aria-label={`Step ${stepIndex + 1} of ${exercise.steps.length}`}>
        {exercise.steps.map((item, index) => <span className={index <= stepIndex ? 'filled' : ''} key={item.title} />)}
      </div>
      {done ? (
        <button className="button primary full-width" onClick={onClose}><Leaf size={17} /> Back to my day</button>
      ) : (
        <button className="button primary full-width" onClick={toggle}>
          {running ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
          {running ? 'Pause reset' : started.current ? 'Continue reset' : 'Start reset'}
        </button>
      )}
      <p className="exercise-safety">Keep it comfortable. Stop if anything hurts or feels dizzy. Adapt or skip any movement that is not right for you.</p>
    </Modal>
  )
}
