"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Clock, Volume2, RefreshCw, Play, Square, Users, Loader2, Search, Sparkles, Lightbulb } from "lucide-react";
import { getTodayTopic } from "@/lib/speaking-topics";
import { PART1_TOPICS, PART2_CARDS, PART3_QUESTIONS } from "@/lib/speaking-data";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function SpeakingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<1 | 2 | 3>(1);

  // Part 1: topic + question within topic + reveal
  const [p1Topic, setP1Topic] = useState(0);
  const [p1Q, setP1Q] = useState(0);
  const [p1Reveal, setP1Reveal] = useState(false);

  // Part 2: cue card + reveal
  const [p2, setP2] = useState(0);
  const [p2Reveal, setP2Reveal] = useState(false);

  // Part 3: discussion question + reveal
  const [p3, setP3] = useState(0);
  const [p3Reveal, setP3Reveal] = useState(false);

  // Speaking-time status (client-side to avoid hydration mismatch)
  const [timeText, setTimeText] = useState("");
  const [isLive, setIsLive] = useState(false);

  // Matchmaking
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayTopic = getTodayTopic();

  // Part 2 timer
  const [phase, setPhase] = useState<"idle" | "prep" | "speak" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const h = parseInt(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false }).format(new Date()),
        10
      ) % 24;
      const live = h >= 19 && h < 21;
      setIsLive(live);
      if (live) setTimeText("Speaking Time is LIVE now (19:00–21:00)!");
      else if (h < 19) setTimeText(`Speaking Time starts in ${19 - h} hour(s) — at 19:00`);
      else setTimeText("Speaking Time starts tomorrow at 19:00");
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === "prep" || phase === "speak") {
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            if (phase === "prep") {
              setPhase("speak");
              return 120;
            } else {
              setPhase("done");
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const startPart2 = () => {
    setPhase("prep");
    setSeconds(60);
  };
  const stopPart2 = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("idle");
    setSeconds(0);
  };

  const currentTopic = PART1_TOPICS[p1Topic];
  const currentP1Q = currentTopic.questions[p1Q % currentTopic.questions.length];
  const currentP2 = PART2_CARDS[p2];
  const currentP3 = PART3_QUESTIONS[p3];

  const pickTopic = (idx: number) => {
    setP1Topic(idx);
    setP1Q(0);
    setP1Reveal(false);
  };
  const nextP1 = () => {
    setP1Reveal(false);
    setP1Q((i) => (i + 1) % currentTopic.questions.length);
  };
  const newCue = () => {
    stopPart2();
    setP2Reveal(false);
    setP2((i) => (i + 1) % PART2_CARDS.length);
  };
  const nextP3 = () => {
    setP3Reveal(false);
    setP3((i) => (i + 1) % PART3_QUESTIONS.length);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  // ---- Matchmaking ----
  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };

  useEffect(() => () => stopPolling(), []);

  const findPartner = async () => {
    setMatchError("");
    setMatching(true);
    try {
      const res = await fetch("/api/speaking/match", { method: "POST" });
      const data = await res.json();
      if (data.roomId) {
        router.push(`/learning/speaking/room/${data.roomId}`);
        return;
      }
      if (data.error) { setMatchError(data.error); setMatching(false); return; }
      pollRef.current = setInterval(async () => {
        const r = await fetch("/api/speaking/match");
        const d = await r.json();
        if (d.roomId) {
          stopPolling();
          router.push(`/learning/speaking/room/${d.roomId}`);
        }
      }, 3000);
    } catch {
      setMatchError("Connection error");
      setMatching(false);
    }
  };

  const cancelMatch = async () => {
    stopPolling();
    await fetch("/api/speaking/match", { method: "DELETE" });
    setMatching(false);
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
          <Mic className="h-9 w-9 text-orange-400" />
          IELTS <span className="text-orange-400">Speaking</span>
        </h1>

        {/* Speaking Time status */}
        <Card className={`glass mb-6 ${isLive ? "border-averna-neon/50" : "border-orange-500/30"}`}>
          <CardHeader>
            <CardTitle className={isLive ? "text-averna-neon" : "text-orange-400"}>
              {isLive ? "🔴 Speaking Time is LIVE NOW!" : "🗣️ Speaking Time Schedule"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Clock className="h-5 w-5" />
              <span>{timeText}</span>
            </div>
            <p className="text-sm text-gray-400">
              Join the daily live sessions (19:00–21:00) to practise with teachers and other students.
              Meanwhile, warm up with the practice questions below 👇
            </p>
          </CardContent>
        </Card>

        {/* Find a partner (face-to-face speaking) */}
        <Card className="glass border-averna-pink/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-pink">
              <Users className="h-5 w-5" /> Face-to-Face Speaking
              {isLive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">LIVE</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-300">
              Get paired <strong>1-on-1</strong> with another Averna student and practise speaking
              live. Today&apos;s topic: <span className="text-averna-cyan font-semibold">{todayTopic.topic}</span>.
            </p>
            {!isLive && (
              <p className="text-xs text-yellow-300">
                ⏰ Official Speaking Time is 19:00–21:00 — but you can practise pairing any time.
              </p>
            )}

            {matching ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-averna-pink">
                  <Loader2 className="h-5 w-5 animate-spin" /> Looking for a partner…
                </span>
                <Button onClick={cancelMatch} variant="outline" size="sm" className="border-white/20">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={findPartner} className="neon-button bg-averna-pink hover:opacity-90 w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" /> Find a Partner
              </Button>
            )}
            {matchError && <p className="text-sm text-red-300">{matchError}</p>}

            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Today&apos;s discussion questions:</p>
              <ul className="text-sm text-gray-300 list-disc list-inside space-y-0.5">
                {todayTopic.questions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Part tabs */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <Button
              key={n}
              onClick={() => setTab(n as 1 | 2 | 3)}
              variant={tab === n ? "default" : "outline"}
              className={tab === n ? "neon-button bg-orange-500 hover:bg-orange-600" : "border-orange-500/40 text-orange-300"}
            >
              Part {n}
            </Button>
          ))}
        </div>

        {/* Part 1 — Topic chips + question with reveal */}
        {tab === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PART1_TOPICS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => pickTopic(i)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    i === p1Topic
                      ? "bg-orange-500/20 border-orange-400 text-orange-200"
                      : "border-white/10 text-gray-300 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <span className="mr-1">{t.emoji}</span>{t.name}
                </button>
              ))}
            </div>

            <Card className="glass border-orange-500/30">
              <CardHeader>
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  <span>{currentTopic.emoji}</span>
                  Part 1 · {currentTopic.name}
                  <span className="text-xs text-gray-500 font-normal ml-auto">
                    Q {p1Q + 1} / {currentTopic.questions.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl text-white leading-relaxed">{currentP1Q.q}</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => speak(currentP1Q.q)} variant="outline" className="border-averna-cyan text-averna-cyan">
                    <Volume2 className="mr-2 h-4 w-4" /> Listen
                  </Button>
                  <Button onClick={nextP1} className="neon-button bg-orange-500 hover:bg-orange-600">
                    <RefreshCw className="mr-2 h-4 w-4" /> Next question
                  </Button>
                  <Button
                    onClick={() => setP1Reveal((v) => !v)}
                    variant="outline"
                    className="border-averna-neon/40 text-averna-neon"
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> {p1Reveal ? "Hide" : "Show"} sample answer
                  </Button>
                </div>

                {p1Reveal && (
                  <div className="bg-white/5 border border-averna-neon/30 rounded-lg p-4 space-y-3 animate-in fade-in duration-200">
                    <div>
                      <p className="text-xs text-averna-neon uppercase tracking-wide mb-1">Band-7 sample</p>
                      <p className="text-gray-200 leading-relaxed">{currentP1Q.sample}</p>
                      <Button
                        onClick={() => speak(currentP1Q.sample)}
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-averna-cyan hover:text-averna-cyan h-8 px-2"
                      >
                        <Volume2 className="mr-2 h-3.5 w-3.5" /> Listen to sample
                      </Button>
                    </div>
                    {currentP1Q.phrases && currentP1Q.phrases.length > 0 && (
                      <div>
                        <p className="text-xs text-averna-pink uppercase tracking-wide mb-1">Useful phrases</p>
                        <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                          {currentP1Q.phrases.map((ph) => <li key={ph}>{ph}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500">Tip: answer in 2–3 sentences and add a reason or example.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Part 2 — Cue card with timer and model answer reveal */}
        {tab === 2 && (
          <Card className="glass border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-orange-400 flex items-center justify-between">
                <span>Part 2 · Cue Card (Long Turn)</span>
                <span className="text-xs text-gray-500 font-normal">
                  Card {p2 + 1} / {PART2_CARDS.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-xl text-white font-medium mb-3">{currentP2.topic}</p>
                <p className="text-sm text-gray-400 mb-1">You should say:</p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                  {currentP2.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>

              {phase !== "idle" && (
                <div className="text-center">
                  <p className={`text-sm ${phase === "prep" ? "text-averna-cyan" : phase === "speak" ? "text-averna-neon" : "text-gray-400"}`}>
                    {phase === "prep" ? "⏳ Preparation time" : phase === "speak" ? "🎙️ Speaking time" : "✓ Done — great job!"}
                  </p>
                  {phase !== "done" && <p className="text-5xl font-bold text-white mt-1">{mm}:{ss}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {phase === "idle" || phase === "done" ? (
                  <Button onClick={startPart2} className="neon-button bg-averna-primary hover:bg-averna-light">
                    <Play className="mr-2 h-4 w-4" /> Start (1 min prep + 2 min talk)
                  </Button>
                ) : (
                  <Button onClick={stopPart2} variant="outline" className="border-red-500/50 text-red-300">
                    <Square className="mr-2 h-4 w-4" /> Stop
                  </Button>
                )}
                <Button onClick={() => speak(currentP2.topic)} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Listen
                </Button>
                <Button onClick={newCue} variant="outline" className="border-orange-500/40 text-orange-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> New cue card
                </Button>
                <Button
                  onClick={() => setP2Reveal((v) => !v)}
                  variant="outline"
                  className="border-averna-neon/40 text-averna-neon"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> {p2Reveal ? "Hide" : "Show"} model answer
                </Button>
              </div>

              {p2Reveal && (
                <div className="bg-white/5 border border-averna-neon/30 rounded-lg p-4 space-y-4 animate-in fade-in duration-200">
                  <div>
                    <p className="text-xs text-averna-neon uppercase tracking-wide mb-1">Band-7 sample</p>
                    <p className="text-gray-200 leading-relaxed whitespace-pre-line">{currentP2.sample}</p>
                    <Button
                      onClick={() => speak(currentP2.sample)}
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-averna-cyan hover:text-averna-cyan h-8 px-2"
                    >
                      <Volume2 className="mr-2 h-3.5 w-3.5" /> Listen to sample
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-averna-pink uppercase tracking-wide mb-1">Useful phrases</p>
                    <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                      {currentP2.usefulPhrases.map((ph) => <li key={ph}>{ph}</li>)}
                    </ul>
                  </div>
                  <div className="flex items-start gap-2 bg-averna-primary/10 border border-averna-primary/30 rounded-lg p-3">
                    <Lightbulb className="h-4 w-4 text-yellow-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <span className="text-yellow-300 font-semibold">Maslahat: </span>
                      {currentP2.tipUz}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Part 3 — Discussion with theme badge and band-8 reveal */}
        {tab === 3 && (
          <Card className="glass border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-orange-400 flex items-center justify-between">
                <span>Part 3 · Discussion</span>
                <span className="text-xs text-gray-500 font-normal">
                  Q {p3 + 1} / {PART3_QUESTIONS.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 mb-3">
                  Theme · {currentP3.theme}
                </span>
                <p className="text-2xl text-white leading-relaxed">{currentP3.question}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => speak(currentP3.question)} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Listen
                </Button>
                <Button onClick={nextP3} className="neon-button bg-orange-500 hover:bg-orange-600">
                  <RefreshCw className="mr-2 h-4 w-4" /> Next question
                </Button>
                <Button
                  onClick={() => setP3Reveal((v) => !v)}
                  variant="outline"
                  className="border-averna-neon/40 text-averna-neon"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> {p3Reveal ? "Hide" : "Show"} model answer
                </Button>
              </div>

              {p3Reveal && (
                <div className="bg-white/5 border border-averna-neon/30 rounded-lg p-4 space-y-4 animate-in fade-in duration-200">
                  <div>
                    <p className="text-xs text-averna-neon uppercase tracking-wide mb-1">Band-8 sample</p>
                    <p className="text-gray-200 leading-relaxed whitespace-pre-line">{currentP3.sample}</p>
                    <Button
                      onClick={() => speak(currentP3.sample)}
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-averna-cyan hover:text-averna-cyan h-8 px-2"
                    >
                      <Volume2 className="mr-2 h-3.5 w-3.5" /> Listen to sample
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-averna-pink uppercase tracking-wide mb-1">Useful phrases</p>
                    <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                      {currentP3.usefulPhrases.map((ph) => <li key={ph}>{ph}</li>)}
                    </ul>
                  </div>
                  <div className="flex items-start gap-2 bg-averna-primary/10 border border-averna-primary/30 rounded-lg p-3">
                    <Lightbulb className="h-4 w-4 text-yellow-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <span className="text-yellow-300 font-semibold">Maslahat: </span>
                      {currentP3.tipUz}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">Tip: give your opinion, a reason, and consider the other side.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
