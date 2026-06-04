"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Clock, Volume2, RefreshCw, Play, Square, Users, Loader2, Search } from "lucide-react";
import { getTodayTopic } from "@/lib/speaking-topics";

const PART1 = [
  "Where are you from, and what do you like about your hometown?",
  "Do you work or are you a student?",
  "What do you usually do in your free time?",
  "Do you enjoy cooking? Why or why not?",
  "How often do you use public transport?",
  "What kind of music do you enjoy listening to?",
  "Do you prefer mornings or evenings? Why?",
  "Tell me about your favourite season of the year.",
];

const PART2 = [
  { topic: "Describe a skill you would like to learn.", points: ["what the skill is", "why you want to learn it", "how you would learn it", "and explain how it would help you"] },
  { topic: "Describe a memorable trip you have taken.", points: ["where you went", "who you went with", "what you did there", "and explain why it was memorable"] },
  { topic: "Describe a person who has influenced you.", points: ["who the person is", "how you know them", "what they are like", "and explain how they influenced you"] },
  { topic: "Describe a book or film you enjoyed.", points: ["what it was about", "when you read/watched it", "why you chose it", "and explain why you enjoyed it"] },
];

const PART3 = [
  "Why do you think people enjoy travelling?",
  "How has technology changed the way we communicate?",
  "Should education be free for everyone? Why?",
  "What are the advantages of learning a foreign language?",
  "Does social media have a more positive or negative effect on society?",
];

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
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [p3, setP3] = useState(0);

  // Speaking-time status (computed client-side to avoid hydration mismatch)
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
      const h = new Date().getHours();
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

  // Timer engine for Part 2
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
  const newCue = () => {
    stopPart2();
    setP2((i) => (i + 1) % PART2.length);
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
      // waiting: poll for a partner
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

        {/* Part 1 */}
        {tab === 1 && (
          <Card className="glass border-orange-500/30">
            <CardHeader><CardTitle className="text-orange-400">Part 1 · Interview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl text-white">{PART1[p1]}</p>
              <div className="flex gap-3">
                <Button onClick={() => speak(PART1[p1])} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Listen
                </Button>
                <Button onClick={() => setP1((i) => (i + 1) % PART1.length)} className="neon-button bg-orange-500 hover:bg-orange-600">
                  <RefreshCw className="mr-2 h-4 w-4" /> Next question
                </Button>
              </div>
              <p className="text-xs text-gray-500">Tip: answer in 2–3 sentences and add a reason or example.</p>
            </CardContent>
          </Card>
        )}

        {/* Part 2 - cue card with timer */}
        {tab === 2 && (
          <Card className="glass border-orange-500/30">
            <CardHeader><CardTitle className="text-orange-400">Part 2 · Cue Card (Long Turn)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-xl text-white font-medium mb-3">{PART2[p2].topic}</p>
                <p className="text-sm text-gray-400 mb-1">You should say:</p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                  {PART2[p2].points.map((pt) => <li key={pt}>{pt}</li>)}
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
                <Button onClick={() => speak(PART2[p2].topic)} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Listen
                </Button>
                <Button onClick={newCue} variant="outline" className="border-orange-500/40 text-orange-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> New cue card
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Part 3 */}
        {tab === 3 && (
          <Card className="glass border-orange-500/30">
            <CardHeader><CardTitle className="text-orange-400">Part 3 · Discussion</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl text-white">{PART3[p3]}</p>
              <div className="flex gap-3">
                <Button onClick={() => speak(PART3[p3])} variant="outline" className="border-averna-cyan text-averna-cyan">
                  <Volume2 className="mr-2 h-4 w-4" /> Listen
                </Button>
                <Button onClick={() => setP3((i) => (i + 1) % PART3.length)} className="neon-button bg-orange-500 hover:bg-orange-600">
                  <RefreshCw className="mr-2 h-4 w-4" /> Next question
                </Button>
              </div>
              <p className="text-xs text-gray-500">Tip: give your opinion, a reason, and consider the other side.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
