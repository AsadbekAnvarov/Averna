"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Smile, Zap } from "lucide-react";

const EMOJIS = ["😀", "😂", "👍", "🙏", "🎉", "🔥", "❤️", "🤔", "👏", "⏰", "📚", "✅"];

const QUICK_STUDENT = [
  "Could you send the homework, please? 📩",
  "I've submitted my homework ✅",
  "Could you explain this again? 🤔",
  "I'll be a little late today ⏰",
  "Thank you so much! 🙏",
];

const QUICK_TEACHER = [
  "Why didn't you come to class today? 🤔",
  "Please don't forget your homework 📚",
  "Great work today! 👏",
  "Please submit your homework by tomorrow ⏰",
  "Please see me after class.",
];

export function MessageComposer({
  receiverId,
  role,
}: {
  receiverId: string;
  role: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [sending, setSending] = useState(false);

  const quick = role === "TEACHER" || role === "ADMIN" ? QUICK_TEACHER : QUICK_STUDENT;

  const send = async (content: string) => {
    const body = content.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId, content: body }),
      });
      setText("");
      setShowQuick(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      {/* Quick replies */}
      {showQuick && (
        <div className="flex flex-wrap gap-2 mb-2 animate-fade-in">
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-xs px-2 py-1 rounded-full bg-averna-cyan/10 border border-averna-cyan/30 text-averna-cyan hover:bg-averna-cyan/20"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {/* Emoji bar */}
      {showEmoji && (
        <div className="flex flex-wrap gap-1 mb-2 animate-fade-in">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setText((t) => t + e)} className="text-lg hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 items-center">
        <Button type="button" variant="ghost" size="icon" onClick={() => { setShowEmoji((s) => !s); setShowQuick(false); }} className="text-gray-300 shrink-0">
          <Smile className="h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => { setShowQuick((s) => !s); setShowEmoji(false); }} className="text-averna-cyan shrink-0" title="Quick replies">
          <Zap className="h-5 w-5" />
        </Button>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." autoComplete="off" className="bg-background/50" />
        <Button type="submit" disabled={sending} className="neon-button bg-averna-primary hover:bg-averna-light shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
