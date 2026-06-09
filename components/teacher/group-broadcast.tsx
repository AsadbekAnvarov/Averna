"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Send, CheckCircle2, Loader2 } from "lucide-react";

interface GroupOption {
  id: string;
  name: string;
  count: number;
}

/**
 * Lets a teacher send a quick broadcast message/reminder to every student in
 * one of their groups. Posts to /api/teacher/broadcast.
 */
export function GroupBroadcast({ groups }: { groups: GroupOption[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentCount, setSentCount] = useState(0);

  const selected = groups.find((g) => g.id === groupId);

  const send = async () => {
    if (!groupId || !message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/teacher/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSentCount(data.sent ?? 0);
      setStatus("sent");
      setMessage("");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <Card className="glass border-averna-pink/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <Megaphone className="h-5 w-5" /> Message a Group
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">You have no groups to message yet.</p>
        ) : (
          <div className="space-y-3">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-averna-dark">
                  {g.name} ({g.count} students)
                </option>
              ))}
            </select>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={`Send a reminder to ${selected?.name ?? "the group"}… e.g. "Don't forget homework is due tomorrow!"`}
              className="w-full resize-none rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-pink"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs min-h-[1rem]">
                {status === "sent" && (
                  <span className="text-averna-neon flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Sent to {sentCount} student{sentCount === 1 ? "" : "s"}!
                  </span>
                )}
                {status === "error" && <span className="text-red-400">Something went wrong. Try again.</span>}
                {(status === "idle" || status === "sending") && (
                  <span className="text-gray-500">{message.length}/1000</span>
                )}
              </div>
              <Button
                onClick={send}
                disabled={status === "sending" || !message.trim() || !groupId}
                size="sm"
                className="neon-button bg-averna-primary hover:bg-averna-light"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
