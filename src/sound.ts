let context: AudioContext | null = null

export async function prepareSound(): Promise<void> {
  if (!window.AudioContext) throw new Error('This browser does not support reminder sounds.')
  if (!context || context.state === 'closed') context = new AudioContext()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      context.resume(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Your browser did not unlock audio. Allow sound for this site, then try Test warning sound.')), 3000)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
  if (context.state !== 'running') throw new Error('Your browser has blocked reminder sounds.')
}

function playNotes(frequencies: number[], spacing: number, duration: number): void {
  if (!context || context.state !== 'running') {
    throw new Error('Your browser paused sound. Use Test warning sound or enable sounds again to unlock it.')
  }
  const start = context.currentTime
  for (const [index, frequency] of frequencies.entries()) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, start + index * spacing)
    gain.gain.linearRampToValueAtTime(0.1, start + index * spacing + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, start + index * spacing + duration - 0.05)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start + index * spacing)
    oscillator.stop(start + index * spacing + duration)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
}

export function playChime(): void {
  playNotes([523.25, 659.25, 783.99], 0.13, 0.75)
}

export function playWarning(): void {
  playNotes([392, 329.63, 392], 0.28, 0.32)
}
