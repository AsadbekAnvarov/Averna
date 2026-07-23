"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clapperboard, Play, Pause, RotateCcw, Sparkles } from "lucide-react";
import type { MonthlyRecap } from "@/lib/student-intel";

const SLIDE_MS = 2600;

interface Slide {
  emoji: string;
  big: string;
  caption: string;
  from: string;
}

function buildSlides(r: MonthlyRecap): Slide[] {
  const slides: Slide[] = [];
  slides.push({ emoji: "🎬", big: r.monthLabel, caption: "Your month in review", from: "from-averna-purple/30" });
  if (r.activeDays > 0) slides.push({ emoji: "🔥", big: `${r.activeDays} days`, caption: "you showed up to learn", from: "from-orange-500/30" });
  if (r.tests > 0)
    slides.push({
      emoji: "📝",
      big: `${r.tests} tests`,
      caption: r.topModule ? `most love for ${r.topModule}` : "completed this month",
      from: "from-averna-cyan/30",
    });
  if (r.points > 0) slides.push({ emoji: "⚡", big: `${r.points.toLocaleString()} XP`, caption: "earned this month", from: "from-amber-500/30" });
  if (r.bandDelta != null && r.bandDelta !== 0)
    slides.push({
      emoji: r.bandDelta > 0 ? "📈" : "💪",
      big: `${r.bandDelta > 0 ? "+" : ""}${r.bandDelta.toFixed(1)} band`,
      caption: r.bandDelta > 0 ? "improvement — incredible" : "keep pushing, you've got this",
      from: "from-averna-neon/30",
    });
  else if (r.thisAvg != null)
    slides.push({ emoji: "🎯", big: `Band ${r.thisAvg.toFixed(1)}`, caption: "your average this month", from: "from-averna-neon/30" });
  if (r.achievements > 0)
    slides.push({ emoji: "🏆", big: `${r.achievements}`, caption: `achievement${r.achievements === 1 ? "" : "s"} unlocked`, from: "from-averna-pink/30" });
  slides.push({ emoji: "🚀", big: "Keep going", caption: "You're now significantly closer to your dream Band.", from: "from-averna-purple/30" });
  return slides;
}

/**
 * F10 — AI Recap. A cinematic, auto-playing "your month in review" story built
 * from real stats (no video rendering needed — an animated in-app recap the
 * student can screenshot & share). Tap to pause, arrows to move.
 */
export function MonthlyRecapView({ recap }: { recap: MonthlyRecap }) {
  const slides = buildSlides(recap);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const start = () => {
    setOpen(true);
    setI(0);
    setPlaying(true);
    stopTimer();
    timer.current = setInterval(() => {
      setI((c) => {
        if (c >= slides.length - 1) {
          stopTimer();
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, SLIDE_MS);
  };

  const togglePlay = () => {
    if (playing) {
      stopTimer();
      setPlaying(false);
    } else {
      if (i >= slides.length - 1) setI(0);
      setPlaying(true);
      stopTimer();
      timer.current = setInterval(() => {
        setI((c) => {
          if (c >= slides.length - 1) {
            stopTimer();
            setPlaying(false);
            return c;
          }
          return c + 1;
        });
      }, SLIDE_MS);
    }
  };

  if (!open) {
    return (
      <Card className="glass border-averna-purple/30 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-purple/10 blur-3xl" />
        <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
          <div>
            <p className="flex items-center gap-2 font-semibold text-white">
              <Clapperboard className="h-5 w-5 text-averna-purple" /> {recap.monthLabel} Recap
            </p>
            <p className="text-sm text-gray-400 mt-0.5">A cinematic look back at your month — press play.</p>
          </div>
          <button
            onClick={start}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg neon-button bg-averna-purple hover:bg-averna-purple/80 text-white px-5 py-2"
          >
            <Play className="h-4 w-4" /> Play recap
          </button>
        </CardContent>
      </Card>
    );
  }

  const slide = slides[i];
  return (
    <Card className={`glass border-averna-purple/40 relative overflow-hidden`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${slide.from} to-transparent transition-all duration-700`} />
      <CardContent className="relative py-0">
        {/* progress segments */}
        <div className="flex gap-1 pt-4">
          {slides.map((_, idx) => (
            <div key={idx} className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: idx < i ? "100%" : idx === i ? "100%" : "0%", transitionDuration: idx === i && playing ? `${SLIDE_MS}ms` : "200ms" }}
              />
            </div>
          ))}
        </div>

        {/* slide */}
        <button onClick={togglePlay} className="w-full text-center py-10 select-none" aria-label="Pause/Play">
          <div key={i} className="animate-fade-in">
            <div className="text-5xl mb-3">{slide.emoji}</div>
            <p className="text-3xl font-extrabold text-white">{slide.big}</p>
            <p className="text-sm text-gray-200 mt-2 max-w-xs mx-auto">{slide.caption}</p>
          </div>
        </button>

        {/* controls */}
        <div className="flex items-center justify-between pb-4 text-xs text-gray-400">
          <button onClick={togglePlay} className="inline-flex items-center gap-1 hover:text-white">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play"}
          </button>
          <span className="flex items-center gap-1 text-averna-purple">
            <Sparkles className="h-3.5 w-3.5" /> Screenshot to share
          </span>
          <button onClick={start} className="inline-flex items-center gap-1 hover:text-white">
            <RotateCcw className="h-4 w-4" /> Replay
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
