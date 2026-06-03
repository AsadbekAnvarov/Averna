"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, RotateCcw, ChevronRight, Sparkles, Circle, Square } from "lucide-react";

const PHRASES = [
  "The quick brown fox jumps over the lazy dog.",
  "I would like to improve my pronunciation.",
  "She sells seashells by the seashore.",
  "Education is the most powerful weapon.",
  "Practice makes perfect, so keep going.",
  "Could you please repeat that more slowly?",
  "Technology is changing the way we learn.",
  "Confidence comes from consistent practice.",
];

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreMatch(target: string, said: string): number {
  const t = normalize(target);
  const s = new Set(normalize(said));
  if (t.length === 0) return 0;
  const matched = t.filter((w) => s.has(w)).length;
  return Math.round((matched / t.length) * 100);
}

export default function PronunciationPage() {
  const [index, setIndex] = useState(0);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Audio recording (MediaRecorder)
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recSupported, setRecSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const phrase = PHRASES[index];

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || typeof window.MediaRecorder === "undefined") {
      setRecSupported(false);
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setRecSupported(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      setHeard(transcript);
      setScore(scoreMatch(phrase, transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(phrase);
    u.lang = "en-GB";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setHeard("");
    setScore(null);
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      setListening(false);
    }
  };

  const next = () => {
    setIndex((i) => (i + 1) % PHRASES.length);
    setHeard("");
    setScore(null);
    setAudioUrl(null);
  };

  const feedback =
    score === null
      ? ""
      : score >= 85
      ? "Excellent! Crystal clear 🌟"
      : score >= 60
      ? "Good — keep refining the tricky words 💪"
      : "Keep practising — listen again and slow down 🎯";

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Mic className="h-9 w-9 text-averna-pink" />
          Pronunciation <span className="neon-text-purple">Coach</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Listen to the phrase, then speak it. Your browser scores how clearly you said it. 🎤
        </p>

        {!supported && (
          <Card className="glass border-yellow-500/40 mb-6">
            <CardContent className="py-4 text-yellow-300 text-sm">
              Speech recognition isn&apos;t supported in this browser. For the full
              experience, open the site in <strong>Google Chrome</strong>. You can still
              listen to the phrases below.
            </CardContent>
          </Card>
        )}

        <Card className="glass border-averna-purple/30">
          <CardHeader>
            <CardTitle className="text-averna-purple flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Say this phrase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-2xl text-white font-medium leading-relaxed">&ldquo;{phrase}&rdquo;</p>

            <div className="flex flex-wrap gap-3">
              <Button onClick={speak} variant="outline" className="border-averna-cyan text-averna-cyan">
                <Volume2 className="mr-2 h-4 w-4" /> Listen
              </Button>
              <Button
                onClick={startListening}
                disabled={!supported || listening}
                className="neon-button bg-averna-pink hover:opacity-90 disabled:opacity-50"
              >
                <Mic className="mr-2 h-4 w-4" />
                {listening ? "Listening…" : "Speak"}
              </Button>
              <Button onClick={next} variant="outline" className="border-white/20">
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {listening && (
              <p className="text-averna-pink animate-pulse text-sm">🎙️ Listening… say the phrase now</p>
            )}

            {heard && (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-xs text-gray-400 mb-1">We heard:</p>
                  <p className="text-gray-200">&ldquo;{heard}&rdquo;</p>
                </div>
                {score !== null && (
                  <div className="text-center">
                    <div className="text-5xl font-bold text-averna-neon mb-1">{score}%</div>
                    <p className="text-gray-300">{feedback}</p>
                    <Button
                      onClick={startListening}
                      variant="ghost"
                      className="mt-2 text-averna-cyan"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Try again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Record yourself */}
        <Card className="glass border-averna-pink/30 mt-6">
          <CardHeader>
            <CardTitle className="text-averna-pink flex items-center gap-2">
              <Circle className="h-5 w-5" /> Record &amp; Self-Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-400">
              Record your voice and play it back to hear yourself — a great way to spot
              pronunciation mistakes.
            </p>
            {!recSupported ? (
              <p className="text-yellow-300 text-sm">
                Audio recording isn&apos;t supported in this browser. Try Chrome on desktop or Android.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {!recording ? (
                  <Button onClick={startRecording} className="neon-button bg-averna-pink hover:opacity-90">
                    <Circle className="mr-2 h-4 w-4 fill-current" /> Start Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="outline" className="border-red-500/60 text-red-300 animate-pulse">
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                )}
                {recording && <span className="text-red-300 text-sm animate-pulse">● Recording…</span>}
              </div>
            )}
            {audioUrl && (
              <div className="animate-fade-in">
                <p className="text-xs text-gray-400 mb-1">Your recording:</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Tip: speak clearly at a natural pace. The score reflects how many words were recognised.
        </p>
      </div>
    </div>
  );
}
