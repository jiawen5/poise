import type { ExerciseKind } from './exercises'

export function Sprout({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <path d="M18 35V15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 24C7 25 3 14 5 5c11-1 17 7 13 19Z" fill="currentColor" />
      <path d="M19 31c10 1 15-8 13-16-10-1-16 6-13 16Z" fill="currentColor" />
    </svg>
  )
}

export function PlantIllustration() {
  return (
    <svg className="plant-illustration" viewBox="0 0 180 135" fill="none" aria-hidden="true">
      <ellipse cx="91" cy="124" rx="43" ry="5" fill="#d4dbc5" />
      <path d="M90 92C87 66 96 47 89 24" stroke="#74855c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M91 77C61 78 54 58 58 43 84 43 94 54 91 77Z" fill="#b7c498" />
      <path d="M91 57C111 60 129 46 126 31 104 31 92 39 91 57Z" fill="#8d9f74" />
      <path d="M89 35C75 30 71 12 78 5 94 12 96 22 89 35Z" fill="#a9b98c" />
      <path d="M91 84C111 88 121 75 120 64 102 62 92 72 91 84Z" fill="#c1ccaa" />
      <path d="m69 89 8 33h28l8-33H69Z" fill="#cba28c" />
      <path d="M67 87h48v8H67z" fill="#d8b49d" />
      <path d="M60 52 87 74m33-36L94 53" stroke="#798c60" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m141 97 3-5 3 5m-3-5v13M35 82l2-3 2 3m-2-3v7" stroke="#aeb995" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PostureIllustration() {
  return (
    <svg className="posture-illustration" viewBox="0 0 330 185" fill="none" aria-hidden="true">
      <ellipse cx="161" cy="169" rx="96" ry="7" fill="#dce2d3" />
      <path d="M62 38V26h13m179 0h13v12M62 136v12h13m179 0h13v-12" stroke="#a0ae92" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M101 111h141m-16 0v56" stroke="#9ba793" strokeWidth="3" strokeLinecap="round" />
      <path d="m198 78 8 26h-43l-8-26h43Z" fill="#d4dacb" stroke="#8c9a80" strokeWidth="1.5" />
      <path d="M202 105h14" stroke="#8c9a80" strokeWidth="2" strokeLinecap="round" />
      <path d="M109 104v32h37" stroke="#b3bda7" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M116 139v26m24-26v26" stroke="#9daa92" strokeWidth="3" strokeLinecap="round" />
      <path d="M140 63c-13-2-21 7-19 22l4 29h27" fill="#bbc9a8" />
      <path d="M139 61c-14-3-22 7-20 22l5 32h31l5 44h15" stroke="#667b55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m137 77 9 25h28" stroke="#667b55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M151 39c2 8-2 18-11 19-9 1-15-5-15-14 0-10 6-15 14-15 8 0 11 4 12 10Z" fill="#e7cdb8" stroke="#867c65" strokeWidth="1.5" />
      <path d="M126 40c0-10 5-16 15-14 7 1 10 5 11 11-6 2-12 0-15-3-2 4-6 7-11 6Z" fill="#63774f" />
      <path d="m120 30-4 77" stroke="#b9c6a8" strokeWidth="1.5" strokeDasharray="4 5" />
      <circle cx="117" cy="77" r="4" fill="#8b9e76" stroke="#f0f3e9" strokeWidth="2" />
      <circle cx="120" cy="40" r="4" fill="#8b9e76" stroke="#f0f3e9" strokeWidth="2" />
      <circle cx="231" cy="58" r="12" fill="#dbe4cd" />
      <path d="m226 58 3 3 6-6" stroke="#788e61" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ExerciseIllustration({ kind }: { kind: ExerciseKind }) {
  return (
    <svg className={`exercise-illustration illustration-${kind}`} viewBox="0 0 160 124" fill="none" aria-hidden="true">
      <ellipse cx="83" cy="109" rx="52" ry="6" fill="currentColor" opacity=".08" />
      {kind === 'eyes' ? (
        <>
          <path d="M25 60c28-36 79-36 110 0-30 35-80 35-110 0Z" fill="currentColor" opacity=".08" />
          <path d="M29 61c28-28 72-28 101 0-29 27-73 27-101 0Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="80" cy="61" r="17" fill="currentColor" opacity=".14" />
          <circle cx="80" cy="61" r="8" fill="currentColor" />
          <circle cx="83" cy="58" r="2.5" fill="#fff" />
          <path d="m80 19 1 9m-30-5 4 8m54-8-4 8m34 62 4-6m-5 1 6 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : kind === 'breathe' ? (
        <>
          <path d="M80 88C35 88 25 45 44 32c14-9 31 6 36 21 5-15 23-30 36-21 21 14 10 56-36 56Z" fill="currentColor" opacity=".12" />
          <path d="M79 91V52m0 33C48 87 30 68 37 52c19-2 36 10 42 33Zm2-11c29-1 44-17 37-31-19 0-31 13-37 31Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M58 18h10m-5-5v10m56 63h8m-4-4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : kind === 'wrists' ? (
        <>
          <path d="m46 105-8-39c-1-7 7-9 10-3l6 12V34c0-7 9-7 9 0v26-38c0-7 9-7 9 0v37-40c0-7 9-7 9 0v41-31c0-7 9-7 9 0v50c0 12-5 17-7 26" fill="currentColor" opacity=".1" />
          <path d="m48 104-9-37c-2-8 5-11 9-3l7 13V36c0-8 8-8 8 0v27-39c0-7 9-7 9 0v38-43c0-7 9-7 9 0v43-32c0-7 9-7 9 0v49c0 11-6 19-7 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M112 48c9 8 11 20 6 30m-4-4 4 5 6-3M30 25l-4 7m-4-6 10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={kind === 'walk' ? 84 : 80} cy="27" r="12" fill="#e2bda1" />
          <path d="M69 23c1-12 20-14 23-1-7 3-12 0-16-3-1 4-4 5-7 4Z" fill="currentColor" />
          {kind === 'stand' ? (
            <>
              <path d="M69 46h22l4 33H65l4-33Z" fill="currentColor" opacity=".27" />
              <path d="m69 49-15-9-10-25m46 34 15-9 10-25M72 78l-7 31m22-31 8 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m30 27-4 9m-1-8 7 6m91 39 6-2m-4-2 1 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : kind === 'walk' ? (
            <>
              <path d="m75 45 20 5-8 29-20-5 8-29Z" fill="currentColor" opacity=".27" />
              <path d="m77 48-16 15-13-1m43-11 12 16 14-5M72 75l-17 29H42m42-25 12 20 15 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 47h20m-15 9h13m79-34 3 6 7-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M66 46h28l6 40H61l5-40Z" fill="currentColor" opacity=".27" />
              <path d="m68 48-13 8-7 29m44-37 13 8 7 29M66 86v20m27-20v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M41 55c-9-12-5-24 4-28m-7 0h7v7m73 21c9-12 5-24-4-28m7 0h-7v7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M54 91h54v8H54z" fill="currentColor" opacity=".1" />
            </>
          )}
        </>
      )}
    </svg>
  )
}
