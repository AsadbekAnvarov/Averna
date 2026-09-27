import Link from "next/link";
import { Swords, CheckCircle2 } from "lucide-react";
import type { ChallengeState } from "@/lib/engine/progression/challenges";
import { Meter, Panel, PanelTitle, XpChip } from "./ui";

function Row({ c }: { c: ChallengeState }) {
  return (
    <Link href={c.def.href} className="glow-hover block rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {c.scope === "daily" ? "Today" : "This week"}
          </p>
          <p className="text-sm font-semibold text-white">{c.def.title}</p>
          <p className="text-xs text-gray-400">{c.def.detail}</p>
        </div>
        {c.done ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-averna-neon">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Done
          </span>
        ) : (
          <XpChip xp={c.def.xp} className="shrink-0" />
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Meter value={c.percent} label={`${c.def.title} progress`} size="sm" />
        <span className="shrink-0 text-xs text-gray-400">
          {c.current}/{c.target}
        </span>
      </div>
    </Link>
  );
}

/** Rotating daily + weekly challenges (rewards paid automatically when met). */
export function ChallengesCard({ daily, weekly }: { daily: ChallengeState; weekly: ChallengeState }) {
  return (
    <Panel labelledBy="challenges-title">
      <PanelTitle id="challenges-title" icon={Swords} title="Challenges" hint="Rewards are added automatically when you finish" />
      <div className="space-y-2.5">
        <Row c={daily} />
        <Row c={weekly} />
      </div>
    </Panel>
  );
}
