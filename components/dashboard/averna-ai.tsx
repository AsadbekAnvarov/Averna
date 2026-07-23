"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2 } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const QUICK = [
  "What should I study today?",
  "Why am I stuck?",
  "Which topics do I forget most?",
  "My fastest path to my goal",
];

/**
 * F1 — Averna AI. A platform-wide, context-aware companion that answers using
 * the student's real learning data (bands, weakest skill, streak, memory). It
 * opens with a proactive, personalised suggestion. GPT-4o with a data-grounded
 * rule-based fallback, so it always helps.
 */
export function AvernaAi({ greeting }: { greeting: string }) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/averna-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't reach my brain just now — try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-averna-neon/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-neon/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-neon">
          <Sparkles className="h-5 w-5" /> Averna AI
        </CardTitle>
        <p className="text-xs text-gray-400">Your personal mentor — it knows your whole learning journey</p>
      </CardHeader>
      <CardContent className="space-y-3 relative">
        <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] p-2.5 rounded-xl text-sm whitespace-pre-wrap break-words ${
                  m.role === "user" ? "bg-averna-primary text-white" : "bg-averna-neon/10 text-gray-200 border border-averna-neon/25"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-averna-neon/10 p-2.5 rounded-xl border border-averna-neon/25">
                <Loader2 className="h-4 w-4 animate-spin text-averna-neon" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 hover:border-averna-neon/40 hover:text-averna-neon transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask Averna AI anything about your learning…"
            disabled={loading}
            className="bg-background/50"
          />
          <Button onClick={() => ask(input)} disabled={loading || !input.trim()} aria-label="Send" className="neon-button bg-averna-neon hover:bg-averna-neon/80 text-black shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
