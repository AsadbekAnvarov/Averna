"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Lightbulb, Send, Loader2, Sparkles, RefreshCw, GraduationCap } from "lucide-react";

const CONCEPTS = [
  "the difference between 'affect' and 'effect'",
  "when to use the present perfect tense",
  "how to structure an IELTS Task 2 essay",
  "what a topic sentence is and why it matters",
  "the difference between 'fewer' and 'less'",
  "how to paraphrase a question in Writing Task 1",
  "when to use articles (a / an / the)",
  "what cohesive devices are, with examples",
  "the difference between formal and informal English",
  "how to skim and scan in IELTS Reading",
];

const TAUGHT_KEY = "averna_explain_taught";

interface Turn { role: "user" | "assistant"; content: string }

/**
 * Explain-It-Back (Feynman Coach) — the student teaches a concept in their own
 * words; the AI coach points out the biggest gap, asks one curious follow-up,
 * and scores clarity /10. Teaching cements memory (the protégé effect) and
 * feels empowering. Reuses the existing /api/mentor/chat endpoint.
 */
export function ExplainCoach() {
  const [concept, setConcept] = useState(CONCEPTS[0]);
  const [custom, setCustom] = useState("");
  const [explanation, setExplanation] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [clarity, setClarity] = useState<number | null>(null);
  const [taught, setTaught] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setTaught(parseInt(localStorage.getItem(TAUGHT_KEY) || "0", 10) || 0); } catch { /* ignore */ }
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history, loading]);

  const activeConcept = custom.trim() || concept;

  const teach = async () => {
    const text = explanation.trim();
    if (!text || loading) return;
    setLoading(true);

    const framing =
      `Act as my learning coach for the Feynman technique. I'll explain a concept in my own words. ` +
      `Reply in 2-3 short sentences: (1) point out the single biggest gap or unclear part (or say it's clear), ` +
      `(2) ask ONE simple follow-up question a curious learner would ask, ` +
      `(3) finish with exactly "Clarity: X/10". Be warm and concise.\n\n` +
      `Concept: "${activeConcept}"\nMy explanation: "${text}"`;

    const userTurn: Turn = { role: "user", content: `📚 Explaining: ${activeConcept}\n\n${text}` };
    setHistory((h) => [...h, userTurn]);
    setExplanation("");

    try {
      const res = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: framing, history }),
      });
      const data = await res.json();
      const reply: string = data.response || "Let's try that again — explain it once more.";
      setHistory((h) => [...h, { role: "assistant", content: reply }]);

      const m = reply.match(/clarity[:\s]*([0-9]{1,2})\s*\/\s*10/i);
      if (m) {
        const score = Math.min(10, parseInt(m[1], 10));
        setClarity(score);
        if (score >= 7) {
          const next = taught + 1;
          setTaught(next);
          try { localStorage.setItem(TAUGHT_KEY, String(next)); } catch { /* ignore */ }
        }
      }
    } catch {
      setHistory((h) => [...h, { role: "assistant", content: "Sorry, I couldn't respond — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const newConcept = () => {
    const pool = CONCEPTS.filter((c) => c !== concept);
    setConcept(pool[Math.floor(Math.random() * pool.length)]);
    setCustom("");
    setExplanation("");
    setHistory([]);
    setClarity(null);
  };

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-purple">
          <span className="flex items-center gap-2"><Lightbulb className="h-5 w-5" /> Teach the Coach</span>
          {taught > 0 && (
            <span className="flex items-center gap-1 text-xs font-normal text-averna-neon">
              <GraduationCap className="h-3.5 w-3.5" /> {taught} taught
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Concept picker */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-averna-purple">Explain this concept</p>
            <button onClick={newConcept} className="text-[11px] text-averna-cyan hover:underline inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> New
            </button>
          </div>
          <p className="text-sm text-white">{custom.trim() ? custom : concept}</p>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="…or type your own concept to teach"
            className="w-full rounded-md bg-background/50 border border-input px-3 py-1.5 text-xs text-white placeholder:text-gray-500"
          />
        </div>

        {/* Conversation */}
        {history.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
            {history.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-2.5 rounded-lg text-sm whitespace-pre-wrap break-words ${
                  t.role === "user" ? "bg-averna-primary text-white" : "bg-averna-purple/15 text-gray-200 border border-averna-purple/30"
                }`}>
                  {t.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-averna-purple/15 p-2.5 rounded-lg border border-averna-purple/30">
                  <Loader2 className="h-4 w-4 animate-spin text-averna-purple" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Clarity meter */}
        {clarity != null && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Clarity</span><span className="text-averna-neon font-semibold">{clarity}/10</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon transition-all duration-500" style={{ width: `${clarity * 10}%` }} />
            </div>
          </div>
        )}

        {/* Input */}
        <div className="space-y-2">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            placeholder="Explain it simply, as if teaching a friend…"
            className="w-full rounded-md bg-background/50 border border-input px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-purple"
          />
          <div className="flex gap-2">
            <VoiceInputButton onText={(t) => setExplanation((p) => (p ? p + " " : "") + t.trim())} />
            <Button onClick={teach} disabled={loading || !explanation.trim()} className="neon-button bg-averna-purple hover:bg-averna-purple/80 flex-1">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking…</> : <><Send className="mr-2 h-4 w-4" /> Teach it</>}
            </Button>
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-averna-purple" /> Teaching a concept is one of the fastest ways to truly learn it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
