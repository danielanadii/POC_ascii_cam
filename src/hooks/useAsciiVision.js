// useAsciiVision.js — camera + MediaPipe ImageSegmenter (person mask) +
// GestureRecognizer (palm = mode switch) + the ASCII renderer.
//
// Two modes, one slow morph between them:
//   RAIN  — live video, glyphs (*!@#(<>?.) rain over the scene and REACT to
//           the person: drops splash-burst when they hit the body, and the
//           person's top silhouette edge sparkles with "..." dots.
//   BODY  — background fades to pure black while the person is re-rendered
//           as luminance-mapped ASCII; during the morph, raindrops that hit
//           the body STICK and become part of the silhouette — the rain
//           literally becomes the person.
import { useEffect, useRef, useState } from "react";
import {
  ImageSegmenter,
  GestureRecognizer,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const SEG_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const COLS = 96;
const RAIN_COUNT = 150;
const RAIN_GLYPHS = "*!@#(<>?.$%&;:~".split("");
const ASCII_RAMP = " .':;=+*#%@".split(""); // dark -> bright
const MODE_DEBOUNCE_MS = 1500;
const MORPH_PER_SECOND = 0.45; // ~2.2s slow morph, per the brief

// Selfie-segmenter category convention (person vs background) has bitten
// many integrations; if the mask ever reads as "person almost everywhere"
// for a sustained stretch, we auto-flip once. Manual override for quick
// debugging: flip this constant.
const ASSUME_PERSON_IS_NONZERO = true;

export function useAsciiVision() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("RAIN");
  const [personDetected, setPersonDetected] = useState(false);
  const modeRef = useRef("RAIN");

  useEffect(() => {
    let alive = true;
    let stream;
    let segmenter;
    let recognizer;
    let raf = 0;

    const sample = document.createElement("canvas");
    const sctx = sample.getContext("2d", { willReadFrequently: true });

    const maskRef = { data: null, w: 0, h: 0 };
    let invertMask = !ASSUME_PERSON_IS_NONZERO;
    let highFractionFrames = 0;
    let autoFlipped = false;

    let t = 0; // morph progress 0 = RAIN, 1 = BODY
    let lastFrameAt = performance.now();
    let lastToggleAt = 0;
    let frameCount = 0;

    const rain = [];
    const stuck = new Map(); // cellIndex -> { glyph, ttl }
    const splashes = []; // { x, y, glyph, ttl }

    function resetRainDrop(d, canvasH) {
      d.col = (Math.random() * COLS) | 0;
      d.y = -Math.random() * canvasH * 0.5;
      d.speed = 90 + Math.random() * 220;
      d.glyph = RAIN_GLYPHS[(Math.random() * RAIN_GLYPHS.length) | 0];
      d.bright = 0.35 + Math.random() * 0.65;
      return d;
    }

    function coverRect(videoW, videoH, outW, outH) {
      // Source crop rect so the video COVERS the canvas (same crop math the
      // mask sampling uses, so glyph cells and person mask stay aligned).
      const scale = Math.max(outW / videoW, outH / videoH);
      const sw = outW / scale;
      const sh = outH / scale;
      return { sx: (videoW - sw) / 2, sy: (videoH - sh) / 2, sw, sh };
    }

    function isPersonCell(c, r, rows, video) {
      const m = maskRef;
      if (!m.data) return false;
      const { sx, sy, sw, sh } = coverRect(video.videoWidth, video.videoHeight, COLS, rows);
      // Mirrored screen -> unmirrored video x
      const u = 1 - (c + 0.5) / COLS;
      const vx = sx + u * sw;
      const vy = sy + ((r + 0.5) / rows) * sh;
      const mx = Math.min(m.w - 1, Math.max(0, (vx * (m.w / video.videoWidth)) | 0));
      const my = Math.min(m.h - 1, Math.max(0, (vy * (m.h / video.videoHeight)) | 0));
      const v = m.data[my * m.w + mx] > 0;
      return invertMask ? !v : v;
    }

    function loop() {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !segmenter || video.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
      lastFrameAt = now;
      frameCount++;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      const W = canvas.width;
      const H = canvas.height;
      const cell = W / COLS;
      const ROWS = Math.ceil(H / cell);

      // --- Perception ---
      segmenter.segmentForVideo(video, now, (result) => {
        const cm = result.categoryMask;
        if (cm) {
          maskRef.data = cm.getAsUint8Array().slice();
          maskRef.w = cm.width;
          maskRef.h = cm.height;
        }
      });

      if (recognizer && frameCount % 3 === 0) {
        const res = recognizer.recognizeForVideo(video, now + 0.001);
        const top = res.gestures?.[0]?.[0];
        if (
          top?.categoryName === "Open_Palm" &&
          top.score > 0.6 &&
          now - lastToggleAt > MODE_DEBOUNCE_MS
        ) {
          lastToggleAt = now;
          modeRef.current = modeRef.current === "RAIN" ? "BODY" : "RAIN";
          setMode(modeRef.current);
        }
      }

      // Auto-flip guard for inverted segmentation conventions
      if (maskRef.data && !autoFlipped && frameCount % 10 === 0) {
        let on = 0;
        const step = Math.max(1, (maskRef.data.length / 2000) | 0);
        for (let i = 0; i < maskRef.data.length; i += step) if (maskRef.data[i] > 0) on++;
        const frac = on / (maskRef.data.length / step);
        const personFrac = invertMask ? 1 - frac : frac;
        highFractionFrames = personFrac > 0.85 ? highFractionFrames + 1 : 0;
        if (highFractionFrames > 6) {
          invertMask = !invertMask;
          autoFlipped = true;
        }
      }

      // --- Morph progress ---
      const target = modeRef.current === "BODY" ? 1 : 0;
      t += Math.sign(target - t) * MORPH_PER_SECOND * dt;
      t = Math.max(0, Math.min(1, t));

      // --- Luminance grid (mirrored, cover-cropped) ---
      if (sample.width !== COLS || sample.height !== ROWS) {
        sample.width = COLS;
        sample.height = ROWS;
      }
      const { sx, sy, sw, sh } = coverRect(video.videoWidth, video.videoHeight, COLS, ROWS);
      sctx.save();
      sctx.setTransform(-1, 0, 0, 1, COLS, 0);
      sctx.drawImage(video, sx, sy, sw, sh, 0, 0, COLS, ROWS);
      sctx.restore();
      const lum = sctx.getImageData(0, 0, COLS, ROWS).data;

      // --- Person cell grid + detection state ---
      let personCells = 0;
      const person = new Uint8Array(COLS * ROWS);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (isPersonCell(c, r, ROWS, video)) {
            person[r * COLS + c] = 1;
            personCells++;
          }
        }
      }
      if (frameCount % 15 === 0) setPersonDetected(personCells > COLS * ROWS * 0.01);

      // --- Draw ---
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);

      // Video backdrop fades out as we morph to BODY (black background)
      const videoAlpha = (1 - t) * 1.0;
      if (videoAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = videoAlpha;
        ctx.setTransform(-1, 0, 0, 1, W, 0);
        const dst = coverRect(video.videoWidth, video.videoHeight, W, H);
        ctx.drawImage(video, dst.sx, dst.sy, dst.sw, dst.sh, 0, 0, W, H);
        ctx.restore();
        // Dim for glyph legibility
        ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * videoAlpha})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontPx = Math.ceil(cell);
      ctx.font = `${fontPx}px ui-monospace, monospace`;

      // ASCII body (BODY mode): person cells as luminance-mapped characters
      if (t > 0.01) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            if (!person[idx]) continue;
            const li = (lum[idx * 4] * 0.299 + lum[idx * 4 + 1] * 0.587 + lum[idx * 4 + 2] * 0.114) / 255;
            const ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, (li * ASCII_RAMP.length) | 0)];
            if (ch === " ") continue;
            const a = t * (0.3 + li * 0.7);
            ctx.fillStyle = `rgba(0, 255, 102, ${a})`;
            ctx.fillText(ch, c * cell + cell / 2, r * cell + cell / 2);
          }
        }
      }

      // Stuck raindrops — the rain that "became the person" during the morph
      for (const [idx, s] of stuck) {
        s.ttl -= dt;
        if (s.ttl <= 0 || t < 0.01) {
          stuck.delete(idx);
          continue;
        }
        const c = idx % COLS;
        const r = (idx / COLS) | 0;
        if (!person[idx]) {
          stuck.delete(idx); // person moved; released cells dissolve
          continue;
        }
        ctx.fillStyle = `rgba(200, 255, 220, ${Math.min(1, s.ttl) * 0.9})`;
        ctx.fillText(s.glyph, c * cell + cell / 2, r * cell + cell / 2);
      }

      // Rain — density eases down as the body render takes over
      if (rain.length === 0) {
        for (let i = 0; i < RAIN_COUNT; i++) rain.push(resetRainDrop({}, H));
      }
      const rainAlphaScale = 1 - t * 0.65;
      for (const d of rain) {
        d.y += d.speed * dt * (1 + t * 0.3);
        if (d.y > H + 20) resetRainDrop(d, H);
        const c = d.col;
        const r = (d.y / cell) | 0;
        const idx = r * COLS + c;
        if (r >= 0 && r < ROWS && person[idx]) {
          if (t > 0.15) {
            // Morphing/BODY: the drop sticks — rain becomes the person
            if (!stuck.has(idx)) stuck.set(idx, { glyph: d.glyph, ttl: 2.5 + Math.random() * 2 });
          } else {
            // RAIN: splash burst on the body
            splashes.push({ x: c * cell + cell / 2, y: d.y, glyph: "*", ttl: 0.35 });
          }
          resetRainDrop(d, H);
          continue;
        }
        ctx.fillStyle = `rgba(0, 255, 102, ${d.bright * rainAlphaScale})`;
        ctx.fillText(d.glyph, c * cell + cell / 2, d.y);
      }

      // Splashes (RAIN mode impact bursts)
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.ttl -= dt;
        if (s.ttl <= 0) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${s.ttl / 0.35})`;
        ctx.fillText(s.glyph, s.x, s.y - (0.35 - s.ttl) * 40);
      }

      // Person top-edge sparkle dots (the "....": detector outline, RAIN mode)
      if (t < 0.85) {
        ctx.font = `${Math.ceil(cell * 0.8)}px ui-monospace, monospace`;
        for (let c = 0; c < COLS; c++) {
          for (let r = 1; r < ROWS; r++) {
            const idx = r * COLS + c;
            if (person[idx] && !person[idx - COLS]) {
              if (Math.random() < 0.35) {
                const jx = (Math.random() - 0.5) * cell * 2;
                const jy = -Math.random() * cell * 3;
                ctx.fillStyle = `rgba(255, 255, 255, ${(0.25 + Math.random() * 0.5) * (1 - t)})`;
                ctx.fillText(Math.random() < 0.8 ? "." : ":", c * cell + cell / 2 + jx, r * cell + jy);
              }
              break; // only the topmost edge per column
            }
          }
        }
        ctx.font = `${fontPx}px ui-monospace, monospace`;
      }

      raf = requestAnimationFrame(loop);
    }

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM);
        [segmenter, recognizer] = await Promise.all([
          ImageSegmenter.createFromOptions(vision, {
            baseOptions: { modelAssetPath: SEG_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            outputCategoryMask: true,
            outputConfidenceMasks: false,
          }),
          GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 1,
          }),
        ]);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        if (!alive) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        lastFrameAt = performance.now();
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (alive) setError(e?.message || String(e));
      }
    }

    init();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      segmenter?.close?.();
      recognizer?.close?.();
    };
  }, []);

  return { videoRef, canvasRef, ready, error, mode, personDetected };
}
