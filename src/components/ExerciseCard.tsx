import { ArrowUpRight, Clock3, Play } from 'lucide-react'
import { exerciseDuration, type Exercise } from '../exercises'
import { ExerciseThumbnail } from './ExerciseMedia'

export function ExerciseCard({ exercise, onSelect }: { exercise: Exercise; onSelect: (exercise: Exercise) => void }) {
  return (
    <button className={`exercise-card ${exercise.color}`} onClick={() => onSelect(exercise)}>
      <span className="exercise-category">{exercise.category}</span>
      <span className="exercise-card-arrow"><ArrowUpRight size={16} /></span>
      <div className="exercise-card-content">
        <div>
          <h3>{exercise.title}</h3>
          <span className="exercise-duration"><Clock3 size={12} />{exerciseDuration(exercise)}</span>
          <span className="exercise-demo-badge"><Play size={10} aria-hidden="true" />Animated demo</span>
        </div>
        <ExerciseThumbnail kind={exercise.id} />
      </div>
    </button>
  )
}
