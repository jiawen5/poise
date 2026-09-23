import type { Sensitivity } from './model'

export interface Landmark {
  x: number
  y: number
  visibility?: number
}

export interface PoseMetrics {
  headOffset: number
  headGap: number
  shoulderSlope: number
  shoulderWidth: number
  eyeWidth: number | null
}

export interface PostureAssessment {
  score: number
  aligned: boolean
  feedback: string
}

export interface DistanceRange {
  minCm: number
  maxCm: number
}

export interface DistanceAssessment {
  ratio: number
  centimeters: number | null
  status: 'close' | 'comfortable' | 'far'
  feedback: string
}

function visible(point: Landmark | undefined): point is Landmark {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && (point.visibility ?? 0) >= 0.65
    && point.x > 0.01 && point.x < 0.99 && point.y > 0.01 && point.y < 0.99)
}

export function measureEyeWidth(landmarks: Landmark[]): number | null {
  const nose = landmarks[0]
  const leftEye = landmarks[2]
  const rightEye = landmarks[5]
  if (!visible(nose) || !visible(leftEye) || !visible(rightEye)) return null
  const span = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y)
  const offCenter = Math.abs(nose.x - (leftEye.x + rightEye.x) / 2)
  return span >= 0.025 && span <= 0.3 && offCenter / span <= 0.35
    && Math.abs(leftEye.y - rightEye.y) / span <= 0.35 ? span : null
}

export function measurePose(landmarks: Landmark[]): PoseMetrics | null {
  const nose = landmarks[0]
  const left = landmarks[11]
  const right = landmarks[12]
  if (![nose, left, right].every(visible)) return null
  const width = Math.hypot(left.x - right.x, left.y - right.y)
  if (width < 0.15 || width > 0.88) return null
  const centerX = (left.x + right.x) / 2
  const centerY = (left.y + right.y) / 2
  if (centerY - nose.y < 0.035) return null
  return {
    headOffset: (nose.x - centerX) / width,
    headGap: (centerY - nose.y) / width,
    shoulderSlope: (left.y - right.y) / width,
    shoulderWidth: width,
    eyeWidth: measureEyeWidth(landmarks),
  }
}

export function calibratePose(samples: PoseMetrics[]): PoseMetrics | null {
  if (samples.length < 16) return null
  const keys: (keyof Omit<PoseMetrics, 'eyeWidth'>)[] = ['headOffset', 'headGap', 'shoulderSlope', 'shoulderWidth']
  const tolerances = [0.12, 0.14, 0.1, 0.07]
  if (keys.some((key, index) => {
    const values = samples.map(sample => sample[key])
    return Math.max(...values) - Math.min(...values) > tolerances[index]
  })) return null
  const average = (key: keyof Omit<PoseMetrics, 'eyeWidth'>) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length
  const eyes = samples.map(sample => sample.eyeWidth).filter((width): width is number => width !== null)
  const meanEyeWidth = eyes.length === samples.length ? eyes.reduce((sum, width) => sum + width, 0) / eyes.length : null
  const eyeWidth = meanEyeWidth !== null && (Math.max(...eyes) - Math.min(...eyes)) / meanEyeWidth <= 0.2
    ? meanEyeWidth : null
  return {
    headOffset: average('headOffset'),
    headGap: average('headGap'),
    shoulderSlope: average('shoulderSlope'),
    shoulderWidth: average('shoulderWidth'),
    eyeWidth,
  }
}

export function assessPosture(current: PoseMetrics, baseline: PoseMetrics, sensitivity: Sensitivity): PostureAssessment {
  const tolerance = sensitivity === 'gentle' ? 1.35 : sensitivity === 'sensitive' ? 0.75 : 1
  const differences = [
    { value: Math.abs(current.headOffset - baseline.headOffset) / 0.2, feedback: 'Bring your head gently back over your shoulders.' },
    { value: Math.abs(current.shoulderSlope - baseline.shoulderSlope) / 0.17, feedback: 'Let your shoulders settle into a relaxed, even position.' },
    { value: Math.max(0, baseline.headGap - current.headGap) / Math.max(baseline.headGap * 0.3, 0.09), feedback: 'Sit a little taller, without holding yourself stiffly.' },
  ]
  const strongest = differences.reduce((a, b) => a.value > b.value ? a : b)
  const score = Math.round(Math.max(0, 100 - strongest.value / tolerance * 30))
  return {
    score,
    aligned: score >= 75,
    feedback: score >= 75 ? 'Looking balanced. Remember, a little movement is healthy.' : strongest.feedback,
  }
}

export function assessDistance(ratio: number, referenceCm: number | null, range: DistanceRange): DistanceAssessment | null {
  if (!Number.isFinite(ratio) || ratio < 0.25 || ratio > 3) return null
  if (referenceCm !== null && (!Number.isFinite(referenceCm) || referenceCm < 20 || referenceCm > 200)) return null
  if (!Number.isFinite(range.minCm) || !Number.isFinite(range.maxCm) || range.minCm >= range.maxCm) return null
  const centimeters = referenceCm === null ? null : referenceCm * ratio
  const value = centimeters ?? ratio
  const minimum = centimeters === null ? 0.8 : range.minCm
  const maximum = centimeters === null ? 1.25 : range.maxCm
  const status = value < minimum - 0.000001 ? 'close' : value > maximum + 0.000001 ? 'far' : 'comfortable'
  return {
    ratio, centimeters, status,
    feedback: status === 'close'
      ? 'You seem closer to the screen. Ease back toward your comfortable viewing distance.'
      : status === 'far'
        ? 'You seem farther from the screen. Check that you can read comfortably without leaning.'
        : 'Your estimated viewing distance is within your chosen range.',
  }
}

export function estimateDistance(current: Pick<PoseMetrics, 'eyeWidth'>, baseline: Pick<PoseMetrics, 'eyeWidth'>, referenceCm: number | null, range: DistanceRange): DistanceAssessment | null {
  if (current.eyeWidth === null || baseline.eyeWidth === null || current.eyeWidth <= 0 || baseline.eyeWidth <= 0) return null
  return assessDistance(baseline.eyeWidth / current.eyeWidth, referenceCm, range)
}

export function reminderDelay(sensitivity: Sensitivity): number {
  return sensitivity === 'gentle' ? 15_000 : sensitivity === 'sensitive' ? 6_000 : 10_000
}
