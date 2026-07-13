import { useEffect, useRef } from "react";

// ASCII black hole: glyph particles (#$%^&* etc.) orbit and spiral into a
// central event horizon. Pure canvas 2D — each particle lives in polar
// coordinates (radius shrinks, angle advances faster as it falls in),
// stretching and dimming as it crosses the accretion ring, then respawning
// at the rim. Runs behind the landing hero.
const GLYPHS = "#$%^&*<>?!@()[]{}+=~;:.".split("");

export default function BlackholeCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let alive = true;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const N = 220;
    const particles = Array.from({ length: N }, () => spawn(true));

    function spawn(anywhere = false) {
      const maxR = Math.hypot(canvas.width, canvas.height) * 0.55;
      return {
        r: anywhere ? 80 + Math.random() * maxR : maxR * (0.75 + Math.random() * 0.25),
        a: Math.random() * Math.PI * 2,
        glyph: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        size: 10 + Math.random() * 14,
        spin: 0.0018 + Math.random() * 0.004,
        fall: 0.9985 - Math.random() * 0.002,
        hue: Math.random() < 0.75 ? "white" : Math.random() < 0.5 ? "cyan" : "violet",
      };
    }

    const COLORS = {
      white: (a) => `rgba(232, 255, 232, ${a})`,
      cyan: (a) => `rgba(0, 255, 255, ${a})`,
      violet: (a) => `rgba(124, 92, 255, ${a})`,
    };

    function frame() {
      if (!alive) return;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.44;
      const horizon = Math.min(w, h) * 0.11;

      // Motion-blur trail: translucent clear instead of full clear
      ctx.fillStyle = "rgba(3, 3, 4, 0.28)";
      ctx.fillRect(0, 0, w, h);

      // Accretion glow ring
      const ringR = horizon * 1.5;
      const grad = ctx.createRadialGradient(cx, cy, horizon * 0.9, cx, cy, ringR * 2.2);
      grad.addColorStop(0, "rgba(124, 92, 255, 0.28)");
      grad.addColorStop(0.35, "rgba(0, 255, 255, 0.10)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // Spiral: angular speed and inward pull both grow near the center,
        // but capped — otherwise particles spend their whole life bunched
        // at the rim and the outer field goes empty.
        const pull = Math.min(2.2, 1 + (120 / (p.r + 60)) * 1.6);
        p.a += p.spin * pull;
        p.r *= p.fall;

        if (p.r < horizon * 0.9) {
          particles[i] = spawn();
          continue;
        }

        const x = cx + Math.cos(p.a) * p.r;
        const y = cy + Math.sin(p.a) * p.r * 0.62; // squash = disc perspective
        const nearness = Math.max(0, Math.min(1, 1 - (p.r - horizon) / (horizon * 4)));
        const alpha = 0.25 + nearness * 0.75;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.a + Math.PI / 2);
        ctx.font = `${p.size * (1 + nearness * 0.6)}px ui-monospace, monospace`;
        ctx.fillStyle = COLORS[p.hue](alpha);
        if (nearness > 0.55) {
          ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
          ctx.shadowBlur = 14;
        }
        ctx.fillText(p.glyph, 0, 0);
        ctx.restore();
      }

      // Event horizon: pure black disc + thin photon ring
      ctx.beginPath();
      ctx.arc(cx, cy, horizon, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, horizon * 1.06, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 255, 255, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "rgba(0, 255, 255, 0.9)";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
