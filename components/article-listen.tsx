"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Square } from "lucide-react";

/**
 * "Listen" button for the daily article — uses the browser's built-in speech
 * synthesis (no backend) so students can practise listening while they read.
 */
export function ArticleListen({ text, title }: { text: string; title: string }) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [supported, setSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) setSupported(false);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const play = () => {
    if (!("speechSynthesis" in window)) return;
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${title}. ${text}`);
    u.lang = "en-GB";
    u.rate = 0.95;
    u.onend = () => setState("idle");
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setState("playing");
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setState("idle");
  };

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      {state === "playing" ? (
        <button onClick={pause} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors">
          <Pause className="h-4 w-4" /> Pause
        </button>
      ) : (
        <button onClick={play} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors">
          <Volume2 className="h-4 w-4" /> {state === "paused" ? "Resume" : "Listen"}
        </button>
      )}
      {state !== "idle" && (
        <button onClick={stop} className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white transition-colors" title="Stop">
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
