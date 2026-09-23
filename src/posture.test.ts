import { describe, expect, it } from 'vitest'
import { assessDistance, assessPosture, calibratePose, estimateDistance, measureEyeWidth, measurePose, reminderDelay, type Landmark, type PoseMetrics } from './posture'

const baseline: PoseMetrics = { headOffset: 0, headGap: 0.8, shoulderSlope: 0, shoulderWidth: 0.4, eyeWidth: 0.06 }
const range = { minCm: 50, maxCm: 80 }

function landmarks(): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }))
  points[0] = { x: 0.5, y: 0.2, visibility: 0.95 }
  points[2] = { x: 0.47, y: 0.19, visibility: 0.95 }
  points[5] = { x: 0.53, y: 0.19, visibility: 0.95 }
  points[11] = { x: 0.3, y: 0.52, visibility: 0.95 }
  points[12] = { x: 0.7, y: 0.52, visibility: 0.95 }
  return points
}

describe('calibrated posture estimates', () => {
  it('measures a seated upper body without requiring visible hips', () => {
    expect(measurePose(landmarks())).toEqual({
      ...baseline, shoulderWidth: expect.closeTo(0.4, 10), eyeWidth: expect.closeTo(0.06, 10),
    })
  })
  it('does not score missing, uncertain, non-finite, or cropped landmarks', () => {
    expect(measurePose([])).toBeNull()
    const points = landmarks()
    points[0].visibility = 0.3
    expect(measurePose(points)).toBeNull()
    points[0].visibility = 0.95
    points[0].x = NaN
    expect(measurePose(points)).toBeNull()
    points[0].x = -0.1
    expect(measurePose(points)).toBeNull()
  })
  it('requires enough stable samples to establish a baseline', () => {
    expect(calibratePose([baseline])).toBeNull()
    expect(calibratePose(Array.from({ length: 16 }, () => baseline))).toEqual({
      ...baseline, headGap: expect.closeTo(0.8, 10), shoulderWidth: expect.closeTo(0.4, 10), eyeWidth: expect.closeTo(0.06, 10),
    })
    expect(calibratePose(Array.from({ length: 16 }, (_, i) => ({ ...baseline, headOffset: i * 0.04 })))).toBeNull()
  })
  it('scores an unchanged calibrated posture as aligned', () => {
    expect(assessPosture(baseline, baseline, 'balanced')).toMatchObject({ score: 100, aligned: true })
  })
  it('identifies persistent head drift, shoulder tilt and slouch separately from distance', () => {
    for (const change of [
      { headOffset: 0.25 }, { shoulderSlope: 0.22 }, { headGap: 0.5 },
    ]) {
      expect(assessPosture({ ...baseline, ...change }, baseline, 'balanced').aligned).toBe(false)
    }
    expect(assessPosture({ ...baseline, shoulderWidth: 0.58 }, baseline, 'balanced').aligned).toBe(true)
  })

  describe('screen-distance estimates', () => {
    it('shows only relative distance unless a measured reference is supplied', () => {
      expect(estimateDistance(baseline, baseline, null, range)).toMatchObject({ ratio: 1, centimeters: null, status: 'comfortable' })
      expect(estimateDistance({ eyeWidth: 0.09 }, baseline, null, range)).toMatchObject({ ratio: expect.closeTo(2 / 3, 8), centimeters: null, status: 'close' })
    })
    it('uses inverse eye spacing and the actual measured centimeter reference', () => {
      expect(estimateDistance({ eyeWidth: 0.09 }, baseline, 60, range)).toMatchObject({ centimeters: expect.closeTo(40, 8), status: 'close' })
      expect(estimateDistance({ eyeWidth: 0.04 }, baseline, 60, range)).toMatchObject({ centimeters: 90, status: 'far' })
      expect(estimateDistance(baseline, baseline, 75, range)?.centimeters).toBe(75)
    })
    it('uses inclusive relative and centimeter boundaries', () => {
      expect(assessDistance(0.8, null, range)?.status).toBe('comfortable')
      expect(assessDistance(1.25, null, range)?.status).toBe('comfortable')
      expect(assessDistance(0.799, null, range)?.status).toBe('close')
      expect(assessDistance(1.251, null, range)?.status).toBe('far')
      expect(assessDistance(50 / 60, 60, range)?.status).toBe('comfortable')
      expect(assessDistance(80 / 60, 60, range)?.status).toBe('comfortable')
      expect(assessDistance(49 / 60, 60, range)?.status).toBe('close')
      expect(assessDistance(81 / 60, 60, range)?.status).toBe('far')
    })
    it('honors configured limits instead of a hard-coded distance target', () => {
      expect(assessDistance(1, 90, { minCm: 70, maxCm: 110 })?.status).toBe('comfortable')
      expect(assessDistance(1, 60, { minCm: 70, maxCm: 110 })?.status).toBe('close')
    })
    it('does not invent a distance when calibration or face landmarks are unreliable', () => {
      expect(estimateDistance({ eyeWidth: null }, baseline, 60, range)).toBeNull()
      expect(estimateDistance(baseline, { eyeWidth: null }, 60, range)).toBeNull()
      expect(estimateDistance({ eyeWidth: 0 }, baseline, 60, range)).toBeNull()
      expect(assessDistance(NaN, 60, range)).toBeNull()
      expect(assessDistance(1, 0, range)).toBeNull()
      expect(assessDistance(1, 60, { minCm: 80, maxCm: 50 })).toBeNull()
      const points = landmarks()
      points[2].visibility = 0.2
      expect(measureEyeWidth(points)).toBeNull()
      points[2].visibility = 0.95
      points[0].x = 0.55
      expect(measureEyeWidth(points)).toBeNull()
    })
    it('continues to measure a visible face if moving close crops the shoulders', () => {
      const points = landmarks()
      points[11].x = -0.1
      points[12].x = 1.1
      expect(measurePose(points)).toBeNull()
      expect(measureEyeWidth(points)).toBeCloseTo(0.06, 10)
    })
    it('can calibrate posture without falsely claiming distance calibration', () => {
      const samples = Array.from({ length: 16 }, () => ({ ...baseline, eyeWidth: null }))
      expect(calibratePose(samples)?.eyeWidth).toBeNull()
      expect(calibratePose(samples)?.headGap).toBeCloseTo(0.8, 10)
    })
  })
  it('allows small normal movements and never reports a negative score', () => {
    expect(assessPosture({ ...baseline, headOffset: 0.04 }, baseline, 'balanced').aligned).toBe(true)
    expect(assessPosture({ ...baseline, headOffset: 5 }, baseline, 'balanced').score).toBe(0)
  })
  it('makes sensitivity and the sustained-drift grace period meaningful', () => {
    const current = { ...baseline, headOffset: 0.2 }
    expect(assessPosture(current, baseline, 'gentle').aligned).toBe(true)
    expect(assessPosture(current, baseline, 'sensitive').aligned).toBe(false)
    expect(reminderDelay('gentle')).toBe(15_000)
    expect(reminderDelay('sensitive')).toBe(6_000)
  })
})
