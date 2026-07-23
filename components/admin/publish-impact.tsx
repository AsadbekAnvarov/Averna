"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar, Users, Clock, Activity } from "lucide-react";
import type { ReachStats } from "@/lib/admin-analytics";

/**
 * M8 — Publish Impact (honest reach estimator). Before sending an announcement,
 * the admin sees an estimated reach based on REAL data (weekly/daily active
 * students) and the best send time (real peak activity hour). No invented
 * open-rates — it is framed clearly as an estimate. Client "what-if" toggle.
 * Uzbek UI.
 */
export function PublishImpact({ stats }: { stats: ReachStats }) {
  const [audience, setAudience] = useState<"active" | "all">("active");

  const reach = audience === "active" ? stats.activeWeek : stats.totalStudents;
  const activityRate = stats.totalStudents > 0 ? Math.round((stats.activeWeek / stats.totalStudents) * 100) : 0;
  const peakLabel =
    stats.peakHour != null ? `${stats.peakHour}:00–${(stats.peakHour + 1) % 24}:00` : "maʼlumot yetarli emas";

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-averna-cyan/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Radar className="h-5 w-5" /> Nashr Taʼsiri
        </CardTitle>
        <p className="text-xs text-gray-400">Eʼlon joʻnatishdan oldin taxminiy qamrovni koʻring</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audience toggle */}
        <div className="inline-flex rounded-lg border border-white/10 p-0.5 bg-white/5">
          <button
            onClick={() => setAudience("active")}
            className={`px-3 py-1.5 text-xs rounded-md transition ${
              audience === "active" ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white"
            }`}
          >
            Faol (7 kun)
          </button>
          <button
            onClick={() => setAudience("all")}
            className={`px-3 py-1.5 text-xs rounded-md transition ${
              audience === "all" ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white"
            }`}
          >
            Hammasi
          </button>
        </div>

        {/* Estimated reach */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-averna-cyan">Taxminiy qamrov</p>
          <p className="text-4xl font-extrabold text-white mt-1">{reach.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {audience === "active"
              ? "soʻnggi 7 kunda faol boʻlgan oʻquvchilar"
              : "jami oʻquvchilar (hammasi darhol koʻrmasligi mumkin)"}
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/5 border border-white/10 py-2">
            <Clock className="h-4 w-4 mx-auto text-averna-neon" />
            <p className="text-xs font-semibold text-white mt-1">{peakLabel}</p>
            <p className="text-[10px] text-gray-500">eng yaxshi vaqt</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 py-2">
            <Activity className="h-4 w-4 mx-auto text-averna-cyan" />
            <p className="text-xs font-semibold text-white mt-1">{activityRate}%</p>
            <p className="text-[10px] text-gray-500">faollik darajasi</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 py-2">
            <Users className="h-4 w-4 mx-auto text-averna-purple" />
            <p className="text-xs font-semibold text-white mt-1">{stats.activeToday.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">bugun faol</p>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 text-center">
          Bu — taxmin. Haqiqiy koʻrish oʻquvchilar faolligiga bogʻliq. Eng yaxshi vaqtda joʻnatish qamrovni oshiradi.
        </p>
      </CardContent>
    </Card>
  );
}
