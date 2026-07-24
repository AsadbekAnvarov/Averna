"use client";

import { useEffect, useMemo, useState } from "react";

type DaypartKey = "morning" | "afternoon" | "evening" | "night";

/** Fergana shares Uzbekistan's single UTC+5 zone (IANA "Asia/Tashkent"). */
function ferganaHour(): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const h = parseInt(s, 10);
  return Number.isNaN(h) ? new Date().getHours() : h;
}

function daypartFor(h: number): DaypartKey {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

// A very subtle full-screen wash per part of the day. Afternoon stays clear
// (bright, no wash). Sits behind content so text stays perfectly crisp.
const TINT: Record<DaypartKey, string | null> = {
  morning: "radial-gradient(circle at 18% 0%, rgba(251,191,36,0.10), transparent 55%)",
  afternoon: null,
  evening: "radial-gradient(circle at 82% 100%, rgba(177,78,255,0.12), transparent 55%)",
  night: "radial-gradient(circle at 50% 15%, rgba(30,41,120,0.20), transparent 62%)",
};

/**
 * Dynamic Daily Experience (page-wide, F1). A calm, GPU-light atmosphere layer
 * that shifts with the time of day: warm at dawn, clear midday, soft purple in
 * the evening, and a quiet starfield at night. Pure CSS (no canvas / rAF),
 * click-through, sits behind the dashboard cards, honours reduced-motion and
 * the "averna_ambiance" comfort toggle, and re-checks the daypart on a slow
 * interval so evening -> night rolls over live WITHOUT refreshing page content.
 */
export function DaypartAmbiance() {
  const [on, setOn] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [key, setKey] = useState<DaypartKey>("night");

  useEffect(() => {
    const compute = () => {
      const r = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setReduce(r);
      setOn(localStorage.getItem("averna_ambiance") !== "0");
    };
    compute();
    window.addEventListener("averna-ambiance", compute);

    const sync = () => setKey(daypartFor(ferganaHour()));
    sync();
    const id = setInterval(sync, 60_000);

    return () => {
      window.removeEventListener("averna-ambiance", compute);
      clearInterval(id);
    };
  }, []);

  // Stable starfield, generated once on the client (no SSR hydration mismatch:
  // the component renders nothing until mounted).
  const stars = useMemo(
    () =>
      Array.from({ length: 32 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 1 + Math.random() * 1.6,
        delay: Math.random() * 4,
        dur: 3 + Math.random() * 3,
        base: 0.25 + Math.random() * 0.5,
      })),
    []
  );

  if (!on) return null;
  const tint = TINT[key];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[4] overflow-hidden">
      {tint && <div className="absolute inset-0 transition-opacity duration-1000" style={{ background: tint }} />}

      {key === "night" &&
        stars.map((s, i) => (
          <span
            key={i}
            className={reduce ? undefined : "averna-twinkle"}
            style={{
              position: "absolute",
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              borderRadius: "9999px",
              background: "rgba(226,232,255,0.9)",
              boxShadow: "0 0 4px rgba(190,210,255,0.7)",
              opacity: s.base,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
    </div>
  );
}
