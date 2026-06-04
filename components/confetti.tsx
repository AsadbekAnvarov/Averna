"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight CSS confetti burst — no dependencies.
 * Render <Confetti /> conditionally (e.g. when a result is shown).
 */
export function Confetti({ count = 80 }: { count?: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; color: string; rot: number }[]>([]);

  useEffect(() => {
    const colors = ["#00ff94", "#00e5ff", "#b14eff", "#ff3dbb", "#ffd166"];
    setPieces(
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        color: colors[i % colors.length],
        rot: Math.random() * 360,
      }))
    );
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
          className="confetti-piece"
        />
      ))}
      <style>{`
        .confetti-piece {
          position: absolute;
          top: -10px;
          width: 8px;
          height: 14px;
          border-radius: 2px;
          opacity: 0.9;
          animation: confetti-fall 2.4s linear forwards;
        }
        @keyframes confetti-fall {
          0% { top: -10px; opacity: 1; }
          100% { top: 105%; opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
