"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Clapperboard, Send, Loader2, ArrowLeft, Lightbulb } from "lucide-react";

interface Scenario {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  opener: string;
}

// Display metadata (ids must match ROLEPLAY_SCENARIOS in lib/ai.ts).
const SCENARIOS: Scenario[] = [
  { id: "airport", title: "Airport Check-In", emoji: "✈️", desc: "Check in for a flight and choose a seat.", opener: "Good morning! Welcome to Averna Airlines. May I see your passport and ticket, please?" },
  { id: "interview", title: "Job Interview", emoji: "💼", desc: "Impress the interviewer for your dream job.", opener: "Thanks for coming in today. So, to start — could you tell me a little about yourself?" },
  { id: "restaurant", title: "At a Restaurant", emoji: "🍽️", desc: "Order a meal and chat with the waiter.", opener: "Good evening, welcome! Here's your menu. Can I get you something to drink to start?" },
  { id: "hotel", title: "Hotel Check-In", emoji: "🏨", desc: "Check into your hotel room.", opener: "Welcome to the Grand Averna Hotel! Do you have a reservation with us?" },
  { id: "doctor", title: "Doctor's Visit", emoji: "🩺", desc: "Describe symptoms and get advice.", opener: "Hello, please have a seat. So, what seems to be the problem today?" },
  { id: "shopping", title: "Clothes Shopping", emoji: "🛍️", desc: "Find the right outfit with the assistant.", opener: "Hi there! Let me know if you need any help. Are you looking for anything in particular?" },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  tip?: string | null;
}

function splitTip(text: string): { main: string; tip: string | null } {
  const idx = text.search(/\n\s*TIP:/i);
  if (idx === -1) return { main: text.trim(), tip: null };
  const main = text.slice(0, idx).trim();
  const tip = text.slice(idx).replace(/\n?\s*TIP:/i, "").trim();
  return { main, tip: tip || null };
}

/**
 * AI Roleplay Scenarios — immersive speaking practice where the AI stays in
 * character (check-in agent, interviewer, waiter…) and keeps a real English
 * conversation going, dropping the occasional gentle correction. Dictate with
 * your voice or type. Powered by GPT-4o with a graceful offline fallback.
 */
export function Roleplay() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const startScenario = (s: Scenario) => {
    setScenario(s);
    setMessages([{ role: "assistant", content: s.opener }]);
    setInput("");
  };

  const leave = () => {
    setScenario(null);
    setMessages([]);
    setInput("");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !scenario) return;
    const userMsg: Msg = { role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/learning/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const { main, tip } = splitTip(data.reply || "Sorry, could you repeat that?");
      setMessages((m) => [...m, { role: "assistant", content: main, tip }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I didn't catch that — could you try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-averna-pink/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-pink">
          <span className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5" /> Roleplay
          </span>
          {scenario && (
            <button onClick={leave} className="text-[11px] text-averna-cyan hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Scenarios
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scenario ? (
          <>
            <p className="text-sm text-gray-400">
              Practise real conversations. The AI stays in character and gently corrects you along the way.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => startScenario(s)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-averna-pink/10 hover:border-averna-pink/30 px-3 py-2.5 text-left transition-colors"
                >
                  <span className="text-2xl shrink-0">{s.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{s.title}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{s.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="text-xl">{scenario.emoji}</span>
              <span className="font-semibold">{scenario.title}</span>
            </div>

            {/* Conversation */}
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    <div
                      className={`p-2.5 rounded-lg text-sm whitespace-pre-wrap break-words ${
                        m.role === "user"
                          ? "bg-averna-primary text-white"
                          : "bg-averna-pink/15 text-gray-200 border border-averna-pink/30"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.tip && (
                      <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-300">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {m.tip}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-averna-pink/15 p-2.5 rounded-lg border border-averna-pink/30">
                    <Loader2 className="h-4 w-4 animate-spin text-averna-pink" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Say your line…"
                disabled={loading}
                className="bg-background/50"
              />
              <VoiceInputButton onText={(t) => setInput((prev) => (prev ? prev + " " : "") + t.trim())} />
              <Button onClick={send} disabled={loading || !input.trim()} aria-label="Send" className="neon-button bg-averna-pink hover:bg-averna-pink/80 shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
