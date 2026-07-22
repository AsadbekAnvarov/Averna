"use client";

import { useEffect, useRef, useState } from "react";

type Season = "winter" | "spring" | "summer" | "autumn";

function seasonFor(month: number): Season {
  if (month === 11 || month <= 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "autumn";
}

const PALETTE: Record<Season, string[]> = {
  winter: ["#ffffff", "#dceeff", "#bfe0ff"],
  spring: ["#ffb7d5", "#ff8ec2", "#ffd0e6", "#f7a8ff"],
  summer: ["#ffe58a", "#b6ff7a", "#8ef0ff"],
  autumn: ["#ff9a3d", "#ffb547", "#e2652a", "#d98324"],
};

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  alpha: number;
  phase: number;
  sway: number;
}

/**
 * Beautiful, performant seasonal ambience rendered on a single full-screen
 * canvas: drifting snow (winter), tumbling cherry petals (spring), glowing
 * fireflies (summer) and falling leaves (autumn). Click-through, GPU-light,
 * respects reduced-motion, and honours the "averna_seasonal" comfort setting.
 */
export function SeasonalDecor() {
  const [on, setOn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const compute = () => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const pref = localStorage.getItem("averna_seasonal");
      setOn(!reduce && pref !== "0");
    };
    compute();
    window.addEventListener("averna-seasonal", compute);
    return () => window.removeEventListener("averna-seasonal", compute);
  }, []);

  useEffect(() => {
    if (!on) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const season = seasonFor(new Date().getMonth());
    const colors = PALETTE[season];
    let raf = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Particle count scales gently with screen area (kept modest for perf).
    const count = Math.max(24, Math.min(70, Math.round((W * H) / 34000)));
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const makeParticle = (initial: boolean): Particle => {
      const base: Particle = {
        x: rand(0, W),
        y: initial ? rand(0, H) : -20,
        r: rand(2, 6),
        vx: rand(-0.2, 0.2),
        vy: rand(0.3, 1),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.02, 0.02),
        color: pick(colors),
        alpha: rand(0.35, 0.85),
        phase: rand(0, Math.PI * 2),
        sway: rand(0.4, 1.2),
      };
      if (season === "winter") {
        base.r = rand(1.2, 3.6);
        base.vy = rand(0.4, 1.1);
      } else if (season === "spring") {
        base.r = rand(4, 8);
        base.vy = rand(0.5, 1.3);
        base.vr = rand(-0.05, 0.05);
      } else if (season === "autumn") {
        base.r = rand(5, 10);
        base.vy = rand(0.6, 1.5);
        base.vr = rand(-0.06, 0.06);
      } else if (season === "summer") {
        // fireflies float freely and glow
        base.x = rand(0, W);
        base.y = rand(0, H);
        base.r = rand(1.4, 2.8);
        base.vx = rand(-0.35, 0.35);
        base.vy = rand(-0.5, -0.1);
        base.alpha = rand(0.2, 0.7);
      }
      return base;
    };

    let particles: Particle[] = Array.from({ length: count }, () => makeParticle(true));

    const drawPetalOrLeaf = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const step = () => {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.phase += 0.02;

        if (season === "summer") {
          // gentle wandering + pulsing glow
          p.x += p.vx + Math.sin(p.phase) * 0.3;
          p.y += p.vy;
          const a = p.alpha * (0.55 + 0.45 * Math.sin(p.phase * 1.3));
          ctx.save();
          ctx.globalAlpha = Math.max(0, a);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (p.y < -20 || p.x < -20 || p.x > W + 20) {
            p.x = rand(0, W);
            p.y = H + 10;
          }
          continue;
        }

        // falling seasons: winter / spring / autumn
        p.x += p.vx + Math.sin(p.phase) * p.sway;
        p.y += p.vy;
        p.rot += p.vr;

        if (season === "winter") {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = "rgba(200,230,255,0.6)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          drawPetalOrLeaf(p);
        }

        if (p.y > H + 20) {
          Object.assign(p, makeParticle(false));
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [on]);

  if (!on) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5]"
    />
  );
}
