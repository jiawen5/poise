import { useCallback, useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Sensitivity } from './model'
import {
  assessDistance, assessPosture, calibratePose, estimateDistance, measureEyeWidth, measurePose, reminderDelay,
  type DistanceAssessment, type DistanceRange, type Landmark, type PoseMetrics,
} from './posture'

type Stage = 'off' | 'starting' | 'ready' | 'calibrating' | 'monitoring' | 'error'

interface MonitorState {
  stage: Stage
  visible: boolean
  score: number | null
  feedback: string
  progress: number
  error: string | null
  tabPaused: boolean
  distance: DistanceAssessment | null
  referenceCm: number | null
  observedAt: number | null
  distanceReady: boolean
}

export interface MonitorReminder {
  posture: boolean
  distance: boolean
  message: string
}

interface Options {
  sensitivity: Sensitivity
  reminders: boolean
  distanceReminders: boolean
  distanceRange: DistanceRange
  onReminder: (reminder: MonitorReminder) => void
  onSample: (aligned: boolean | null, distanceInRange: boolean | null) => void
}

const initialState: MonitorState = {
  stage: 'off', visible: false, score: null, feedback: '', progress: 0, error: null, tabPaused: false,
  distance: null, referenceCm: null, observedAt: null,
  distanceReady: false,
}

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Camera access is blocked. Allow camera access in your browser or system settings, then try again.'
    }
    if (error.name === 'NotFoundError') return 'No camera was found. Connect a webcam and try again.'
    if (error.name === 'NotReadableError' || error.name === 'AbortError') {
      return 'Your camera could not start. Close other apps using it and try again.'
    }
  }
  return 'Posture monitoring could not start. Check your camera and local model files, then try again.'
}

function drawLandmarks(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: Landmark[], aligned: boolean) {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  const points = [landmarks[0], landmarks[11], landmarks[12]]
  if (points.some(point => !point || (point.visibility ?? 0) < 0.65)) return
  context.strokeStyle = aligned ? '#bed8ad' : '#ffd2a2'
  context.fillStyle = context.strokeStyle
  context.lineWidth = 3
  context.lineCap = 'round'
  const shoulderCenter = {
    x: (points[1].x + points[2].x) / 2,
    y: (points[1].y + points[2].y) / 2,
  }
  context.beginPath()
  context.moveTo(points[1].x * canvas.width, points[1].y * canvas.height)
  context.lineTo(points[2].x * canvas.width, points[2].y * canvas.height)
  context.moveTo(points[0].x * canvas.width, points[0].y * canvas.height)
  context.lineTo(shoulderCenter.x * canvas.width, shoulderCenter.y * canvas.height)
  context.stroke()
  for (const point of points) {
    context.beginPath()
    context.arc(point.x * canvas.width, point.y * canvas.height, 6, 0, Math.PI * 2)
    context.fill()
  }
}

