import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T10:00:00') })
  await page.goto('/')
})

test('shows real empty activity and a private, opt-in camera', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Good work starts with you.' })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await expect(page.getByRole('button', { name: 'Enable camera', exact: true })).toBeVisible()
  await expect(page.locator('.stat-number').nth(0)).toHaveText('0mtoday')
  expect(await page.locator('video').evaluate(video => video.srcObject)).toBeNull()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'test-results/poise-desktop.png', fullPage: true })
})

test('starts, pauses, restores, and resumes without clock drift', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('01:30')
  await expect(page.getByRole('timer')).toHaveText('23:30')
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click()
  await page.clock.fastForward('02:00')
  await expect(page.getByRole('timer')).toHaveText('23:30')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('23:30')
  await page.getByRole('button', { name: 'Continue focusing', exact: true }).click()
  await page.clock.fastForward('00:30')
  await expect(page.getByRole('timer')).toHaveText('23:00')
  await expect(page.locator('.stat-number').nth(0)).toHaveText('2mtoday')
})

test('starts a break at completion and waits to start the next focus round', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('25:00')
  await expect(page.getByRole('timer')).toHaveText('05:00')
  await expect(page.getByRole('button', { name: 'Short break', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stat-number').nth(1)).toHaveText('1today')
  await expect(page.getByText('Nice work. Time for a little pause.')).toBeVisible()
  await page.clock.fastForward('05:00')
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await expect(page.getByRole('button', { name: 'Start focusing', exact: true })).toBeVisible()
  await expect(page.locator('.stat-number').nth(3)).toHaveText('1today')
})

test('uses a long break after the fourth completed focus round', async ({ page }) => {
  for (let round = 0; round < 4; round += 1) {
    await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
    await page.clock.fastForward('25:00')
    if (round < 3) await page.clock.fastForward('05:00')
  }
  await expect(page.getByRole('timer')).toHaveText('15:00')
  await expect(page.getByRole('button', { name: 'Long break', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stat-number').nth(1)).toHaveText('4today')
})

test('preserves work when an energy check-in starts recovery', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('02:00')
  await page.getByRole('button', { name: 'A little tired', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('05:00')
  await expect(page.getByText('Your focus time is saved')).toBeVisible()
  await page.clock.fastForward('05:00')
  await expect(page.getByRole('timer')).toHaveText('23:00')
  await expect(page.getByRole('button', { name: 'Continue focusing', exact: true })).toBeVisible()
  await expect(page.locator('.stat-number').nth(1)).toHaveText('0today')
  await expect(page.locator('.stat-number').nth(3)).toHaveText('1today')
})

test('saves valid preferences and updates a fresh timer', async ({ page }) => {
  await page.getByRole('link', { name: 'Preferences', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Focus duration in minutes' }).fill('35')
  await page.getByRole('spinbutton', { name: 'Short break duration in minutes' }).fill('7')
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await page.getByRole('link', { name: 'My workspace' }).click()
  await expect(page.getByRole('timer')).toHaveText('35:00')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('35:00')
  await page.getByRole('button', { name: 'Short break', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('07:00')
})

test('pauses focus for a guided reset and records only a completed exercise', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('01:00')
  await page.getByRole('button', { name: /Give your eyes a break/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  await page.clock.fastForward('00:20')
  await expect(page.getByRole('heading', { name: 'Reset complete' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to my day' }).click()
  await expect(page.getByRole('timer')).toHaveText('24:00')
  await expect(page.getByRole('button', { name: 'Continue focusing', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'My progress' }).click()
  await expect(page.locator('.progress-metric').filter({ hasText: 'Guided resets' }).locator('strong')).toHaveText('1')
})

test('requires confirmation before resetting or clearing recorded activity', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('01:00')
  await page.getByRole('button', { name: 'Reset timer', exact: true }).click()
  await page.getByRole('button', { name: 'Keep my timer' }).click()
  await expect(page.getByRole('timer')).toHaveText('24:00')
  await page.getByRole('button', { name: 'Reset timer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset timer', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('25:00')
  await expect(page.locator('.stat-number').nth(0)).toHaveText('1mtoday')
  await page.getByRole('link', { name: 'Preferences', exact: true }).click()
  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  await page.getByRole('button', { name: 'Keep my history' }).click()
  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear history', exact: true }).click()
  await page.getByRole('link', { name: 'My workspace' }).click()
  await expect(page.locator('.stat-number').nth(0)).toHaveText('0mtoday')
})

test('supports mobile navigation without horizontal overflow', async ({ page }) => {
  for (const width of [320, 390, 900]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['My workspace', 'My progress', 'Rest & reset', 'Preferences']) {
      await page.getByRole('link', { name, exact: true }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'My workspace' }).click()
  await page.screenshot({ path: 'test-results/poise-mobile.png', fullPage: true })
})

test('shows the next local day even when the timer is paused', async ({ page }) => {
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.clock.fastForward('01:00')
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click()
  await expect(page.locator('.stat-number').nth(0)).toHaveText('1mtoday')
  await page.clock.setSystemTime(new Date('2026-09-22T00:00:00'))
  await page.clock.runFor(1000)
  await expect(page.locator('.stat-number').nth(0)).toHaveText('0mtoday')
  await expect(page.getByRole('timer')).toHaveText('24:00')
})

test('traps dialog focus and restores it when dismissed with Escape', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'How posture monitoring works' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'A little peace of mind' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('explains a denied camera permission and allows a retry', async ({ page }) => {
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError') }
  })
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Camera access is blocked')
  await expect(page.getByRole('button', { name: 'Try camera again' })).toBeEnabled()
  expect(await page.locator('video').evaluate(video => video.srcObject)).toBeNull()
})

test('loads real local inference assets, handles no pose, and releases the camera', async ({ page }) => {
  await page.clock.resume()
  const externalRequests: string[] = []
  const uploads: string[] = []
  const errors: string[] = []
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:5173') externalRequests.push(request.url())
    if (['POST', 'PUT'].includes(request.method())) uploads.push(request.url())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click()
  const calibrate = page.getByRole('button', { name: 'Set my comfortable posture', exact: true })
  await expect(calibrate).toBeVisible({ timeout: 55_000 })
  await expect(calibrate).toBeDisabled()
  await expect(page.getByText('Bring your head and shoulders into view', { exact: true })).toBeVisible()
  const track = await page.locator('video').evaluateHandle(video => video.srcObject instanceof MediaStream ? video.srcObject.getVideoTracks()[0] : null)
  expect(await track.evaluate(value => value?.readyState)).toBe('live')
  await page.getByRole('link', { name: 'My progress' }).click()
  await expect(page.getByRole('button', { name: /Your posture companion is active/ })).toBeVisible()
  await page.getByRole('link', { name: 'My workspace' }).click()
  await page.getByRole('button', { name: 'Turn off camera', exact: true }).click()
  expect(await track.evaluate(value => value?.readyState)).toBe('ended')
  await expect(page.getByRole('button', { name: 'Enable camera', exact: true })).toBeVisible()
  expect(externalRequests).toEqual([])
  expect(uploads).toEqual([])
  expect(errors).toEqual([])
})

test('calibrates, monitors in background, and reminds only on fresh sustained drift with a cooldown', async ({ page }) => {
  await page.clock.resume()
  await page.evaluate(() => {
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }))
    points[0] = { x: 0.5, y: 0.2, visibility: 0.95 }
    points[11] = { x: 0.3, y: 0.52, visibility: 0.95 }
    points[12] = { x: 0.7, y: 0.52, visibility: 0.95 }
    Reflect.set(window, 'testPoseLandmarks', points)
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
  await expect(page.getByRole('button', { name: 'Set my comfortable posture', exact: true })).toBeEnabled()
  await page.locator('video').evaluate(video => {
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => performance.now() / 1000 })
  })
  await page.getByRole('button', { name: 'Set my comfortable posture', exact: true }).click()
  await page.clock.runFor(3000)
  await expect(page.getByRole('button', { name: 'Recalibrate my posture' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  await page.getByRole('button', { name: 'Start focusing', exact: true }).click()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    Reflect.get(window, 'testPoseLandmarks')[0].x = 0.68
  })
  await page.clock.runFor(3000)
  await expect.poll(async () => Number(await page.getByRole('meter').getAttribute('aria-valuenow'))).toBeLessThan(75)
  const reminder = page.locator('.toast').filter({ hasText: 'A little posture check-in' })
  await expect(reminder).toHaveCount(0)
  await page.clock.fastForward('00:20')
  await expect(reminder).toHaveCount(0)
  await page.clock.runFor(12_000)
  await expect(reminder).toBeVisible()
  await expect(reminder).toContainText('Bring your head gently back over your shoulders.')
  await reminder.getByRole('button', { name: 'Dismiss reminder' }).click()
  await page.clock.runFor(20_000)
  await expect(reminder).toHaveCount(0)
  await page.clock.runFor(71_000)
  await expect(reminder).toBeVisible()
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    Reflect.get(window, 'testPoseLandmarks')[0].visibility = 0.1
  })
  await page.clock.runFor(1100)
  await expect(page.getByRole('meter')).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Alignment not yet measured' })).toBeVisible()
  await expect(page.getByText('Bring your head and shoulders into view', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Turn off camera', exact: true }).click()
})

test('keeps interface text readable against its background', async ({ page }) => {
  const selectors = [
    '.page-header p', '.eyebrow', '.stat-label', '.stat-number > span', '.main-nav a',
    '.brand-tagline', '.nav-label', '.grow-card p', '.grow-card button', '.privacy-link',
    '.sidebar-footnote', '.timer-tabs button', '.clock-eyebrow', '.clock-caption',
    '.timer-footer > span', '.long-break-note', '.start-button', '.posture-subheading > span',
    '.camera-placeholder > span', '.alignment-row > span', '.alignment-row .muted',
    '.alignment-row strong', '.posture-message', '.camera-button', '.camera-privacy',
    '.energy-copy h2', '.energy-copy p', '.energy-options button', '.section-heading p',
    '.text-button', '.exercise-category', '.exercise-card h3', '.exercise-duration',
    '.page-footer > span', '.progress-metric > span', '.quiet-pill', '.chart-value',
    '.chart-label', '.chart-empty', '.posture-summary > p', '.posture-summary > strong',
    '.activity-table th', '.activity-table td', '.settings-heading p', '.duration-inputs label',
    '.number-input > span', '.duration-inputs small', '.setting-row h3', '.setting-row p',
    '.setting-note', '.sensitivity-buttons button', '.privacy-settings > p', '.danger-outline',
    '.button.secondary', '.reset-intro p', '.reset-intro h2', '.reset-count', '.wellness-note p',
    '.readout-caption', '.distance-heading', '.distance-status', '.warning-sound-row > span',
    '.usage-metrics span', '.usage-explanation', '.usage-events', '.usage-privacy-row > span',
    '.distance-progress p', '.distance-progress h3',
  ]
  for (const name of ['My workspace', 'My progress', 'Rest & reset', 'Preferences']) {
    await page.getByRole('link', { name, exact: true }).click()
    const failures = await page.evaluate(selectors => {
      const rgb = (color: string) => color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]
      const background = (element: Element | null): number[] => {
        if (!element) return [255, 255, 255]
        const channels = rgb(getComputedStyle(element).backgroundColor)
        const alpha = channels[3] ?? 1
        if (alpha === 1) return channels.slice(0, 3)
        const parent = background(element.parentElement)
        return channels.slice(0, 3).map((channel, index) => channel * alpha + parent[index] * (1 - alpha))
      }
      const luminance = (channels: number[]) => channels.slice(0, 3)
        .map(channel => channel / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
      return Array.from(document.querySelectorAll<HTMLElement>(selectors.join(',')))
        .filter(element => element.getClientRects().length > 0 && element.textContent?.trim())
        .map(element => {
          const style = getComputedStyle(element)
          const foreground = luminance(rgb(style.color))
          const backdrop = luminance(background(element))
          const ratio = (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05)
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
          return { text: element.textContent?.trim().slice(0, 55), ratio, minimum: large ? 3 : 4.5 }
        })
        .filter(result => result.ratio < result.minimum)
    }, selectors)
    expect(failures, `Text contrast on ${name}`).toEqual([])
  }
})
