"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Bot, Loader2, Copy, Sparkles } from "lucide-react";

/**
 * F10 — AI Teacher Twin. Learns the teacher's feedback VOICE from their past
 * feedback and drafts new feedback in the same style. It amplifies, never
 * replaces: the draft is fully editable. GPT-4o with a graceful fallback; the
 * teacher's samples stay server-side.
 */
export function TeacherTwin({ learned, avgLen }: { learned: number; avgLen: number }) {
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/twin-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDraft(data.draft || "");
    } catch (e: any) {
      toast.error(e.message || "Couldn't draft feedback.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Draft copied.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <Card className="glass border-averna-neon/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-averna-neon/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-neon">
          <Bot className="h-5 w-5" /> Your AI Teacher Twin
        </CardTitle>
        <p className="text-xs text-gray-400">
          {learned > 0
            ? `Learned from ${learned} of your past feedback notes (~${avgLen} chars each). It writes in your voice — you stay in control.`
            : "As you write feedback, your Twin learns your voice. For now it drafts in a friendly, constructive tone."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 relative">
        <Input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Describe the situation — e.g. “Task 2, Band 6, weak cohesion, good ideas”"
          className="bg-background/50"
        />
        <Button onClick={generate} disabled={loading} className="neon-button bg-averna-neon hover:bg-averna-neon/80 text-black">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? "Drafting in your style…" : "Draft feedback in my style"}
        </Button>

        {draft && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full rounded-lg bg-background/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-averna-neon/50 resize-y"
            />
            <Button onClick={copy} variant="outline" className="border-averna-neon/40 text-averna-neon">
              <Copy className="mr-1.5 h-4 w-4" /> Copy draft
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
