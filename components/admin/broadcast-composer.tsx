"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Send } from "lucide-react";

const TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Lesson reminder",
    text: "📚 Reminder: your next lesson is tomorrow. Please arrive 5 minutes early and bring your materials. See you there!",
  },
  {
    label: "Holiday notice",
    text: "🎉 Please note the centre will be closed on [date] for the holiday. Lessons resume as normal afterwards.",
  },
  {
    label: "Results published",
    text: "📊 Great news! Your latest test results are now available on Averna. Log in to see your band and feedback.",
  },
  {
    label: "Motivation",
    text: "💪 Small daily progress beats occasional big effort. Spend 15 minutes on Averna today and keep your streak alive!",
  },
  {
    label: "Payment reminder",
    text: "💳 Friendly reminder: please top up your balance so lessons continue without interruption. Thank you!",
  },
];

export function BroadcastComposer() {
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const shareTelegram = () => {
    const url = "https://averna.uz";
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <Card className="glass border-averna-cyan/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-averna-cyan">Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setMessage(t.text)}
                className="px-3 py-1.5 rounded-full text-sm border bg-white/5 border-white/10 text-gray-300 hover:border-averna-cyan/40 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-averna-purple/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-averna-purple">Compose message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-40 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple resize-none leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={copy} className="neon-button bg-averna-primary hover:bg-averna-light">
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy message"}
            </Button>
            <Button onClick={shareTelegram} variant="outline" className="border-averna-cyan/40 text-averna-cyan">
              <Send className="mr-2 h-4 w-4" /> Share to Telegram
            </Button>
            <span className="text-xs text-gray-500">{message.length} chars</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-500">
        Tip: &ldquo;Share to Telegram&rdquo; opens Telegram with your message ready to send to any chat or channel.
        For fully automated scheduled broadcasts, a Telegram bot token would need to be connected on the server.
      </p>
    </div>
  );
}
