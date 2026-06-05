"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, SmilePlus } from "lucide-react";

export interface ThreadMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
  reaction: string | null;
}

const REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥"];

export function MessageThread({
  messages,
  meId,
}: {
  messages: ThreadMessage[];
  meId: string;
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);

  const react = async (messageId: string, emoji: string) => {
    setOpenFor(null);
    await fetch("/api/messages/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    });
    router.refresh();
  };

  if (messages.length === 0) {
    return <p className="text-sm text-gray-400 text-center mt-8">No messages yet. Say hello! 👋</p>;
  }

  return (
    <>
      {messages.map((m) => {
        const mine = m.senderId === meId;
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
            <div className="relative max-w-[78%]">
              <div
                className={`px-3 py-2 rounded-2xl text-sm ${
                  mine
                    ? "chat-out bg-averna-primary text-white rounded-br-sm"
                    : "bg-white/10 text-gray-200 rounded-bl-sm"
                }`}
              >
                {m.content}
                <div className="flex items-center gap-1 text-[10px] opacity-60 mt-0.5 justify-end">
                  {new Date(m.createdAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false })}
                  {mine && (m.read ? <CheckCheck className="h-3 w-3 text-averna-cyan" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>

              {/* Reaction bubble */}
              {m.reaction && (
                <span className={`absolute -bottom-2 ${mine ? "left-1" : "right-1"} text-sm bg-averna-dark/80 border border-white/10 rounded-full px-1`}>
                  {m.reaction}
                </span>
              )}

              {/* React button (appears on hover) */}
              <button
                onClick={() => setOpenFor(openFor === m.id ? null : m.id)}
                className={`absolute top-1/2 -translate-y-1/2 ${mine ? "-left-7" : "-right-7"} opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-averna-pink`}
                aria-label="React"
              >
                <SmilePlus className="h-4 w-4" />
              </button>

              {openFor === m.id && (
                <div className={`absolute z-20 -top-9 ${mine ? "right-0" : "left-0"} flex gap-1 glass-strong border border-white/10 rounded-full px-2 py-1`}>
                  {REACTIONS.map((e) => (
                    <button key={e} onClick={() => react(m.id, e)} className="text-base hover:scale-125 transition-transform">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
