"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Mail } from "lucide-react";

interface WeeklyReportProps {
  name: string;
  group: string;
  level: string;
  points: number;
  streak: number;
  attendanceRate: number | null;
  avgGrade: number | null;
  homework: { title: string; status: string }[];
}

export function WeeklyReportButton(props: WeeklyReportProps) {
  const [copied, setCopied] = useState(false);

  const buildText = () => {
    const date = new Date().toLocaleDateString("en-GB", {
      timeZone: "Asia/Tashkent",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const hwLines = props.homework.length
      ? props.homework.map((h) => `  • ${h.title} — ${h.status.toLowerCase()}`).join("\n")
      : "  • No recent submissions";

    return (
      `📋 Weekly Progress Report — ${props.name}\n` +
      `Averna Learning Centre · ${date}\n` +
      `Group: ${props.group} · Level: ${props.level}\n\n` +
      `⭐ Points earned: ${props.points}\n` +
      `🔥 Current streak: ${props.streak} day(s)\n` +
      `🗓️ Attendance: ${props.attendanceRate === null ? "no records yet" : props.attendanceRate + "%"}\n` +
      `📊 Average grade: ${props.avgGrade === null ? "no grades yet" : props.avgGrade + "%"}\n\n` +
      `Recent homework:\n${hwLines}\n\n` +
      `Thank you for supporting ${props.name.split(" ")[0]}'s learning! 💪\n` +
      `— Averna Learning Centre`
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const email = () => {
    const subject = encodeURIComponent(`Weekly Progress Report — ${props.name}`);
    const body = encodeURIComponent(buildText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={copy} size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied!" : "Copy weekly summary"}
      </Button>
      <Button onClick={email} size="sm" variant="outline" className="border-averna-cyan/40 text-averna-cyan">
        <Mail className="mr-2 h-4 w-4" /> Email to parent
      </Button>
    </div>
  );
}
