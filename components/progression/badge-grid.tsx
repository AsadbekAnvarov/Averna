import { CheckCircle2, Lock } from "lucide-react";
import { getProgression } from "@/lib/engine/progression/service";
import { SKILL_LABEL } from "@/lib/engine/progression/config";
import { Meter, SkillIcon } from "./ui";
import { cn } from "@/lib/utils";
import { ErrorPanel } from "./error-panel";

const GROUPS = ["READING", "LISTENING", "WRITING", "SPEAKING", "GENERAL"] as const;

/** Every evidence-based milestone, grouped by skill, with honest progress. */
export async function BadgeGrid({ studentId }: { studentId: string }) {
  const p = await getProgression(studentId).catch((e) => {
    console.error("BadgeGrid: getProgression failed", e);
    return null;
  });
  if (!p) {
    return <ErrorPanel title="We couldn't load your milestones." detail="Your badges are safe — this is only a display problem." retryHref="/progress/achievements" />;
  }
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = p.badges.filter((b) => b.def.skill === g);
        if (!items.length) return null;
        return (
          <section key={g} aria-labelledby={`badges-${g}`}>
            <h3 id={`badges-${g}`} className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              {g === "GENERAL" ? "Consistency & milestones" : SKILL_LABEL[g]}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
                <li
                  key={b.def.id}
                  className={cn(
                    "av-panel flex items-start gap-3 rounded-2xl p-4",
                    b.earned ? "border-averna-neon/30" : "opacity-80"
                  )}
                >
                  <SkillIcon skill={b.def.skill} className={b.earned ? "" : "grayscale"} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {b.def.name}
                      {b.earned ? (
                        <CheckCircle2 className="h-4 w-4 text-averna-neon" aria-label="Unlocked" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-gray-500" aria-label="Locked" />
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{b.def.description}</p>
                    {b.earned ? (
                      <p className="mt-2 text-[11px] text-gray-500">
                        {b.unlockedAt ? `Unlocked ${new Date(b.unlockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Unlocked"}
                        {b.def.xp > 0 && ` · +${b.def.xp} XP`}
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <Meter value={b.percent} label={`${b.def.name} progress`} size="sm" barClassName="bg-amber-300" />
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {b.current}/{b.target}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
