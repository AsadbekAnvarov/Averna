"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Star } from "lucide-react";

export function SubmitForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("Task 2");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/peer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, taskType, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "Submitted! Peers can now review it." });
        setTitle("");
        setContent("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: data.error ?? "Could not submit." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Opinion essay on tourism)"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
        />
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
        >
          <option className="bg-averna-dark">Task 1</option>
          <option className="bg-averna-dark">Task 2</option>
          <option className="bg-averna-dark">Other</option>
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste your essay here for peers to review…"
        className="w-full h-40 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan resize-none leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy} className="neon-button bg-averna-primary hover:bg-averna-light">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit for review
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-averna-neon" : "text-orange-300"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function ReviewForm({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(6);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/peer/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, rating, strengths, improvements }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: `Thanks! +${data.pointsEarned ?? 10} XP` });
        setTimeout(() => router.refresh(), 800);
      } else {
        setMsg({ ok: false, text: data.error ?? "Could not submit review." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
        className="border-averna-cyan/40 text-averna-cyan"
      >
        <Star className="mr-2 h-4 w-4" /> Review this
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Band</span>
        <input
          type="range"
          min={1}
          max={9}
          step={0.5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="flex-1 accent-averna-cyan"
        />
        <span className="text-sm font-bold text-averna-cyan w-8 text-right">{rating.toFixed(1)}</span>
      </div>
      <textarea
        value={strengths}
        onChange={(e) => setStrengths(e.target.value)}
        placeholder="What did they do well?"
        className="w-full h-16 rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-neon resize-none"
      />
      <textarea
        value={improvements}
        onChange={(e) => setImprovements(e.target.value)}
        placeholder="One or two things to improve…"
        className="w-full h-16 rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
      />
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy} size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send review
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" variant="ghost" className="text-gray-400">
          Cancel
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-averna-neon" : "text-orange-300"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
