"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Send, Loader2, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** Starter questions — the ones an owner actually asks. */
const SUGGESTIONS = [
  "Bu oy foyda qancha va nega oʻzgardi?",
  "Qaysi xarajatlar oshdi?",
  "Maoshlarga qancha toʻlash kerak?",
  "Qarzdor oʻquvchilar qancha?",
  "Daromadni qanday oshirsam boʻladi?",
];

/**
 * M14 — AI Business Assistant. Asks /api/admin/business-ai, which answers only
 * from the centre's real figures (revenue, expenses, profit, payroll, students,
 * attendance, health) and admits gaps instead of guessing. Uzbek admin UI, same
 * card language as the rest of the panel.
 */
export function BusinessAi() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/business-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: messages.slice(-6) }),
      });
      const data = await res.json().catch(() => null);
      const reply =
        data?.reply ??
        data?.error ??
        "Javob olib boʻlmadi. Birozdan soʻng yana urinib koʻring.";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Tarmoq xatosi — birozdan soʻng yana urinib koʻring." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  };

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <BrainCircuit className="h-5 w-5" /> AI Biznes Yordamchisi
        </CardTitle>
        <p className="text-xs text-gray-400">
          Markazning haqiqiy raqamlari asosida javob beradi — taxmin qilmaydi
        </p>
      </CardHeader>
      <CardContent className="relative">
        {/* Conversation */}
        {messages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 text-sm ${
                  m.role === "user"
                    ? "bg-averna-purple/10 border border-averna-purple/25 text-white ml-6"
                    : "bg-white/5 border border-white/10 text-gray-200 mr-6"
                }`}
              >
                {m.role === "assistant" && (
                  <p className="text-[10px] uppercase tracking-wider text-averna-purple mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI tahlili
                  </p>
                )}
                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 mr-6">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Raqamlar tahlil qilinmoqda…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-averna-purple/40 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Biznes haqida savol bering…"
            disabled={loading}
            className="flex-1 rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-purple disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-lg border border-averna-purple/40 bg-averna-purple/15 text-averna-purple flex items-center justify-center hover:bg-averna-purple/25 transition-colors disabled:opacity-50"
            title="Yuborish"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
