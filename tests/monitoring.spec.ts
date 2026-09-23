import { expect, test, type Page } from '@playwright/test'

async function setupMonitor(page: Page, reference?: number) {
  await page.evaluate(() => {
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }))
    points[0] = { x: 0.5, y: 0.2, visibility: 0.95 }
    points[2] = { x: 0.47, y: 0.19, visibility: 0.95 }
    points[5] = { x: 0.53, y: 0.19, visibility: 0.95 }
    points[11] = { x: 0.3, y: 0.52, visibility: 0.95 }
    points[12] = { x: 0.7, y: 0.52, visibility: 0.95 }
    Reflect.set(window, 'testPoseLandmarks', points)
    Reflect.set(window, 'testWarningNotes', [])
    class TestAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      async resume() { if (!Reflect.get(window, 'testBlockAudio')) this.state = 'running' }
      createOscillator() {
        const frequency = { value: 0 }
        return {
          frequency, type: 'sine', connect() {}, disconnect() {}, stop() {}, onended: null,
          start() { Reflect.get(window, 'testWarningNotes').push(frequency.value) },
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}, disconnect() {},
        }
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestAudioContext })
  })
  await page.route('**/@mediapipe_tasks-vision.js*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      export const FilesetResolver = { forVisionTasks: async () => ({}) };
      export class PoseLandmarker {
        static async createFromOptions() { return new PoseLandmarker(); }
        detectForVideo() { return { landmarks: [window.testPoseLandmarks] }; }
        close() {}
      }
    `,
  }))
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click()
  await page.getByRole('button', { name: 'Set my comfortable posture', exact: true }).waitFor()
  await page.locator('video').evaluate(video => {
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => performance.now() / 1000 })
  })
  await page.clock.runFor(300)
  if (reference !== undefined) await page.getByRole('spinbutton', { name: 'Measured starting distance in centimeters' }).fill(String(reference))
  await page.getByRole('button', { name: 'Set my comfortable posture', exact: true }).click()
  await page.clock.runFor(3000)
  await expect(page.getByRole('button', { name: 'Recalibrate my posture' })).toBeVisible()
}

async function scalePose(page: Page, scale: number, cropShoulders = false) {
  await page.evaluate(({ scale, cropShoulders }) => {
    const points = Reflect.get(window, 'testPoseLandmarks')
    const coordinates = [
      [0, 0.5, 0.2], [2, 0.47, 0.19], [5, 0.53, 0.19], [11, 0.3, 0.52], [12, 0.7, 0.52],
    ]
    for (const [index, x, y] of coordinates) {
      points[index] = {
        x: 0.5 + (x - 0.5) * scale, y: 0.2 + (y - 0.2) * scale,
        visibility: cropShoulders && index >= 11 ? 0.1 : 0.95,
      }
    }
  }, { scale, cropShoulders })
}

async function todayStats(page: Page) {
  return page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('poise.workspace.v1')!)
    const date = new Date()
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return saved.history[key]
  })
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-22T10:00:00') })
  await page.clock.pauseAt(new Date('2026-09-22T10:00:01'))
  await page.goto('/')
})

test('automatically unlocks warning audio for the camera and plays it on sustained bad posture', async ({ page }) => {
  await setupMonitor(page)
  await expect(page.getByRole('button', { name: 'Mute posture warning sound' })).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([])
  await page.evaluate(() => { Reflect.get(window, 'testPoseLandmarks')[0].x = 0.68 })
  await page.clock.runFor(5000)
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([])
  await page.clock.runFor(7000)
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([392, 329.63, 392])
  expect((await todayStats(page)).postureAlerts).toBe(1)
  await page.getByRole('button', { name: 'Mute posture warning sound' }).click()
  await expect(page.getByRole('button', { name: 'Test warning sound' })).toBeDisabled()
  await page.clock.runFor(91_000)
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toHaveLength(3)
  expect((await todayStats(page)).postureAlerts).toBe(2)
})

test('shows relative distance without invented centimeters and warns with an independent sound', async ({ page }) => {
  await setupMonitor(page)
  const distance = page.getByRole('group', { name: 'Estimated screen distance' })
  await expect(distance.locator('strong')).toHaveText('100%')
  await expect(distance).not.toContainText('cm')
  await scalePose(page, 1.5)
  await page.clock.runFor(13_000)
  await expect(distance).toContainText('Too close')
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([392, 329.63, 392])
  expect(await todayStats(page)).toMatchObject({ postureAlerts: 0, distanceAlerts: 1 })
  expect((await todayStats(page)).monitoredMs).toBeGreaterThan(0)
})

test('estimates centimeters from the measured reference, including when shoulders leave the frame', async ({ page }) => {
  await setupMonitor(page, 60)
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  const distance = page.getByRole('group', { name: 'Estimated screen distance' })
  await expect(distance.locator('strong')).toHaveText('~60 cm')
  await scalePose(page, 1.5, true)
  await page.clock.runFor(13_000)
  await expect(distance.locator('strong')).toHaveText('~40 cm')
  await expect(distance).toContainText('Too close')
  await expect(page.getByRole('meter')).toHaveCount(0)
  expect(await todayStats(page)).toMatchObject({ distanceAlerts: 1, distanceSamples: 1, postureSamples: 0 })
  await scalePose(page, 0.7)
  await page.clock.runFor(6000)
  await expect(distance).toContainText('Too far')
})

test('surfaces blocked warning audio and lets the customer retry without restarting the camera', async ({ page }) => {
  await page.evaluate(() => { Reflect.set(window, 'testBlockAudio', true) })
  await setupMonitor(page)
  await expect(page.locator('.camera-error')).toContainText('blocked reminder sounds')
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([])
  await page.evaluate(() => { Reflect.set(window, 'testBlockAudio', false) })
  await page.getByRole('button', { name: 'Test warning sound' }).click()
  await expect(page.locator('.camera-error')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'testWarningNotes'))).toEqual([392, 329.63, 392])
})

test('tracks only sampled visible activity and stops extra tracking when disabled', async ({ page }) => {
  await page.clock.runFor(5000)
  expect(await todayStats(page)).toMatchObject({ visits: 1, activeMs: 5000, monitoredMs: 0 })
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(10_000)
  expect((await todayStats(page)).activeMs).toBe(5000)
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(5000)
  expect((await todayStats(page)).activeMs).toBe(10_000)
  await page.getByRole('link', { name: 'Preferences', exact: true }).click()
  await page.getByRole('switch', { name: 'Local usage insights' }).click()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await page.clock.runFor(10_000)
  expect((await todayStats(page)).activeMs).toBe(10_000)
  await page.getByRole('link', { name: 'My progress' }).click()
  await expect(page.getByText('Extra usage tracking is paused.')).toBeVisible()
})

test('records a guided reset start only once across pause and resume', async ({ page }) => {
  await page.getByRole('button', { name: /Give your eyes a break/ }).click()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  await page.clock.runFor(5000)
  await page.getByRole('button', { name: 'Pause reset', exact: true }).click()
  await page.getByRole('button', { name: 'Continue reset', exact: true }).click()
  await page.clock.runFor(15_000)
  await expect(page.getByRole('heading', { name: 'Reset complete' })).toBeVisible()
  expect(await todayStats(page)).toMatchObject({ exerciseStarts: 1, exercises: 1 })
})

test('stops active usage after five idle minutes and resumes on a new interaction', async ({ page }) => {
  await page.clock.runFor(305_000)
  expect((await todayStats(page)).activeMs).toBe(300_000)
  await page.getByRole('link', { name: 'My progress' }).click()
  await page.clock.runFor(5000)
  expect((await todayStats(page)).activeMs).toBe(305_000)
})

test('counts fresh background monitoring but not suspended camera time', async ({ page }) => {
  await setupMonitor(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const active = (await todayStats(page)).activeMs
  await page.clock.runFor(10_000)
  const beforeSuspension = await todayStats(page)
  expect(beforeSuspension.monitoredMs).toBeGreaterThan(0)
  expect(beforeSuspension.activeMs).toBe(active)
  await page.clock.fastForward(10_000)
  expect((await todayStats(page)).monitoredMs).toBe(beforeSuspension.monitoredMs)
})

test('exports the seven-day local usage report without a network upload', async ({ page }) => {
  const uploads: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.url()) })
  await page.clock.runFor(10_000)
  await page.getByRole('link', { name: 'My progress' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export 7-day activity report' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('poise-activity-2026-09-22.csv')
  const stream = await download.createReadStream()
  let csv = ''
  for await (const chunk of stream) csv += chunk.toString()
  expect(csv).toContain('Active app seconds')
  const lines = csv.trim().split('\r\n')
  expect(lines).toHaveLength(8)
  const headers = lines[0].split(',')
  const row = lines[7].split(',')
  expect(row[0]).toBe('2026-09-22')
  expect(row[headers.indexOf('Active app seconds')]).toBe('10')
  expect(row[headers.indexOf('Workspace visits')]).toBe('1')
  expect(uploads).toEqual([])
})

test('preserves customer progress and paused timer when upgrading previous saved data', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('migration-fixture')) return
    sessionStorage.setItem('migration-fixture', 'ready')
    localStorage.setItem('poise.workspace.v1', JSON.stringify({
      version: 1,
      settings: {
        focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakAfter: 4,
        postureReminders: true, sensitivity: 'balanced', sound: false, notifications: false,
      },
      timer: {
        mode: 'focus', remainingMs: 20 * 60_000, durationMs: 25 * 60_000,
        deadline: null, accountedAt: null, completedInCycle: 2, suspendedFocus: null,
      },
      history: {
        '2026-09-22': { focusMs: 12 * 60_000, sessions: 2, breaks: 1, exercises: 3, postureSamples: 10, alignedSamples: 8 },
      },
    }))
  })
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('20:00')
  await expect(page.locator('.stat-number').nth(0)).toHaveText('12mtoday')
  await expect(page.locator('.storage-warning')).toHaveCount(0)
  expect(await todayStats(page)).toMatchObject({ sessions: 2, exercises: 3, alignedSamples: 8, activeMs: 0 })
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('poise.workspace.v1')!).version)).toBe(2)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('20:00')
  await expect(page.locator('.stat-number').nth(0)).toHaveText('12mtoday')
})
