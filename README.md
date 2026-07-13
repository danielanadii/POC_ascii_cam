# ASCII VISION

Proof-of-concept: a human-tracked ASCII experience. Landing page is an
ASCII **black hole** — glyphs (`#$%^&*<>?!@()`) spiraling into an event
horizon — with one glowing CTA. Get started and the camera opens:

- **Mode 1 — ASCII RAIN**: characters (`*!@#(<>?.`) rain over the live
  feed and *react to you* — drops splash-burst when they hit your body,
  and your silhouette's top edge sparkles with `....` detector dots.
- **✋ Open palm** switches modes.
- **Mode 2 — ASCII BODY**: the video slowly fades to pure black while you
  are re-rendered as luminance-mapped ASCII characters — and during the
  morph, raindrops that hit you **stick**, so the rain literally becomes
  your shape.

Built with the same stack as the sibling projects (Vite + React + Tailwind
+ MediaPipe Tasks Vision + motion), styled per the installed **UI/UX Pro
Max kit** (`.claude/skills/ui-ux-pro-max`): Retro-Futurism style (deep
black, monospace, neon glow, CRT scanlines) on the Minimal & Direct
landing pattern (single column, one CTA).

## Run it (on your machine — servers started by Claude die with its session)

```
cd ascii-cam
npm install
npm run dev
```

Open the printed URL in Chrome/Edge and allow camera access. Everything
runs on-device; no video leaves the browser.

## How it works

- `hooks/useAsciiVision.js` — MediaPipe **ImageSegmenter** (selfie
  segmentation → per-pixel person mask) + **GestureRecognizer** (palm
  detection, every 3rd frame) + a canvas renderer with a character grid
  (96 columns), a rain particle system, splash bursts, stick-to-silhouette
  cells, and a slow (~2.2s) morph between modes.
- `components/BlackholeCanvas.jsx` — landing-page glyph vortex.
- Segmentation-mask polarity guard: if the mask ever reads "person
  everywhere" for a sustained stretch (the selfie-segmenter category
  convention is a known foot-gun), it auto-inverts once — see
  `ASSUME_PERSON_IS_NONZERO` in the hook if you ever need to flip it
  manually.

## Tuning

All in `useAsciiVision.js`: `COLS` (ASCII resolution), `RAIN_COUNT`,
`MORPH_PER_SECOND` (mode-transition speed), glyph sets (`RAIN_GLYPHS`,
`ASCII_RAMP`).
