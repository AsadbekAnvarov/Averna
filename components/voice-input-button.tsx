"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

/**
 * Dictation button using the Web Speech API. Calls onText with recognised
 * speech (appends). Gracefully hides itself if the browser has no support.
 */
export function VoiceInputButton({
  onText,
  className = "",
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      if (text) onText(text.trim() + " ");
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
    } else {
      try {
        recRef.current?.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : "Dictate with your voice"}
      className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors ${
        listening
          ? "border-red-500/60 text-red-300 bg-red-500/10 animate-pulse"
          : "border-averna-cyan/40 text-averna-cyan hover:bg-averna-cyan/10"
      } ${className}`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
