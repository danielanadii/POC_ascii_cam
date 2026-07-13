// Landing — UI/UX Pro kit "Minimal & Direct" pattern: single column, one
// primary CTA, large mono typography, generous space; Retro-Futurism style
// (deep black, neon glow, glitch accent) behind an ASCII black hole.
import { motion } from "motion/react";
import BlackholeCanvas from "./BlackholeCanvas";

export default function Landing({ onStart }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#030304]">
      <BlackholeCanvas />

      {/* Vignette for text legibility over the vortex */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(3,3,4,0.75)_100%)]" />

      <div className="relative z-10 flex h-full flex-col items-center justify-end pb-[12vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="text-[10px] uppercase tracking-[0.5em] text-cyan-300/70 mb-4">
            /// proof of concept
          </div>
          <h1 className="glitch glow-text text-5xl md:text-7xl font-bold tracking-tight text-[#e8ffe8]">
            ASCII&nbsp;VISION
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm md:text-base leading-relaxed text-[#e8ffe8]/60">
            Step in front of the camera. Characters rain around you, find you —
            and, at a wave of your palm, <span className="text-[#00ff66]">become you</span>.
          </p>
        </motion.div>

        <motion.button
          type="button"
          onClick={onStart}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="glow-cta mt-10 border border-cyan-300/70 bg-black/60 px-10 py-4 text-sm font-bold uppercase tracking-[0.35em] text-cyan-200 transition-colors hover:bg-cyan-950/40 cursor-pointer"
        >
          Get Started&nbsp;→
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 text-[10px] uppercase tracking-widest text-[#e8ffe8]/35"
        >
          webcam required · nothing leaves your device
        </motion.div>
      </div>
    </div>
  );
}
