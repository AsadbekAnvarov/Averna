import Link from "next/link";
import { Compass, Clock, ArrowRight } from "lucide-react";
import type { Recommendation } from "@/lib/engine/progression/recommendations";
import { Panel, PanelTitle, SkillIcon, XpChip } from "./ui";

/**
 * "Averna Recommendation" — the single best next activity, with the reason.
 * Used on the dashboard and (compact) after every finished session.
 */
export function NextActivity({ rec, title = "Averna recommends", compact = false }: { rec: Recommendation; title?: string; compact?: boolean }) {
  const body = (
    <>
      {rec.context && <p className="text-sm text-gray-400">{rec.context}</p>}
      <p className="mt-1 text-sm text-gray-200">{rec.reason}</p>
      <Link
        href={rec.href}
        className="glow-hover mt-4 flex min-h-[64px] items-center gap-3 rounded-2xl border border-averna-neon/30 bg-white/[0.03] p-3.5 transition"
      >
        <SkillIcon skill={rec.skill} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{rec.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
            <span>{rec.difficulty}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden /> ~{rec.estMinutes} min
            </span>
          </p>
        </div>
        <XpChip xp={rec.xp} />
        <ArrowRight className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
      </Link>
    </>
  );
  if (compact) return <div>{body}</div>;
  return (
    <Panel labelledBy="rec-title">
      <PanelTitle id="rec-title" icon={Compass} title={title} hint="Chosen from your recent results" />
      {body}
    </Panel>
  );
}
