export type ExerciseKind = 'shoulders' | 'eyes' | 'stand' | 'breathe' | 'wrists' | 'walk'

export interface Exercise {
  id: ExerciseKind
  title: string
  subtitle: string
  category: string
  color: 'peach' | 'sage' | 'lavender'
  steps: { title: string; instruction: string; seconds: number }[]
}

export const exercises: Exercise[] = [
  {
    id: 'shoulders',
    title: 'Let your shoulders go',
    subtitle: 'Release the tension you did not know you were holding.',
    category: 'UPPER BODY',
    color: 'peach',
    steps: [
      { title: 'Find a comfortable seat', instruction: 'Rest your feet on the floor. Let your arms hang loosely and take a slow, easy breath.', seconds: 15 },
      { title: 'Lift, then let go', instruction: 'Gently lift your shoulders toward your ears, then let them relax. Repeat slowly, only within a comfortable range.', seconds: 30 },
      { title: 'Settle and breathe', instruction: 'Let your shoulders rest. Unclench your jaw and notice how your upper body feels.', seconds: 15 },
    ],
  },
  {
    id: 'eyes',
    title: 'Give your eyes a break',
    subtitle: 'A little distance. A fresh perspective.',
    category: 'EYE REST',
    color: 'sage',
    steps: [
      { title: 'Look a little further', instruction: 'Look away from your screen at something about 20 feet (6 meters) away. Blink naturally and let your eyes rest for 20 seconds.', seconds: 20 },
    ],
  },
  {
    id: 'stand',
    title: 'Stand up. Reset.',
    subtitle: 'Make a little room for movement.',
    category: 'FULL BODY',
    color: 'lavender',
    steps: [
      { title: 'Rise at your own pace', instruction: 'If it is comfortable and safe for you, stand up slowly with support nearby. You can also stay seated and move your feet.', seconds: 15 },
      { title: 'Reach comfortably', instruction: 'Gently reach your arms forward or upward within an easy range. Keep breathing and avoid forcing a stretch.', seconds: 30 },
      { title: 'Move a little', instruction: 'Take a few relaxed steps in your clear space, or gently march your feet while seated.', seconds: 30 },
      { title: 'Come back refreshed', instruction: 'Settle back into your seat. Give your feet support and let your shoulders soften.', seconds: 15 },
    ],
  },
  {
    id: 'breathe',
    title: 'A moment to breathe',
    subtitle: 'Nothing to finish. Just a little space.',
    category: 'MINDFUL MOMENT',
    color: 'sage',
    steps: [
      { title: 'Arrive here', instruction: 'Rest your hands comfortably. Let your gaze soften and notice your natural breathing.', seconds: 15 },
      { title: 'An easy rhythm', instruction: 'Breathe slowly and comfortably, without holding your breath or forcing a deep inhale.', seconds: 30 },
      { title: 'Check in with yourself', instruction: 'Notice your feet on the floor. Let your breathing return to its usual rhythm.', seconds: 15 },
    ],
  },
  {
    id: 'wrists',
    title: 'Unwind your hands',
    subtitle: 'A small thank-you to your hardworking hands.',
    category: 'HANDS & WRISTS',
    color: 'peach',
    steps: [
      { title: 'Step away from the keys', instruction: 'Rest your forearms comfortably. Open your hands gently and relax your fingers.', seconds: 15 },
      { title: 'Find a little movement', instruction: 'Slowly open and close your hands without squeezing tightly. Keep your wrists in a comfortable position.', seconds: 20 },
      { title: 'Let everything soften', instruction: 'Let your hands rest. Release any tension in your fingers and forearms.', seconds: 10 },
    ],
  },
  {
    id: 'walk',
    title: 'Take the scenic route',
    subtitle: 'A short wander can go a long way.',
    category: 'MOVEMENT',
    color: 'lavender',
    steps: [
      { title: 'Make space', instruction: 'If walking is comfortable for you, stand slowly and check that your path is clear. Seated movement is welcome too.', seconds: 15 },
      { title: 'Wander, not rush', instruction: 'Take a relaxed walk around your space, or move your feet gently while seated. Leave your screen behind for a moment.', seconds: 90 },
      { title: 'Return with intention', instruction: 'Come back at your own pace. Have a sip of water if you would like, then settle in.', seconds: 15 },
    ],
  },
]

export function exerciseSeconds(exercise: Exercise): number {
  return exercise.steps.reduce((sum, step) => sum + step.seconds, 0)
}

export function exerciseDuration(exercise: Exercise): string {
  const seconds = exerciseSeconds(exercise)
  return seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec`
}
