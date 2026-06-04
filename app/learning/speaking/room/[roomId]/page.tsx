"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, LogOut, Users, Sparkles } from "lucide-react";
import { getTodayTopic } from "@/lib/speaking-topics";

interface Msg { id: string; senderId: string; senderName: string; content: string; createdAt: string; }
interface RoomInfo { id: string; topic: string; studentAName: string; studentBName: string; status: string; }

const EMOJIS = ["😀", "👍", "🎉", "🤔", "❤️", "😂", "🙌", "🔥", "👏", "🤝"];

export default function SpeakingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [meId, setMeId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topic = getTodayTopic();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/speaking/room?roomId=${roomId}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Could not load room");
        return;
      }
      const data = await res.json();
      setRoom(data.room);
      setMessages(data.messages);
      setMeId(data.meId);
      if (data.room.status === "ENDED") setEnded(true);
    } catch {
      setError("Connection error");
    }
  }, [roomId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (content: string) => {
    const body = content.trim();
    if (!body) return;
    setText("");
    await fetch("/api/speaking/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, content: body }),
    });
    load();
  };

  const leave = async () => {
    await fetch(`/api/speaking/room?roomId=${roomId}`, { method: "DELETE" });
    router.push("/learning/speaking");
  };

  if (error) {
    return (
      <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
        <Card className="glass border-red-500/30 max-w-md w-full text-center">
          <CardContent className="py-8 space-y-4">
            <p className="text-red-300">{error}</p>
            <Button onClick={() => router.push("/learning/speaking")} className="neon-button bg-averna-primary">
              Back to Speaking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-3xl pb-24 lg:pb-6">
        {/* Header */}
        <Card className="glass border-averna-neon/30 mb-4">
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-averna-neon text-xs font-semibold uppercase flex items-center gap-1">
                <Mic className="h-4 w-4" /> Face-to-Face Speaking
              </p>
              <p className="text-white font-bold truncate flex items-center gap-2">
                <Users className="h-4 w-4 text-averna-cyan" />
                {room?.studentAName} &amp; {room?.studentBName}
              </p>
              <p className="text-xs text-averna-cyan">Topic: {room?.topic}</p>
            </div>
            <Button onClick={leave} variant="outline" size="sm" className="border-red-500/50 text-red-300 shrink-0">
              <LogOut className="h-4 w-4 mr-1" /> Leave
            </Button>
          </CardContent>
        </Card>

        {/* Suggested questions */}
        <Card className="glass border-averna-purple/30 mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-averna-purple">
              <Sparkles className="h-4 w-4" /> Discuss these questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
              {topic.questions.map((q) => <li key={q}>{q}</li>)}
            </ul>
            <p className="text-[11px] text-gray-500 mt-2">⚠️ Please keep the conversation on topic.</p>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="glass border-averna-cyan/30">
          <CardContent className="py-4 flex flex-col h-[50vh]">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-8">
                  You&apos;re connected! Start the conversation — say hello 👋
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? "bg-averna-primary text-white rounded-br-sm" : "bg-white/10 text-gray-100 rounded-bl-sm"}`}>
                        {!mine && <p className="text-[10px] text-averna-cyan mb-0.5">{m.senderName}</p>}
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {ended ? (
              <div className="mt-3 border-t border-white/10 pt-3 text-center">
                <p className="text-gray-400 text-sm mb-2">This session has ended.</p>
                <Button onClick={() => router.push("/learning/speaking")} className="neon-button bg-averna-primary">
                  Back to Speaking
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 mt-3 flex-wrap">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => send(e)} className="text-lg hover:scale-125 transition-transform" type="button">
                      {e}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); send(text); }}
                  className="flex gap-2 mt-2 border-t border-white/10 pt-3"
                >
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message..." autoComplete="off" className="bg-background/50" />
                  <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
