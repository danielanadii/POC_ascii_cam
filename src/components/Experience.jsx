// Experience — the camera view: ASCII rain / ASCII body renderer with a
// minimal HUD (mode chip, palm legend, back link).
import { AnimatePresence, motion } from "motion/react";
import { useAsciiVision } from "../hooks/useAsciiVision";

const Micro = ({ children, className = "" }) => (
  <div className={`text-[10px] uppercase tracking-[0.3em] text-[#00ff66]/60 ${className}`}>
    {children}
  </div>
);

export default function Experience({ onExit }) {
  const { videoRef, canvasRef, ready, error, mode, personDetected } = useAsciiVision();

  if (error) {
    return (
      <div className="grid h-full w-full place-items-center bg-black px-6">
        <div className="max-w-md border border-red-500/60 bg-red-500/5 px-8 py-6">
          <Micro className="!text-red-400 mb-3">/// camera access denied</Micro>
          <div className="text-sm leading-relaxed text-red-300">{error}</div>
          <button
            type="button"
            onClick={onExit}
            className="mt-5 border border-red-400/50 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-red-300 hover:bg-red-500/10 cursor-pointer"
          >
            ← back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {!ready && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black">
          <div className="text-sm uppercase tracking-[0.35em] text-[#00ff66]">
            loading vision models<span className="blink">_</span>
          </div>
        </div>
      )}

      {ready && (
        <div className="pointer-events-none absolute inset-0 z-30 select-none">
          {/* Mode chip */}
          <div className="absolute top-6 left-6">
            <Micro>mode</Micro>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glow-text mt-1 text-2xl font-bold text-[#00ff66]"
              >
                {mode === "RAIN" ? "ASCII RAIN" : "ASCII BODY"}
              </motion.div>
            </AnimatePresence>
            <Micro className="mt-2">
              {personDetected ? "human detected" : "step into frame"}
              <span className={personDetected ? "" : "blink"}> ●</span>
            </Micro>
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 left-6 border border-[#00ff66]/25 bg-black/60 px-4 py-3 backdrop-blur-sm">
            <Micro className="mb-2">controls</Micro>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-3">
                <span>✋</span>
                <span className="w-28 uppercase tracking-wider text-[#00ff66]">open palm</span>
                <span className="uppercase tracking-wider text-[#00ff66]/45">
                  switch rain ↔ body
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>🧍</span>
                <span className="w-28 uppercase tracking-wider text-[#00ff66]">stand in frame</span>
                <span className="uppercase tracking-wider text-[#00ff66]/45">
                  {mode === "RAIN" ? "rain reacts to you" : "rain becomes you"}
                </span>
              </div>
            </div>
          </div>

          {/* Back */}
          <button
            type="button"
            onClick={onExit}
            className="pointer-events-auto absolute top-6 right-6 border border-[#00ff66]/30 bg-black/60 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-[#00ff66]/70 hover:text-[#00ff66] hover:border-[#00ff66]/60 cursor-pointer"
          >
            ← exit
          </button>
        </div>
      )}
    </div>
  );
}
