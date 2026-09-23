import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exercises } from './exercises'

function decodePixels(data: Buffer, minimumCodeSize: number) {
  const clear = 1 << minimumCodeSize
  const end = clear + 1
  let dictionary: number[][] = []
  let codeSize = minimumCodeSize + 1
  let bit = 0
  let previous: number[] | undefined
  const output: number[] = []
  const reset = () => {
    dictionary = Array.from({ length: clear + 2 }, (_, index) => index < clear ? [index] : [])
    codeSize = minimumCodeSize + 1
    previous = undefined
  }
  reset()
  while (bit + codeSize <= data.length * 8) {
    let code = 0
    for (let index = 0; index < codeSize; index += 1, bit += 1) {
      code |= ((data[bit >> 3] >> (bit % 8)) & 1) << index
    }
    if (code === clear) { reset(); continue }
    if (code === end) return Uint8Array.from(output)
    const entry = dictionary[code] ?? (code === dictionary.length && previous ? [...previous, previous[0]] : undefined)
    if (!entry?.length) throw new Error('Invalid GIF image data')
    for (const value of entry) output.push(value)
    if (previous && dictionary.length < 4096) {
      dictionary.push([...previous, entry[0]])
      if (dictionary.length === 1 << codeSize && codeSize < 12) codeSize += 1
    }
    previous = entry
  }
  throw new Error('GIF frame has no end code')
}

function inspectGif(data: Buffer) {
  expect(data.subarray(0, 6).toString()).toBe('GIF89a')
  const width = data.readUInt16LE(6)
  const height = data.readUInt16LE(8)
  let offset = 13
  const colorTable = (packed: number) => {
    const length = packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0
    const colors = data.subarray(offset, offset + length)
    offset += length
    return colors
  }
  const globalPalette = colorTable(data[10])
  const frames: { width: number; height: number; delay: number; hash: string }[] = []
  const rgb = Buffer.alloc(width * height * 3)
  let delay = 0
  let loopCount = -1
  let transparentIndex = -1
  const subBlocks = () => {
    const blocks: Buffer[] = []
    let size: number
    while ((size = data[offset++]) > 0) {
      blocks.push(data.subarray(offset, offset + size))
      offset += size
    }
    return Buffer.concat(blocks)
  }
  while (offset < data.length) {
    const marker = data[offset++]
    if (marker === 0x3b) break
    if (marker === 0x21) {
      const label = data[offset++]
      const extension = subBlocks()
      if (label === 0xf9) {
        delay = extension.readUInt16LE(1) * 10
        transparentIndex = extension[0] & 1 ? extension[3] : -1
        expect((extension[0] >> 2) & 7).toBe(1)
      }
      if (label === 0xff && extension.subarray(0, 11).toString() === 'NETSCAPE2.0') loopCount = extension.readUInt16LE(12)
      continue
    }
    expect(marker).toBe(0x2c)
    const frameWidth = data.readUInt16LE(offset + 4)
    const frameHeight = data.readUInt16LE(offset + 6)
    const packed = data[offset + 8]
    offset += 9
    const localPalette = colorTable(packed)
    const palette = localPalette.length ? localPalette : globalPalette
    const minimumCodeSize = data[offset++]
    const pixels = decodePixels(subBlocks(), minimumCodeSize)
    expect(pixels.length).toBe(frameWidth * frameHeight)
    pixels.forEach((pixel, index) => {
      if (pixel !== transparentIndex) palette.copy(rgb, index * 3, pixel * 3, pixel * 3 + 3)
    })
    frames.push({ width: frameWidth, height: frameHeight, delay, hash: createHash('sha256').update(rgb).digest('hex') })
  }
  expect(data[data.length - 1]).toBe(0x3b)
  return { width, height, loopCount, frames }
}

describe('original local exercise media', () => {
  for (const exercise of exercises) {
    it(`${exercise.id} has a real, visibly changing GIF and a static SVG poster`, () => {
      const animation = readFileSync(new URL(`../public/exercises/${exercise.id}.gif`, import.meta.url))
      const poster = readFileSync(new URL(`../public/exercises/${exercise.id}-poster.svg`, import.meta.url), 'utf8')
      const gif = inspectGif(animation)
      expect(gif.width).toBe(320)
      expect(gif.height).toBe(220)
      expect(gif.loopCount).toBe(0)
      expect(gif.frames).toHaveLength(60)
      expect(gif.frames.every(frame => frame.width === 320 && frame.height === 220 && frame.delay === 80)).toBe(true)
      expect(new Set(gif.frames.map(frame => frame.hash)).size).toBeGreaterThan(1)
      expect(animation.length).toBeLessThan(300_000)
      expect(poster.length).toBeLessThan(12_000)
      expect(poster).toContain('width="320" height="220" viewBox="0 0 320 220"')
      expect(poster).toContain('<title>')
      expect(poster).not.toMatch(/<animate|<script|<foreignObject|(?:href|src)=|@import/i)
    })
  }
})
