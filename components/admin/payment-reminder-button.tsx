"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function PaymentReminderButton({ name, balance }: { name: string; balance: number }) {
  const [copied, setCopied] = useState(false);

  const text =
    `Dear parent/guardian,\n\n` +
    `This is a friendly reminder from Averna Learning Centre regarding ${name}'s account ` +
    `(current balance: ${balance.toLocaleString("en-US")} UZS). ` +
    `Please top up at your earliest convenience so lessons can continue without interruption.\n\n` +
    `Thank you! — Averna Learning Centre`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-averna-cyan/30 text-averna-cyan hover:bg-averna-cyan/10 transition-colors shrink-0"
      title="Copy a payment reminder message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Reminder"}
    </button>
  );
}
