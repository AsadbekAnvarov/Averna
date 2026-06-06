"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, X, TrendingUp, Timer, MessagesSquare, PenTool, Users, Layers, ArrowRight } from "lucide-react";

const VERSION_KEY = "averna_whatsnew_v1";

const FEATURES = [
  { icon: TrendingUp, label: "My Progress", desc: "See your band trend & weakest skill", href: "/progress", color: "text-averna-neon", bg: "bg-averna-neon/10 border-averna-neon/30" },
  { icon: Timer, label: "Focus Mode", desc: "Pomodoro timer with calm ambient sound", href: "/focus", color: "text-averna-cyan", bg: "bg-averna-cyan/10 border-averna-cyan/30" },
  { icon: MessagesSquare, label: "Speaking Roleplay", desc: "Real-life conversations with an AI partner", href: "/learning/roleplay", color: "text-averna-purple", bg: "bg-averna-purple/10 border-averna-purple/30" },
  { icon: PenTool, label: "Writing Lab", desc: "Live coach with instant essay suggestions", href: "/learning/writing-lab", color: "text-averna-pink", bg: "bg-averna-pink/10 border-averna-pink/30" },
  { icon: Layers, label: "Smart Flashcards", desc: "Spaced-repetition Daily Review", href: "/flashcards", color: "text-averna-purple", bg: "bg-averna-purple/10 border-averna-purple/30" },
  { icon: Users, label: "Peer Review", desc: "Review classmates & earn XP", href: "/peer-review", color: "text-averna-pink", bg: "bg-averna-pink/10 border-averna-pink/30" },
];

export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(VERSION_KEY) !== "1") {
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(VERSION_KEY, "1");
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-lg rounded-2xl glass-strong border border-averna-cyan/40 shadow-[0_0_40px_rgba(34,211,238,0.25)] p-5 sm:p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <button onClick={close} className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-averna-cyan via-averna-neon to-averna-purple flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">What&apos;s New on Averna</h2>
            <p className="text-sm text-gray-400">Fresh tools to help you improve faster ✨</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.label}
                href={f.href}
                onClick={close}
                className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-averna-cyan/40 transition-all"
              >
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${f.bg}`}>
                  <Icon className={`h-4 w-4 ${f.color}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${f.color}`}>{f.label}</p>
                  <p className="text-xs text-gray-400 truncate">{f.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>

        <button
          onClick={close}
          className="mt-5 w-full py-2.5 rounded-xl neon-button bg-averna-primary hover:bg-averna-light font-semibold text-sm"
        >
          Let&apos;s go! 🚀
        </button>
      </div>
    </div>
  );
}
