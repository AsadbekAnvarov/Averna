"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

export default function AIMentorPage() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { role: "assistant", content: "Hello! I'm your AI IELTS mentor. Ask me anything about English grammar, vocabulary, IELTS tips, or practice questions!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messages }),
      });

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
          <MessageSquare className="h-10 w-10 text-pink-400" />
          AI Mentor
        </h1>

        <Card className="glass border-pink-500/30 h-[70vh] min-h-[420px] max-h-[680px] flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle className="text-pink-400 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Chat with AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] min-w-0 p-3 rounded-lg ${
                    msg.role === "user" 
                      ? "bg-averna-primary text-white" 
                      : "bg-pink-500/20 text-gray-200 border border-pink-500/30"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-pink-500/20 p-3 rounded-lg border border-pink-500/30">
                    <Loader2 className="h-5 w-5 animate-spin text-pink-400" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask me anything about IELTS..."
                className="bg-background/50"
                disabled={isLoading}
              />
              <VoiceInputButton onText={(t) => setInput((prev) => (prev ? prev + " " : "") + t.trim())} />
              <Button onClick={handleSend} disabled={isLoading} className="neon-button bg-pink-500">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
