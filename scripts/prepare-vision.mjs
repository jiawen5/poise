import { cp, mkdir, rename, stat, unlink } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const destination = new URL('../public/vision/', import.meta.url)
await mkdir(destination, { recursive: true })
await cp(
  new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  new URL('wasm/', destination),
  { recursive: true },
)

const model = new URL('pose_landmarker_lite.task', destination)
let modelExists = false
try {
  modelExists = (await stat(model)).size > 1_000_000
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

if (!modelExists) {
  console.log('Downloading the posture model for local, private inference...')
  const response = await fetch(
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    { signal: AbortSignal.timeout(120_000) },
  )
  if (!response.ok || !response.body) {
    throw new Error(`Posture model download failed: ${response.status} ${response.statusText}`)
  }
  const temporary = new URL('pose_landmarker_lite.task.download', destination)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
  if ((await stat(temporary)).size < 1_000_000) {
    await unlink(temporary)
    throw new Error('The downloaded posture model is incomplete. Run npm install again.')
  }
  await rename(temporary, model)
}
console.log('On-device posture assets are ready.')