export function usePostureMonitor(options: Options) {
  const [state, setState] = useState<MonitorState>(initialState)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const engineRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const generation = useRef(0)
  const baseline = useRef<PoseMetrics | null>(null)
  const calibration = useRef<{ started: number; samples: PoseMetrics[] } | null>(null)
  const smoothedScore = useRef<number | null>(null)
  const smoothedDistance = useRef<number | null>(null)
  const referenceCm = useRef<number | null>(null)
  const badSince = useRef<number | null>(null)
  const distanceBadSince = useRef<number | null>(null)
  const lastReminder = useRef(-Infinity)
  const lastSample = useRef(0)

  const release = useCallback(() => {
    generation.current += 1
    if (frameRef.current !== null) window.clearTimeout(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    engineRef.current?.close()
    engineRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    baseline.current = null
    calibration.current = null
    smoothedScore.current = null
    smoothedDistance.current = null
    referenceCm.current = null
    badSince.current = null
    distanceBadSince.current = null
    lastReminder.current = -Infinity
  }, [])

  const stop = useCallback(() => {
    release()
    setState(initialState)
  }, [release])

  useEffect(() => {
    const visibility = () => {
      if (document.hidden && calibration.current) {
        calibration.current = null
        setState(previous => ({
          ...previous, stage: 'ready', progress: 0,
          feedback: 'Return to this tab and set your comfortable posture again.',
        }))
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      release()
    }
  }, [release])

  const start = useCallback(async () => {
    release()
    const currentGeneration = generation.current
    setState({ ...initialState, stage: 'starting', feedback: 'Waiting for camera permission...' })
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ ...initialState, stage: 'error', error: 'Camera access needs a supported browser on localhost or HTTPS.' })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
        audio: false,
      })
      if (generation.current !== currentGeneration) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (generation.current !== currentGeneration) return
        release()
        setState({ ...initialState, stage: 'error', error: 'Your camera disconnected. Reconnect it and try again.' })
      })
      const video = videoRef.current
      if (!video) throw new Error('The camera preview is unavailable.')
      video.srcObject = stream
      await video.play()
      if (generation.current !== currentGeneration) return
      setState(previous => ({ ...previous, feedback: 'Preparing your on-device posture model...' }))
      const { FilesetResolver, PoseLandmarker: Landmarker } = await import('@mediapipe/tasks-vision')
      const assets = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}vision/wasm`)
      if (generation.current !== currentGeneration) return
      const engine = await Landmarker.createFromOptions(assets, {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}vision/pose_landmarker_lite.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      if (generation.current !== currentGeneration) {
        engine.close()
        return
      }
      engineRef.current = engine
      setState({ ...initialState, stage: 'ready', feedback: 'Center your head and shoulders, then set your comfortable posture.' })
      let lastFrame = -Infinity
      let lastVideoTime = -1

      const frame = () => {
        if (generation.current !== currentGeneration) return
        frameRef.current = window.setTimeout(frame, document.hidden ? 1000 : 160)
        const now = performance.now()
        if (calibration.current && now - calibration.current.started > 15_000) {
          calibration.current = null
          setState(previous => ({
            ...previous, stage: 'ready', progress: 0,
            feedback: 'Calibration timed out. Keep your head and shoulders in view and try again.',
          }))
        }
        const stale = Number.isFinite(lastFrame) && now - lastFrame > 5000
        if (stale) {
          badSince.current = null
          distanceBadSince.current = null
          smoothedScore.current = null
          smoothedDistance.current = null
          if (calibration.current) calibration.current.samples = []
        }
        if (video.readyState < 2 || video.currentTime === lastVideoTime) {
          if (stale) setState(previous => previous.tabPaused ? previous : {
            ...previous, tabPaused: true, visible: false, score: null, distance: null, observedAt: null, progress: 0,
          })
          return
        }
        lastFrame = now
        lastVideoTime = video.currentTime
        try {
          const result = engine.detectForVideo(video, now)
          const landmarks = result.landmarks[0] ?? []
          const metrics = measurePose(landmarks)
          if (!metrics && !baseline.current) {
            badSince.current = null
            distanceBadSince.current = null
            smoothedScore.current = null
            smoothedDistance.current = null
            if (calibration.current) calibration.current.samples = []
            const canvas = canvasRef.current
            canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
            setState(previous => ({ ...previous, visible: false, score: null, distance: null, observedAt: null, progress: 0, tabPaused: false }))
            return
          }
          if (calibration.current && metrics) {
            calibration.current.samples.push(metrics)
            const samples = calibration.current.samples
            if (samples.length >= 16) {
              const reference = calibratePose(samples)
              calibration.current = null
              baseline.current = reference
              lastSample.current = now
              setState(previous => ({
                ...previous, visible: true, stage: reference ? 'monitoring' : 'ready', progress: 0, tabPaused: false,
                referenceCm: referenceCm.current,
                distanceReady: reference !== null && reference.eyeWidth !== null,
                feedback: reference
                  ? reference.eyeWidth === null
                    ? 'Posture is set. Face the camera and recalibrate to enable distance estimates.'
                    : 'All set. Posture and distance check-ins are ready while you work.'
                  : 'We noticed some movement. Settle into a comfortable position and try again.',
              }))
            } else {
              setState(previous => ({ ...previous, visible: true, tabPaused: false, progress: Math.round(samples.length / 16 * 100) }))
            }
          } else if (baseline.current) {
            const assessment = metrics ? assessPosture(metrics, baseline.current, optionsRef.current.sensitivity) : null
            smoothedScore.current = assessment === null ? null : smoothedScore.current === null
              ? assessment.score : smoothedScore.current * 0.7 + assessment.score * 0.3
            const score = smoothedScore.current === null ? null : Math.round(smoothedScore.current)
            const eyes = metrics ? metrics.eyeWidth : measureEyeWidth(landmarks)
            const rawDistance = estimateDistance({ eyeWidth: eyes }, baseline.current, referenceCm.current, optionsRef.current.distanceRange)
            smoothedDistance.current = rawDistance === null ? null
              : smoothedDistance.current === null ? rawDistance.ratio : smoothedDistance.current * 0.7 + rawDistance.ratio * 0.3
            const distance = smoothedDistance.current === null ? null
              : assessDistance(smoothedDistance.current, referenceCm.current, optionsRef.current.distanceRange)
            setState(previous => ({
              ...previous, visible: metrics !== null, score, distance,
              observedAt: metrics || rawDistance ? Date.now() : null,
              feedback: assessment?.feedback ?? 'Bring your head and shoulders into view for posture alignment.',
              tabPaused: false,
            }))
            if (score !== null && score < 75 && assessment && !assessment.aligned && optionsRef.current.reminders) {
              badSince.current ??= now
            } else {
              badSince.current = null
            }
            if (distance && distance.status !== 'comfortable' && rawDistance?.status !== 'comfortable' && optionsRef.current.distanceReminders) {
              distanceBadSince.current ??= now
            } else {
              distanceBadSince.current = null
            }
            const delay = reminderDelay(optionsRef.current.sensitivity)
            const postureDue = badSince.current !== null && now - badSince.current >= delay
            const distanceDue = distanceBadSince.current !== null && now - distanceBadSince.current >= delay
            if ((postureDue || distanceDue) && now - lastReminder.current >= 90_000) {
              lastReminder.current = now
              optionsRef.current.onReminder({
                posture: postureDue, distance: distanceDue,
                message: [postureDue ? assessment?.feedback : '', distanceDue ? distance?.feedback : ''].filter(Boolean).join(' '),
              })
            }
            if (now - lastSample.current >= 10_000) {
              lastSample.current = now
              optionsRef.current.onSample(score === null ? null : score >= 75, distance === null ? null : distance.status === 'comfortable')
            }
          } else {
            setState(previous => ({ ...previous, visible: true, tabPaused: false }))
          }
          if (canvasRef.current) drawLandmarks(canvasRef.current, video, landmarks, (smoothedScore.current ?? 100) >= 75)
        } catch (error) {
          console.error('On-device posture analysis stopped.', error)
          release()
          setState({ ...initialState, stage: 'error', error: 'Posture analysis stopped unexpectedly. Your camera is off; try enabling it again.' })
        }
      }
      frameRef.current = window.setTimeout(frame, 0)
    } catch (error) {
      if (generation.current !== currentGeneration) return
      console.error('Could not start on-device posture monitoring.', error)
      release()
      setState({ ...initialState, stage: 'error', error: cameraError(error) })
    }
  }, [release])

  const calibrate = useCallback((measuredDistance: number | null = null) => {
    if (!engineRef.current) return
    if (measuredDistance !== null && (!Number.isFinite(measuredDistance) || measuredDistance < 20 || measuredDistance > 200)) {
      setState(previous => ({ ...previous, error: 'Enter a measured distance from 20 to 200 cm, or leave the field blank for relative distance.' }))
      return
    }
    baseline.current = null
    smoothedScore.current = null
    smoothedDistance.current = null
    referenceCm.current = measuredDistance
    badSince.current = null
    distanceBadSince.current = null
    calibration.current = { started: performance.now(), samples: [] }
    setState(previous => ({
      ...previous, stage: 'calibrating', score: null, distance: null, distanceReady: false, observedAt: null, progress: 0, error: null,
      feedback: 'Sit comfortably upright, relax your shoulders, and hold still for a moment.',
    }))
  }, [])

  return { ...state, videoRef, canvasRef, start, stop, calibrate }
}
