/**
 * Tiny dependency-free confetti burst. Call fireConfetti() from any client
 * component to celebrate a win (game perfect score, daily spin, level up).
 * Respects prefers-reduced-motion and cleans up after itself.
 */
export function fireConfetti(options?: { particles?: number; duration?: number }) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const count = options?.particles ?? 120;
  const duration = options?.duration ?? 2200;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = ["#00ff94", "#00e5ff", "#b14eff", "#ff3dbb", "#fbbf24"];
  const cx = canvas.width / 2;
  const parts = Array.from({ length: count }).map(() => ({
    x: cx + (Math.random() - 0.5) * 200,
    y: canvas.height * 0.35 + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -14 - 4,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  }));

  const start = performance.now();
  const gravity = 0.35;

  const tick = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (elapsed < duration) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}
