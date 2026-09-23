# Poise

A calm, responsive Pomodoro workspace with opt-in, on-device posture monitoring and guided recovery breaks.

## Run locally

Requires Node.js 20.19+ or 22.12+ (Node.js 24 is supported).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

The install step downloads Google's MediaPipe Pose Landmarker Lite model and copies the package's WebAssembly runtime into `public/vision/`. Model inference, fonts, and all application assets are then served locally. If asset preparation fails, fix the connection and rerun `npm install`.

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static host with HTTPS. Camera access requires HTTPS or localhost. No backend or API keys are required.

## Your workspace

- **Focus and rest:** 25-minute focus, 5-minute short breaks, and a 15-minute long break after four completed rounds. Customize durations in Preferences. Breaks start automatically; the next focus session waits for an explicit start.
- **Reliable timing:** Deadline-based timers reconcile elapsed time after refresh or tab suspension. If focus ends while the app is suspended, a full break starts when it resumes. Completed breaks do not automatically start another focus session.
- **Energy check-ins:** "A little tired" starts a short recovery break; "Need a reset" starts a long one. Both preserve unfinished focus time and restore it, paused, after the break. These are self-reported check-ins, not automated fatigue diagnoses.
- **Guided resets:** Six timed routines for shoulder relaxation, eye rest, gentle movement, breathing, and hands, with original local animated GIF demonstrations. Opening one pauses a running focus timer. Demonstrations pause with the routine and respect reduced-motion preferences. Completed routines are recorded separately from completed break timers.
- **Activity:** My progress shows seven days of focus, breaks, guided resets, posture/distance observations, and local usage insights. Export a seven-day CSV without uploading anything. Skipped breaks and interrupted rounds are not marked completed.
- **Audible posture warnings:** Posture and distance warning sounds are on by default and unlocked when you enable the camera. Use the posture card's mute control or **Test warning sound**. These warnings are separate from optional timer chimes; enabling every sound is not necessary. Browser-blocked audio is reported explicitly.
- **Other reminders:** In-app reminders work while the app is active. Timer chimes and desktop notifications remain optional and off by default. Desktop notifications require browser permission; sounds require a user interaction. This is a static web app: it cannot send reminders after the page is closed.

## Posture monitoring and privacy

1. Select **Enable camera** and grant browser permission.
2. Use a front-facing camera with your head and both shoulders visible. Sit comfortably upright, with your feet supported and shoulders relaxed.
3. Optionally enter a **Measured starting distance** in centimeters. Measure from your eyes to the screen, keep the camera near the screen, and maintain that distance during calibration. Leave it blank for relative distance only.
4. Select **Set my comfortable posture** and hold still for approximately three seconds.
5. Posture alignment estimates changes in head position, shoulder tilt, and head-to-shoulder spacing. Screen distance is estimated separately from changes in visible eye spacing.

Posture and distance reminders require a sustained deviation (15 seconds on Gentle, 10 on Balanced, 6 on Sensitive) and share a 90-second cooldown. When both are due, one combined warning is shown and sounded. Uncertain or cropped landmarks are not scored. Distance can still be estimated from a reliable face when shoulders move out of view. Small natural movements are welcome; a webcam estimate is not a spinal-health assessment.

Relative distance uses 100% for the calibrated position, with an 80-125% comfort band. With a measured reference, the app displays approximate centimeters and uses the limits in Preferences (initially 50-80 cm). Change these limits for your own comfortable setup; they are not a medical prescription. No starting centimeter value is assumed. Head turns, eye occlusion, camera zoom, camera placement, and calibration errors can affect estimates. Face the camera and recalibrate rather than treating this as a precise distance sensor.

Recalibrate after moving the camera or chair, and keep the tab visible during calibration. Once calibrated, posture check-ins continue while navigating within the app or switching to other tabs (about six checks per second in the foreground, one per second in the background). The camera stays on until you turn it off or close the page. Enable optional desktop reminders if you want alerts while working elsewhere.

Browsers may throttle or suspend background pages and camera frames; computer sleep also delays reminders. The app clears stale observations instead of treating an unobserved gap as sustained poor posture. Keep the app open and visible for the most reliable live monitoring. A web page cannot guarantee background operation or reminders after it is closed.

Video frames and calibration are kept only in memory. They are never recorded, uploaded, or saved. Preferences, timer state, and aggregate activity totals live in `localStorage` under `poise.workspace.v1`. Existing version-1 data is upgraded to version 2 without discarding valid preferences, timers, or activity. Camera access never starts automatically after a reload. Clear activity totals in Preferences. Use one open Poise tab per browser profile to avoid concurrent activity updates.

The calibration score is an estimate, not a medical diagnosis or an objective measure of correct posture. Fatigue cannot be reliably determined from these posture landmarks; use the energy check-in to request rest. Exercises are general wellness suggestions: adapt or skip movements, and stop if they cause pain or dizziness.

## Local usage insights

Usage is kept on each customer's browser, not in a shared administrator database. No user identities, key content, raw landmarks, browsing history, or video are collected. No analytics service is contacted.

- **Active app time:** Sampled every five seconds while this page is visible and the last interaction was within five minutes. Pointer/keyboard/scroll events only update a last-activity timestamp; their contents and coordinates are not recorded.
- **Monitored time:** Sampled time with fresh, calibrated posture or distance observations. Background monitoring can count here without being counted as active app use. Suspended or unobserved gaps are not filled in.
- **Feature counts:** Workspace visits (app loads, not unique people), focus starts/resumes, actual guided-reset starts, energy check-ins, fatigue breaks, and posture/distance warning counts. A combined alert counts once in each applicable warning category, not as two sounds.
- **Controls:** Pause extra **Local usage insights** in Preferences, export a seven-day CSV in My progress, or clear all activity history. Turning insights off leaves the original focus/break/reset and aggregate posture/distance progress available; existing totals are retained until cleared.

These are sampled wellness/product-usage estimates, not precise attendance, employee monitoring, or billing records. Closing the page stops collection. A reload does not count offline time as usage.

## Exercise animation assets

Original animated GIFs and static posters are served from `public/exercises/`. No remote image provider or video recording is used. Animation controls are independent of the guided timer, and static posters are used when motion is paused or reduced motion is preferred.

To regenerate the assets locally with the development dependencies installed:

```sh
npx playwright install chromium
npm run assets:exercises
```

Generated assets are included, so a normal app install/build does not need to regenerate them or install a browser.

## Implementation

- React, TypeScript, Vite, and locally bundled DM Sans.
- MediaPipe Tasks Vision, running the Lite pose model on CPU at a limited frame rate.
- Pure timer, posture, distance, sound scheduling, migration, and usage calculations with Vitest coverage.
- Browser coverage in `tests/` with Playwright: `npx playwright test`. Install a Playwright browser first if it is not available (`npx playwright install chromium`). Tests use a synthetic camera, not your physical webcam. They cover real local-model loading separately from deterministic landmark fixtures for calibration and reminder timing.

The MediaPipe runtime is provided by `@mediapipe/tasks-vision`; the official model asset is fetched from Google's versioned MediaPipe model distribution during installation. Those upstream assets remain subject to their respective licenses.
