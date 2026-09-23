import { useEffect, useId, useState } from 'react'
import { ImageOff, Pause, Play } from 'lucide-react'
import type { ExerciseKind } from '../exercises'
import './exercise-media.css'

const descriptions: Record<ExerciseKind, { alt: string; caption: string }> = {
  shoulders: {
    alt: 'A seated person gently lifts their shoulders toward their ears, then lets them relax.',
    caption: 'Lift gently, then let go. Keep your neck easy and your feet supported.',
  },
  eyes: {
    alt: 'An eye looks toward a distant landscape and blinks gently.',
    caption: 'Look beyond your screen, about 20 feet (6 meters) away. No need to watch this demo.',
  },
  stand: {
    alt: 'A person slowly rises beside a chair, reaches comfortably forward, and sits back down.',
    caption: 'Keep support nearby. An easy reach or seated movement is welcome.',
  },
  breathe: {
    alt: 'A seated person rests as a soft ring slowly expands and settles around them.',
    caption: 'Let your breath find its own easy rhythm. No holding or forced deep breaths.',
  },
  wrists: {
    alt: 'Two hands gently open and soften their fingers while their wrists stay neutral.',
    caption: 'Open your hands, then soften your fingers. There is no need to squeeze.',
  },
  walk: {
    alt: 'A person takes small, relaxed steps with a natural, gentle arm swing.',
    caption: 'Walk at your own pace in a clear space, or move your feet while seated.',
  },
}

function mediaPaths(kind: ExerciseKind) {
  const base = `${import.meta.env.BASE_URL}exercises/${kind}`
  return { animation: `${base}.gif`, poster: `${base}-poster.svg` }
}

export function ExerciseThumbnail({ kind }: { kind: ExerciseKind }) {
  const { poster } = mediaPaths(kind)
  const [failedSource, setFailedSource] = useState('')
  return (
    <span className="exercise-illustration exercise-thumbnail">
      {failedSource === poster ? (
        <span className="exercise-thumbnail-error"><ImageOff size={18} aria-hidden="true" />Demo preview unavailable</span>
      ) : (
        <img src={poster} alt="" width={320} height={220} loading="lazy" onError={() => setFailedSource(poster)} />
      )}
    </span>
  )
}

export function ExerciseMedia({ kind, running, completed = false }: {
  kind: ExerciseKind
  running: boolean
  completed?: boolean
}) {
  const { animation, poster } = mediaPaths(kind)
  const description = descriptions[kind]
  const noteId = useId()
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [motionConsent, setMotionConsent] = useState(false)
  const [animationPaused, setAnimationPaused] = useState(false)
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [loadedSource, setLoadedSource] = useState('')

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(preference.matches)
      setMotionConsent(false)
    }
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  const animationFailed = failedSources.includes(animation)
  const playing = running && !completed && !animationPaused && (!reducedMotion || motionConsent) && !animationFailed
  const source = playing ? animation : poster
  const imageFailed = failedSources.includes(source)
  const loading = !imageFailed && loadedSource !== source
  const toggleAnimation = () => {
    setAnimationPaused(playing)
    if (!playing) setMotionConsent(true)
  }
  const note = completed
    ? 'Reset complete. A still image is shown.'
    : reducedMotion
      ? 'Reduced motion is on. Choose Play animation during your reset only if you want motion.'
      : running
        ? 'The demo is a visual guide, not a pace to match. Pausing it does not pause your reset.'
        : 'Start your reset to play the demo. Pausing the reset shows a still image.'

  return (
    <figure className="exercise-media">
      <div className="exercise-media-label">
        <strong>Animated demonstration</strong>
        <span>{imageFailed ? 'Unavailable' : loading ? 'Loading' : playing ? 'Playing' : 'Still image'}</span>
      </div>
      <div className="exercise-media-visual" aria-busy={loading}>
        {imageFailed ? (
          <div className="exercise-media-placeholder"><ImageOff size={28} aria-hidden="true" /><span>Demo image unavailable</span></div>
        ) : (
          <img
            key={source}
            src={source}
            alt={description.alt}
            width={320}
            height={220}
            onLoad={() => setLoadedSource(source)}
            onError={() => setFailedSources(previous => previous.includes(source) ? previous : [...previous, source])}
          />
        )}
        {loading && <span className="exercise-media-loading">Loading demonstration…</span>}
      </div>
      {(animationFailed || imageFailed) && (
        <p className="exercise-media-error" role="alert">
          {animationFailed ? 'The animation could not load.' : 'The still image could not load.'} You can still follow the written steps below.
        </p>
      )}
      <figcaption>{description.caption}</figcaption>
      <button
        className="exercise-animation-toggle"
        type="button"
        onClick={toggleAnimation}
        disabled={!running || completed || animationFailed}
        aria-pressed={playing}
        aria-describedby={noteId}
      >
        {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
        {playing ? 'Pause animation' : 'Play animation'}
      </button>
      <p id={noteId} className="exercise-media-note">{note}</p>
    </figure>
  )
}
