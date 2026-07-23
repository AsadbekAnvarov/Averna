import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fingerprint } from "lucide-react";
import { db } from "@/lib/db";

type ModuleKey = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

const SKILL_META: { key: ModuleKey; label: string; color: string }[] = [
  { key: "READING", label: "Reading", color: "#60a5fa" },
  { key: "LISTENING", label: "Listening", color: "#4ade80" },
  { key: "WRITING", label: "Writing", color: "#c084fc" },
  { key: "SPEAKING", label: "Speaking", color: "#fb923c" },
];

/**
 * Skill DNA — a generative, animated "double helix" unique to each student.
 * Each of the four IELTS skills is a coloured strand of rungs whose brightness
 * encodes mastery (average band ÷ 9). It grows and glows as the learner
 * improves — an identity object they're proud of. Reads only module + score
 * (both always stored), so it's robust.
 */
export async function SkillDna({ studentId }: { studentId: string }) {
  let tests: { module: ModuleKey; score: number }[] = [];
  try {
    tests = (await db.iELTSTest.findMany({
      where: { studentId },
      select: { module: true, score: true },
    })) as { module: ModuleKey; score: number }[];
  } catch {
    tests = [];
  }

  const skills = SKILL_META.map((m) => {
    const scores = tests.filter((t) => t.module === m.key).map((t) => t.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { ...m, band: avg, value: Math.max(0, Math.min(1, avg / 9)), count: scores.length };
  });
  const totalTests = tests.length;

  // ---- Build the helix geometry ----
  const W = 170;
  const H = 240;
  const center = W / 2;
  const amp = 46;
  const padY = 18;
  const RUNGS = 18;
  const stepY = (H - padY * 2) / (RUNGS - 1);
  const turns = 2.2;
  const freq = (Math.PI * 2 * turns) / (RUNGS - 1);

  const A: string[] = [];
  const B: string[] = [];
  const rungs = [];
  for (let i = 0; i < RUNGS; i++) {
    const t = i * freq;
    const s = Math.sin(t);
    const ax = center + amp * s;
    const bx = center - amp * s;
    const y = padY + i * stepY;
    A.push(`${ax.toFixed(1)} ${y.toFixed(1)}`);
    B.push(`${bx.toFixed(1)} ${y.toFixed(1)}`);
    const skill = skills[i % 4];
    const base = 0.18 + 0.82 * skill.value;
    rungs.push({ ax, bx, y, color: skill.color, base, delay: (i * 0.13).toFixed(2) });
  }
  const pathA = "M " + A.join(" L ");
  const pathB = "M " + B.join(" L ");

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Fingerprint className="h-5 w-5" /> Skill DNA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Helix */}
          <div className="shrink-0">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="dna-float">
              <path d={pathA} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
              <path d={pathB} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
              {rungs.map((r, i) => (
                <g key={i}>
                  <line
                    className="dna-rung"
                    x1={r.ax} y1={r.y} x2={r.bx} y2={r.y}
                    stroke={r.color} strokeWidth="3" strokeLinecap="round"
                    style={{ ["--o" as any]: r.base, animationDelay: `${r.delay}s` }}
                  />
                  <circle cx={r.ax} cy={r.y} r="3" fill={r.color} opacity={Math.min(1, r.base + 0.1)} />
                  <circle cx={r.bx} cy={r.y} r="3" fill={r.color} opacity={Math.min(1, r.base + 0.1)} />
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="w-full space-y-3">
            {skills.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-gray-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
                  </span>
                  <span className="text-xs text-gray-400">{s.count > 0 ? `band ${s.band.toFixed(1)}` : "—"}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(s.value * 100)}%`, background: s.color }} />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-500 pt-1">
              {totalTests > 0
                ? "Your unique fingerprint grows and glows as your bands improve."
                : "Take tests in each skill to grow your Skill DNA. 🧬"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
