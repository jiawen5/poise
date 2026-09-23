import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const frequencies: number[] = []
const starts: number[] = []
let blocked = false
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

class TestAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {}
  async resume() { if (!blocked) this.state = 'running' }
  createOscillator() {
    const frequency = { value: 0 }
    return {
      frequency, type: 'sine', onended: null,
      connect() {}, disconnect() {},
      start(time: number) { frequencies.push(frequency.value); starts.push(time) },
      stop() {},
    }
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {},
    }
  }
}

beforeEach(() => {
  vi.resetModules()
  frequencies.length = 0
  starts.length = 0
  blocked = false
  vi.stubGlobal('window', { AudioContext: TestAudioContext })
  vi.stubGlobal('AudioContext', TestAudioContext)
})

describe('audible monitor warnings', () => {
  it('requires an explicit browser audio unlock before playing', async () => {
    const { playWarning } = await import('./sound')
    expect(playWarning).toThrow('Your browser paused sound')
    expect(starts).toHaveLength(0)
  })
  it('plays a distinct warning sequence once audio is unlocked', async () => {
    const { prepareSound, playWarning } = await import('./sound')
    await prepareSound()
    expect(starts).toHaveLength(0)
    playWarning()
    expect(frequencies).toEqual([392, 329.63, 392])
    expect(starts).toEqual([0, 0.28, 0.56])
  })
  it('preserves the separate timer chime', async () => {
    const { prepareSound, playChime } = await import('./sound')
    await prepareSound()
    playChime()
    expect(frequencies).toEqual([523.25, 659.25, 783.99])
  })
  it('reports blocked audio instead of silently claiming success', async () => {
    const { prepareSound, playWarning } = await import('./sound')
    blocked = true
    await expect(prepareSound()).rejects.toThrow('blocked reminder sounds')
    expect(playWarning).toThrow()
    expect(starts).toHaveLength(0)
  })
  it('reports a browser audio-unlock request that never resolves', async () => {
    vi.useFakeTimers()
    vi.spyOn(TestAudioContext.prototype, 'resume').mockImplementationOnce(() => new Promise(() => {}))
    const { prepareSound } = await import('./sound')
    const failure = expect(prepareSound()).rejects.toThrow('did not unlock audio')
    await vi.advanceTimersByTimeAsync(3000)
    await failure
    expect(starts).toHaveLength(0)
  })
})
