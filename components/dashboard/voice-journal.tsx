"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, Flame, TrendingUp, Sparkles, RotateCcw } from "lucide-react";
import { scoreSpeaking, type SpeakingScore } from "@/lib/utils";

const STORAGE_KEY = "averna_voice_journal_v1";

const PROMPTS = [
  "Describe your day so far.",
  "What's one thing you learned recently?",
  "Talk about a goal you're working toward.",
  "Describe your favourite place and why you like it.",
  "What did you do last weekend?",
  "Talk about a person who inspires you.",
  "Describe a skill you'd like to master.",
  "What makes a good friend?",
  "Talk about your plans for the future.",
  "Describe a memorable meal you've had.",
  "What's your opinion on social media?",
  "Talk about a book, film or show you enjoyed.",
];

interface Entry {
  date: string; // YYYY-MM-DD (local)
  overall: number;
  wordCount: number;
  seconds: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/** Consecutive days (ending today) that have an entry. */
function computeStreak(entries: Entry[]): number {
  const set = new Set(entries.map((e) => e.date));
  let streak = 0;
  const d = new Date();
  // Allow the streak to hold if today isn't done yet but yesterday was.
  if (!set.has(todayKey())) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (set.has(key)) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

/**
 * Voice Journal — a 60-second daily spoken diary. The browser transcribes it
 * (Web Speech API, with a typed fallback), a heuristic scores fluency, and the
 * platform charts the student's fluency trajectory over time. A calm daily
 * ritual that quietly builds speaking confidence. Fully client-side (localStorage).
 */
export function VoiceJournal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<SpeakingScore | null>(null);
  const [supported, setSupported] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const recRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const prompt = PROMPTS[dayIndex() % PROMPTS.length];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSupported(!!SR);
    setLoaded(true);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try { recRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, []);

  const doneToday = entries.some((e) => e.date === todayKey());
  const streak = computeStreak(entries);
  const recent = entries.slice(-14);
  const trendAvg = recent.length ? recent.reduce((s, e) => s + e.overall, 0) / recent.length : 0;

  const persist = (list: Entry[]) => {
    setEntries(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const start = () => {
    setResult(null);
    setTranscript("");
    setSeconds(0);
    startedAt.current = Date.now();
    setRecording(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e: any) => {
          let full = "";
          for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + " ";
          setTranscript(full.trim());
        };
        rec.onerror = () => {};
        recRef.current = rec;
        rec.start();
      } catch {
        /* fall back to typed input */
      }
    }
  };

  const stop = () => {
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try { recRef.current?.stop?.(); } catch { /* ignore */ }
    const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const text = transcript.trim();
    if (!text) return; // nothing captured/typed
    const score = scoreSpeaking(text, secs);
    setResult(score);
    const entry: Entry = { date: todayKey(), overall: score.overall, wordCount: score.wordCount, seconds: secs };
    // one entry per day (latest wins)
    persist([...entries.filter((e) => e.date !== todayKey()), entry]);
  };

  const reset = () => {
    setResult(null);
    setTranscript("");
    setSeconds(0);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <Card className="glass border-averna-pink/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-pink">
          <span className="flex items-center gap-2"><Mic className="h-5 w-5" /> Voice Journal</span>
          {loaded && entries.length > 0 && (
            <span className="flex items-center gap-3 text-xs font-normal">
              <span className="flex items-center gap-1 text-orange-400"><Flame className="h-3.5 w-3.5" /> {streak}d</span>
              <span className="flex items-center gap-1 text-averna-neon"><TrendingUp className="h-3.5 w-3.5" /> {trendAvg.toFixed(1)}</span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
          <p className="text-[11px] uppercase tracking-wider text-averna-pink mb-1">Today&apos;s prompt</p>
          <p className="text-sm text-white">{prompt}</p>
        </div>

        {/* Recorder */}
        {recording ? (
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-averna-pink/20 text-averna-pink animate-pulse">
              <Mic className="h-7 w-7" />
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{mm}:{ss}</p>
            {supported ? (
              <p className="text-xs text-gray-400 min-h-[2.5rem] line-clamp-2 px-2">{transcript || "Listening… speak naturally."}</p>
            ) : (
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={2}
                placeholder="Your browser can't transcribe speech — type what you'd say instead."
                className="w-full rounded-md bg-background/50 border border-input px-3 py-2 text-sm text-white"
              />
            )}
            <Button onClick={stop} className="neon-button bg-red-500/80 hover:bg-red-500">
              <Square className="mr-2 h-4 w-4" /> Stop & score
            </Button>
          </div>
        ) : result ? (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Overall", value: result.overall },
                { label: "Fluency", value: result.fluency },
                { label: "Vocab", value: result.vocabulary },
                { label: "Grammar", value: result.grammar },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-white/5 border border-white/10 py-2">
                  <p className="text-lg font-bold text-averna-neon">{m.value.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">{m.label}</p>
                </div>
              ))}
            </div>
            {result.feedback[0] && (
              <p className="text-xs text-gray-300 flex items-start gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-averna-pink shrink-0 mt-0.5" /> {result.feedback[0]}
              </p>
            )}
            <Button onClick={reset} variant="outline" className="w-full border-white/20">
              <RotateCcw className="mr-2 h-4 w-4" /> Record again
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-2">
            {doneToday && <p className="text-xs text-averna-neon">✓ You&apos;ve journaled today — nice! Come back tomorrow.</p>}
            <Button onClick={start} className="neon-button bg-averna-pink hover:opacity-90">
              <Mic className="mr-2 h-4 w-4" /> {doneToday ? "Record another" : "Start speaking"}
            </Button>
            <p className="text-[11px] text-gray-500">Speak for ~60 seconds. Your fluency is tracked over time.</p>
          </div>
        )}

        {/* Fluency trend */}
        {loaded && recent.length >= 2 && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-[11px] text-gray-400 mb-2">Fluency trend (last {recent.length})</p>
            <div className="flex items-end gap-1 h-12">
              {recent.map((e, i) => (
                <div
                  key={i}
                  title={`${e.date}: ${e.overall.toFixed(1)}`}
                  className="flex-1 rounded-t bg-gradient-to-t from-averna-pink/40 to-averna-pink"
                  style={{ height: `${Math.max(8, (e.overall / 9) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
