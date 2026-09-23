import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import gifenc from 'gifenc'

const { GIFEncoder, quantize, applyPalette } = gifenc
const width = 320
const height = 220
const frameCount = 60
const delay = 80
const destination = new URL('../public/exercises/', import.meta.url)
const work = new URL('.render-work/', destination)
const themes = {
  peach: { background: '#f7ede4', soft: '#eedfd1', ink: '#8b5d42', shirt: '#c7987e', skin: '#e5bea2', floor: '#e1d2c5' },
  sage: { background: '#edf1e5', soft: '#dfe6d4', ink: '#5d6c49', shirt: '#9db187', skin: '#e5bea2', floor: '#d5ddc8' },
  lavender: { background: '#eeedf5', soft: '#e0dce9', ink: '#706681', shirt: '#afa2c0', skin: '#e5bea2', floor: '#d7d1e0' },
}
const routines = [
  { id: 'shoulders', theme: 'peach', poster: 0.3, description: 'A seated person gently lifts and releases their shoulders.' },
  { id: 'eyes', theme: 'sage', poster: 0.25, description: 'An eye looks toward a distant landscape and blinks gently.' },
  { id: 'stand', theme: 'lavender', poster: 0.52, description: 'A person rises beside a chair, reaches comfortably forward, and sits back down.' },
  { id: 'breathe', theme: 'sage', poster: 0.35, description: 'A seated person rests while a soft breathing ring gently expands and settles.' },
  { id: 'wrists', theme: 'peach', poster: 0, description: 'Two supported hands slowly open and softly curl their fingers, with neutral wrists.' },
  { id: 'walk', theme: 'lavender', poster: 0.12, description: 'A person takes small, relaxed steps with a natural arm swing.' },
]

