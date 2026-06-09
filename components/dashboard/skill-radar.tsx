import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar as RadarIcon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";

const MODULES = [
  { key: "WRITING", label: "Writing", href: "/learning/writing" },
  { key: "READING", label: "Reading", href: "/learning/reading" },
  { key: "LISTENING", label: "Listening", href: "/learning/listening" },
  { key: "SPEAKING", label: "Speaking", href: "/learning/speaking" },
] as const;

/**
 * Per-skill radar built from IELTS test averages. Visualises strengths and
 * weaknesses across the four modules and nudges the student toward whichever
 * skill needs the most work.
 */
export async function SkillRadar({ studentId }: { studentId: string }) {
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    select: { module: true, score: true },
  });

  const sums = new Map<string, { total: number; count: number }>();
  for (const t of tests) {
    const r = sums.get(t.module) ?? { total: 0, count: 0 };
    r.total += t.score;
    r.count += 1;
    sums.set(t.module, r);
  }

  const data = MODULES.map((m) => {
    const r = sums.get(m.key);
    const avg = r && r.count > 0 ? r.total / r.count : 0;
    return { ...m, avg, has: !!r };
  });

  const tested = data.filter((d) => d.has);
  const weakest = tested.length > 0 ? tested.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

  // SVG geometry
  const size = 220;
  const c = size / 2;
  const R = 82;
  const maxVal = 9;
  // angles: top, right, bottom, left (Writing, Reading, Listening, Speaking)
  const angles = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180);
  const point = (val: number, i: number) => {
    const r = (Math.max(0, Math.min(maxVal, val)) / maxVal) * R;
    return [c + r * Math.cos(angles[i]), c + r * Math.sin(angles[i])] as const;
  };
  const axisPoint = (i: number, mult = 1) => [c + R * mult * Math.cos(angles[i]), c + R * mult * Math.sin(angles[i])] as const;

  const polygon = data.map((d, i) => point(d.avg, i).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <RadarIcon className="h-5 w-5" /> Skill Radar
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tested.length === 0 ? (
          <EmptyState
            icon={RadarIcon}
            title="No skills measured yet"
            description="Complete tests in each module to see your strengths and weak spots mapped out."
            accent="text-averna-purple"
            compact
          />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
              {/* grid rings */}
              {rings.map((mult) => (
                <polygon
                  key={mult}
                  points={angles.map((_, i) => axisPoint(i, mult).join(",")).join(" ")}
                  fill="none"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth={1}
                />
              ))}
              {/* axes */}
              {angles.map((_, i) => {
                const [x, y] = axisPoint(i);
                return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />;
              })}
              {/* data polygon */}
              <polygon points={polygon} fill="rgba(177,78,255,0.25)" stroke="#b14eff" strokeWidth={2} />
              {data.map((d, i) => {
                const [x, y] = point(d.avg, i);
                return <circle key={d.key} cx={x} cy={y} r={3} fill="#b14eff" />;
              })}
            </svg>

            <div className="flex-1 w-full space-y-2">
              {data.map((d) => (
                <Link
                  key={d.key}
                  href={d.href}
                  className="group flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-gray-300">{d.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{d.has ? d.avg.toFixed(1) : "—"}</span>
                    {weakest && d.key === weakest.key && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400">focus</span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </span>
                </Link>
              ))}
              {weakest && (
                <p className="text-xs text-gray-400 pt-1">
                  Tip: your weakest skill is <span className="text-amber-400 font-medium">{weakest.label}</span> — give it some love today.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
