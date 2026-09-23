import { expect, test, type Page } from '@playwright/test'

const fixture = `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/src/styles.css" /></head><body><div id="exercise-root"></div>
<script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => type => type
  window.__vite_plugin_react_preamble_installed__ = true
  const { default: { createElement: h, useState } } = await import('/node_modules/.vite/deps/react.js')
  const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
  const { ExerciseCard } = await import('/src/components/ExerciseCard.tsx')
  const { ExerciseDialog } = await import('/src/components/ExerciseDialog.tsx')
  const { exercises } = await import('/src/exercises.ts')
  window.exerciseEvents = []
  function Harness() {
    const [selected, setSelected] = useState(null)
    return h('main', null,
      h('div', { className: 'exercise-grid' }, exercises.map(exercise =>
        h(ExerciseCard, { key: exercise.id, exercise, onSelect: setSelected }))),
      selected && h(ExerciseDialog, {
        exercise: selected,
        onClose: () => setSelected(null),
        onStart: () => window.exerciseEvents.push('start'),
        onComplete: () => window.exerciseEvents.push('complete'),
      }))
  }
  createRoot(document.getElementById('exercise-root')).render(h(Harness))
</script></body></html>`

async function openFixture(page: Page) {
  await page.route('**/exercise-media-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }))
  await page.goto('/exercise-media-fixture')
  await expect(page.locator('.exercise-card')).toHaveCount(6)
}

async function events(page: Page) {
  return page.evaluate(() => Reflect.get(window, 'exerciseEvents') as string[])
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T10:00:00') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

test('cards only request local static posters, with working previews for all six routines', async ({ page }) => {
  const external: string[] = []
  const animations: string[] = []
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:5173') external.push(request.url())
    if (request.url().endsWith('.gif')) animations.push(request.url())
  })
  await openFixture(page)
  await expect(page.getByText('Animated demo', { exact: true })).toHaveCount(6)
  for (const image of await page.locator('.exercise-thumbnail img').all()) {
    await expect(image).toHaveAttribute('src', /^\/exercises\/[a-z]+-poster\.svg$/)
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(320)
  }
  expect(animations).toEqual([])
  for (let index = 0; index < 6; index += 1) {
    await page.locator('.exercise-card').nth(index).click()
    await page.getByRole('button', { name: 'Start reset', exact: true }).click()
    await expect(page.locator('.exercise-media img')).toHaveAttribute('src', /\.gif$/)
    await expect.poll(() => page.locator('.exercise-media img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(320)
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
  expect(animations).toHaveLength(6)
  expect(external).toEqual([])
})

test('animation and timer pause separately, start records once, and completion records once', async ({ page }) => {
  await openFixture(page)
  await page.getByRole('button', { name: /Give your eyes a break/ }).click()
  expect(await events(page)).toEqual([])
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled()
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/eyes-poster.svg')
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  expect(await events(page)).toEqual(['start'])
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/eyes.gif')
  await page.clock.fastForward('00:04')
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/eyes-poster.svg')
  await page.clock.fastForward('00:03')
  await expect(page.locator('.exercise-clock')).toHaveText('00:13')
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await page.getByRole('button', { name: 'Pause reset', exact: true }).click()
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/eyes-poster.svg')
  await page.clock.fastForward('01:00')
  await expect(page.locator('.exercise-clock')).toHaveText('00:13')
  await page.getByRole('button', { name: 'Continue reset', exact: true }).click()
  expect(await events(page)).toEqual(['start'])
  await page.clock.fastForward('00:13')
  await expect(page.getByRole('heading', { name: 'Reset complete', exact: true })).toBeVisible()
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/eyes-poster.svg')
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled()
  await page.clock.fastForward('01:00')
  expect(await events(page)).toEqual(['start', 'complete'])
  await page.getByRole('button', { name: 'Back to my day', exact: true }).click()
  await page.getByRole('button', { name: /Give your eyes a break/ }).click()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  expect(await events(page)).toEqual(['start', 'complete', 'start'])
})

test('reduced motion needs explicit animation consent and observes live preference changes', async ({ page }) => {
  const animations: string[] = []
  page.on('request', request => { if (request.url().endsWith('.gif')) animations.push(request.url()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFixture(page)
  await page.getByRole('button', { name: /Unwind your hands/ }).click()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  await expect(page.locator('.exercise-media-note')).toContainText('Reduced motion is on')
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/wrists-poster.svg')
  expect(animations).toEqual([])
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/wrists.gif')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(page.locator('.exercise-media-note')).not.toContainText('Reduced motion is on')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/wrists-poster.svg')
  expect(await events(page)).toEqual(['start'])
})

test('shows animation failures without claiming playback or losing the written routine', async ({ page }) => {
  await page.route('**/exercises/shoulders.gif', route => route.fulfill({ status: 404, body: 'Missing animation' }))
  await openFixture(page)
  await page.getByRole('button', { name: /Let your shoulders go/ }).click()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The animation could not load')
  await expect(page.locator('.exercise-media img')).toHaveAttribute('src', '/exercises/shoulders-poster.svg')
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Find a comfortable seat' })).toBeVisible()
  await page.clock.fastForward('00:15')
  await expect(page.getByRole('heading', { name: 'Lift, then let go' })).toBeVisible()
  await expect(page.locator('.exercise-safety')).toContainText('Stop if anything hurts or feels dizzy')
})

test('labels a pending animation as loading rather than claiming it is playing', async ({ page }) => {
  let release: () => void = () => {}
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/exercises/breathe.gif', async route => {
    await ready
    await route.continue()
  })
  await openFixture(page)
  await page.getByRole('button', { name: /A moment to breathe/ }).click()
  await page.getByRole('button', { name: 'Start reset', exact: true }).click()
  await expect(page.locator('.exercise-media-label')).toContainText('Loading')
  await expect(page.getByText('Loading demonstration…', { exact: true })).toBeVisible()
  release()
  await expect(page.locator('.exercise-media-label')).toContainText('Playing')
  await expect(page.locator('.exercise-media-loading')).toHaveCount(0)
})

test('makes a missing poster visible on the card and in the dialog', async ({ page }) => {
  await page.route('**/exercises/stand-poster.svg', route => route.fulfill({ status: 404, body: 'Missing poster' }))
  await openFixture(page)
  const card = page.getByRole('button', { name: /Stand up. Reset./ })
  await expect(card).toContainText('Demo preview unavailable')
  await card.click()
  await expect(page.getByRole('alert')).toContainText('The still image could not load')
  await expect(page.locator('.exercise-media-placeholder')).toContainText('Demo image unavailable')
  await expect(page.getByRole('button', { name: 'Start reset', exact: true })).toBeEnabled()
})

test('preserves keyboard focus, mobile layout, and the completion-at-pause boundary', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await openFixture(page)
  const card = page.getByRole('button', { name: /Give your eyes a break/ })
  await card.click()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Start reset', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await events(page)).toEqual(['start'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.clock.setSystemTime(new Date('2026-09-21T10:00:21'))
  await page.getByRole('button', { name: 'Pause reset', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reset complete', exact: true })).toBeVisible()
  expect(await events(page)).toEqual(['start', 'complete'])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(card).toBeFocused()
})