const smooth = value => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
const round = value => Math.round(value * 100) / 100
const point = (x, y) => `${round(x)} ${round(y)}`
const path = (d, stroke, lineWidth = 3, fill = 'none', extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
const ellipse = (x, y, rx, ry, fill, extra = '') =>
  `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(rx)}" ry="${round(ry)}" fill="${fill}" ${extra}/>`
const circle = (x, y, radius, fill, extra = '') => ellipse(x, y, radius, radius, fill, extra)

function head(x, y, theme, profile = false) {
  return `
    ${path(`M${point(x - 5, y + 14)}v12h12V${round(y + 12)}`, theme.ink, 1.5, theme.skin)}
    ${circle(x, y, 17, theme.skin, `stroke="${theme.ink}" stroke-width="1.5"`)}
    ${path(`M${point(x - 16, y - 3)}C${point(x - 19, y - 23)} ${point(x + 14, y - 25)} ${point(x + 17, y - 6)}Q${point(x + 4, y - 3)} ${point(x - 5, y - 12)}Q${point(x - 9, y - 3)} ${point(x - 16, y - 3)}`, theme.ink, 1, theme.ink)}
    ${profile
      ? `${circle(x + 9, y + 2, 1.2, theme.ink)}${path(`M${point(x + 5, y + 10)}q4 2 7 -1`, theme.ink, 1.2)}`
      : `${path(`M${point(x - 9, y + 2)}q3 3 6 0m6 0q3 3 6 0`, theme.ink, 1.2)}${path(`M${point(x - 3, y + 10)}q3 2 6 0`, theme.ink, 1.1)}`}
  `
}

function chair(theme, x = 160) {
  return `
    ${path(`M${x - 39} 105v45h78v-45`, theme.floor, 7)}
    ${path(`M${x - 34} 154v36m68-36v36`, theme.ink, 2)}
    <rect x="${x - 41}" y="143" width="82" height="11" rx="5" fill="${theme.soft}" stroke="${theme.ink}" stroke-width="1.5"/>
  `
}

function seated(theme, lift = 0, breath = 0, handsInLap = false) {
  const shoulder = 89 - lift
  const spread = 24 + breath
  return `
    ${chair(theme)}
    ${path('M146 137l-3 45m31-45 3 45', theme.ink, 7)}
    ${path('M143 183h-12m46 0h12', theme.ink, 4)}
    ${head(160, 55, theme)}
    ${path(`M${point(160 - spread, shoulder)}Q160 ${round(shoulder - 5)} ${point(160 + spread, shoulder)}L185 137Q160 146 135 137Z`, theme.ink, 1.7, theme.shirt)}
    ${path(`M${point(136, shoulder + 3)}Q${point(123, shoulder + 8)} ${point(123, 113 - lift / 2)}L${handsInLap ? '149 133' : point(126, 139 - lift / 2)}`, theme.ink, 4.5)}
    ${path(`M${point(184, shoulder + 3)}Q${point(197, shoulder + 8)} ${point(197, 113 - lift / 2)}L${handsInLap ? '171 133' : point(194, 139 - lift / 2)}`, theme.ink, 4.5)}
    ${handsInLap
      ? `${ellipse(151, 134, 6, 3, theme.skin, `stroke="${theme.ink}" stroke-width="1.3"`)}${ellipse(169, 134, 6, 3, theme.skin, `stroke="${theme.ink}" stroke-width="1.3"`)}`
      : `${ellipse(126, 141 - lift / 2, 4, 6, theme.skin, `stroke="${theme.ink}" stroke-width="1.3"`)}${ellipse(194, 141 - lift / 2, 4, 6, theme.skin, `stroke="${theme.ink}" stroke-width="1.3"`)}`}
  `
}

function shoulders(t, theme) {
  const lift = 7.5 * (1 - Math.cos(t * Math.PI * 2)) / 2
  return `
    ${seated(theme, lift)}
    ${path('M104 114q-9-13 0-27m-6 5 6-6 4 7M216 87q9 13 0 27m-4-7 4 7 6-5', theme.ink, 1.5, 'none', 'opacity=".55"')}
  `
}

function eyes(t, theme) {
  const blink = smooth((t - 0.54) / 0.06) * (1 - smooth((t - 0.6) / 0.07))
  const open = 1 - blink * 0.97
  const gaze = smooth(t / 0.22) * (1 - smooth((t - 0.84) / 0.16))
  const eye = `M48 103Q108 ${round(103 - 43 * open)} 168 103Q108 ${round(103 + 43 * open)} 48 103Z`
  return `
    <defs><clipPath id="eye"><path d="${eye}"/></clipPath><clipPath id="view"><circle cx="253" cy="100" r="39"/></clipPath></defs>
    ${circle(253, 100, 43, theme.soft)}
    <g clip-path="url(#view)">
      ${circle(253, 100, 39, '#f8f9ef')}
      ${circle(269, 83, 8, '#d6b18b')}
      ${path('M210 119q24-35 46-8q22-16 44 4v31h-90Z', theme.shirt, 0, theme.shirt)}
      ${path('M209 129q32-20 55-2q20-12 41-6v24h-96Z', theme.ink, 0, theme.ink)}
    </g>
    ${path('M212 146h81', theme.floor, 2)}
    ${path(eye, theme.ink, 2, '#fafbf6')}
    <g clip-path="url(#eye)">
      ${circle(106 + 13 * gaze, 103, 17, theme.shirt)}
      ${circle(106 + 13 * gaze, 103, 8, theme.ink)}
      ${circle(111 + 13 * gaze, 98, 3, '#fafbf6')}
    </g>
    ${path(`M48 103Q108 ${round(103 - 43 * open)} 168 103`, theme.ink, 2)}
    ${path('M66 69q39-22 76 0', theme.ink, 1.7, 'none', 'opacity=".45"')}
    ${path('M177 103h23m-5-4 5 4-5 4', theme.ink, 1.3, 'none', 'stroke-dasharray="2 4" opacity=".65"')}
    ${path('M63 154q45 9 87 0', theme.floor, 2)}
  `
}

function stand(t, theme) {
  const rise = smooth((t - 0.06) / 0.27) * (1 - smooth((t - 0.75) / 0.25))
  const reach = smooth((t - 0.33) / 0.18) * (1 - smooth((t - 0.6) / 0.15))
  const hipX = 141 + 22 * rise
  const hipY = 142 - 23 * rise
  const shoulderX = 139 + 22 * rise
  const shoulderY = 95 - 24 * rise
  const kneeX = 180 - 9 * rise
  const kneeY = 145 + 10 * rise
  return `
    ${path('M104 101v44h51m-46 5v39m39-39v39', theme.floor, 5)}
    <rect x="107" y="139" width="51" height="9" rx="4" fill="${theme.soft}" stroke="${theme.ink}" stroke-width="1.4"/>
    ${path(`M${point(hipX - 5, hipY)}L${point(kneeX - 10, kneeY)} 172 187h12`, theme.shirt, 6)}
    ${path(`M${point(hipX + 4, hipY)}L${point(kneeX + 1, kneeY + 2)} 182 190h12`, theme.ink, 6)}
    ${head(137 + 22 * rise, 65 - 23 * rise, theme, true)}
    ${path(`M${point(shoulderX - 9, shoulderY - 6)}Q${point(shoulderX + 9, shoulderY - 10)} ${point(shoulderX + 16, shoulderY + 2)}L${point(hipX + 15, hipY - 3)}Q${point(hipX, hipY + 5)} ${point(hipX - 12, hipY - 2)}Z`, theme.ink, 1.6, theme.shirt)}
    ${path(`M${point(shoulderX + 11, shoulderY + 3)}L${point(shoulderX + 18 + 16 * reach, shoulderY + 26 - 18 * reach)} ${point(shoulderX + 26 + 35 * reach, shoulderY + 40 - 46 * reach)}`, theme.ink, 4)}
    ${circle(shoulderX + 26 + 35 * reach, shoulderY + 40 - 46 * reach, 4, theme.skin, `stroke="${theme.ink}" stroke-width="1.2"`)}
    ${path('M232 183h21m-10-5 10 5-10 5', theme.ink, 1.4, 'none', 'opacity=".35"')}
  `
}

function breathe(t, theme) {
  const breath = (1 - Math.cos(t * Math.PI * 2)) / 2
  return `
    ${circle(160, 109, 66 + 12 * breath, theme.soft)}
    ${circle(160, 109, 77 + 12 * breath, 'none', `stroke="${theme.shirt}" stroke-width="1.5" opacity=".65"`)}
    ${seated(theme, breath * 1.5, breath * 2, true)}
  `
}

function hand(x, openness, theme, mirror = false) {
  const fingers = [-13, -4, 6, 15].map((root, index) => {
    const length = [27, 39, 36, 26][index]
    const jointY = -40 - length * 0.42 * openness
    const tipY = -29 - length * openness
    const d = `M${root} -24Q${root - 2} ${round(jointY)} ${root + 1} ${round(jointY)}Q${root + 7} ${round(jointY)} ${round(root + 5 * (1 - openness))} ${round(tipY)}`
    return path(d, theme.ink, 9) + path(d, theme.skin, 6)
  }).join('')
  const thumbX = -11 - 19 * openness
  return `<g transform="translate(${x} 144)${mirror ? ' scale(-1 1)' : ''}">
    ${path('M-12 1l-2 48h28L12 1', theme.ink, 1.8, theme.skin)}
    <path d="M-16 35h32l2 18h-36Z" fill="${theme.shirt}"/>
    ${fingers}
    ${path('M-16-30q15-4 32 0l3 25Q16 9 10 12h-19q-10-10-11-24Z', theme.ink, 1.8, theme.skin)}
    ${path(`M-11 0Q-26 -10 ${thumbX} ${round(-20 - 9 * openness)}`, theme.ink, 10)}
    ${path(`M-11 0Q-26 -10 ${thumbX} ${round(-20 - 9 * openness)}`, theme.skin, 7)}
    ${path('M-6 5q7 3 13 0', theme.ink, 1, 'none', 'opacity=".5"')}
  </g>`
}

function wrists(t, theme) {
  const openness = (1 + Math.cos(t * Math.PI * 2)) / 2
  return `
    ${ellipse(160, 191, 108, 8, theme.floor)}
    ${hand(107, openness, theme)}
    ${hand(213, openness, theme, true)}
    ${path('M52 107q-7-14 0-27m-5 5 5-5 3 6M268 80q7 14 0 27m-3-6 3 6 5-5', theme.ink, 1.3, 'none', 'opacity=".45"')}
  `
}

function walk(t, theme) {
  const phase = t * Math.PI * 4
  const sway = Math.sin(phase) * 2
  const bob = Math.cos(phase * 2) * 1.5
  const leg = (angle, color) => {
    const hip = 158 + sway
    const ankleX = hip + 25 * Math.sin(angle)
    const ankleY = 189 - Math.max(0, Math.cos(angle)) * 10
    const kneeX = (hip + ankleX) / 2 + 7 * Math.max(0, Math.cos(angle))
    return path(`M${point(hip, 128 + bob)}L${point(kneeX, 158 + bob)} ${point(ankleX, ankleY)}l11 1`, color, 5)
  }
  return `
    ${path('M81 192h166', theme.floor, 2)}
    ${leg(phase + Math.PI, theme.shirt)}
    ${path(`M${point(153 + sway, 87 + bob)}q${round(16 * Math.sin(phase))} 19 ${round(24 * Math.sin(phase))} 39`, theme.shirt, 4)}
    ${leg(phase, theme.ink)}
    ${head(164 + sway, 54 + bob, theme, true)}
    ${path(`M${point(148 + sway, 80 + bob)}q14-5 28 6l-5 43q-14 4-28-3Z`, theme.ink, 1.5, theme.shirt)}
    ${path(`M${point(165 + sway, 88 + bob)}q${round(-12 * Math.sin(phase))} 22 ${round(-25 * Math.sin(phase))} 41`, theme.ink, 4)}
    ${circle(165 + sway - 25 * Math.sin(phase), 129 + bob, 4, theme.skin, `stroke="${theme.ink}" stroke-width="1.2"`)}
    ${path('M229 111h25m-6-5 6 5-6 5', theme.ink, 1.5, 'none', 'opacity=".5"')}
  `
}

const draw = { shoulders, eyes, stand, breathe, wrists, walk }

// Original parametric artwork: no external images, fonts, or animation services.
function svgFrame(routine, time) {
  const theme = themes[routine.theme]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <title>${routine.description}</title>
    <rect width="${width}" height="${height}" fill="${theme.background}"/>
    ${ellipse(161, 194, 92, 6, theme.floor)}
    ${path('M44 187v-21m0 12q-13 0-12-11 12 0 12 11m0-5q12 0 12-10-12 0-12 10', theme.shirt, 1.4, theme.soft)}
    ${draw[routine.id](time, theme)}
  </svg>`
}

await mkdir(destination, { recursive: true })
await mkdir(work, { recursive: true })
const previousTemp = process.env.TMPDIR
process.env.TMPDIR = fileURLToPath(work)
let browser
try {
  browser = await chromium.launch({ headless: true, env: { ...process.env } })
  const page = await browser.newPage({ viewport: { width, height } })
  await page.route('**/*', route => route.abort())
  await page.setContent(`<canvas width="${width}" height="${height}"></canvas>`)

  for (const routine of routines) {
    const encoder = GIFEncoder()
    const uniqueFrames = new Set()
    let palette
    let previousPixels
    for (let frame = 0; frame < frameCount; frame += 1) {
      const encoded = await page.evaluate(async svg => {
        const image = new Image()
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        try {
          image.src = url
          await image.decode()
          const canvas = document.querySelector('canvas')
          const context = canvas.getContext('2d', { willReadFrequently: true })
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          const chunks = []
          for (let offset = 0; offset < pixels.length; offset += 16384) {
            chunks.push(String.fromCharCode(...pixels.subarray(offset, offset + 16384)))
          }
          return btoa(chunks.join(''))
        } finally {
          URL.revokeObjectURL(url)
        }
      }, svgFrame(routine, frame / frameCount))
      const rgba = Uint8Array.from(Buffer.from(encoded, 'base64'))
      palette ??= quantize(rgba, 63)
      const pixels = applyPalette(rgba, palette)
      uniqueFrames.add(createHash('sha256').update(pixels).digest('hex'))
      // Keep unchanged pixels transparent over the previous frame for small local files.
      const delta = previousPixels ? pixels.map((color, index) => color === previousPixels[index] ? palette.length : color) : pixels
      encoder.writeFrame(delta, width, height, {
        palette: frame === 0 ? [...palette, [0, 0, 0]] : undefined,
        delay,
        repeat: 0,
        transparent: frame > 0,
        transparentIndex: palette.length,
        dispose: 1,
      })
      previousPixels = pixels
    }
    if (uniqueFrames.size < 2) throw new Error(`${routine.id} has no motion`)
    encoder.finish()
    const bytes = encoder.bytes()
    await writeFile(new URL(`${routine.id}.gif`, destination), bytes)
    await writeFile(new URL(`${routine.id}-poster.svg`, destination), `${svgFrame(routine, routine.poster)}\n`)
    console.log(`${routine.id}: ${width}×${height}, ${frameCount} frames (${uniqueFrames.size} unique), ${frameCount * delay}ms, ${bytes.length} bytes`)
  }
} finally {
  await browser?.close()
  if (previousTemp === undefined) delete process.env.TMPDIR
  else process.env.TMPDIR = previousTemp
  await rm(work, { recursive: true, force: true })
}
