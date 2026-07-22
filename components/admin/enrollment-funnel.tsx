import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, UserPlus, Users, GraduationCap } from "lucide-react";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Enrollment funnel — visualises how new sign-ups flow through to fully
 * enrolled students, so admins can spot where learners get stuck.
 */
export async function EnrollmentFunnel() {
  const [registered, enrolled, withLevel] = await Promise.all([
    db.student.count(),
    db.student.count({ where: { groupId: { not: null } } }),
    db.student.count({ where: { level: { not: null } } }),
  ]);

  const pending = registered - enrolled;

  const stages = [
    { label: "Roʻyxatdan oʻtgan", value: registered, icon: UserPlus, color: "from-averna-cyan to-averna-blue", text: "text-averna-cyan" },
    { label: "Daraja belgilangan", value: withLevel, icon: GraduationCap, color: "from-averna-purple to-averna-pink", text: "text-averna-purple" },
    { label: "Guruhga qabul qilingan", value: enrolled, icon: Users, color: "from-averna-neon to-averna-cyan", text: "text-averna-neon" },
  ];

  const max = Math.max(registered, 1);

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Filter className="h-5 w-5" /> Qabul voronkasi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {registered === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Hozircha oʻquvchilar yoʻq"
            description="Roʻyxatdan oʻtish havolangizni ulashing — yangi oʻquvchilar roʻyxatdan oʻtib, joylashtirilgach shu voronkadan oʻtadi."
            accent="text-averna-purple"
            compact
          />
        ) : (
          <div className="space-y-4">
            {stages.map((s) => {
              const Icon = s.icon;
              const pct = Math.round((s.value / max) * 100);
              const conv = registered > 0 ? Math.round((s.value / registered) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm text-gray-300">
                      <Icon className={`h-4 w-4 ${s.text}`} /> {s.label}
                    </span>
                    <span className="text-sm">
                      <span className="font-bold text-white">{s.value}</span>
                      <span className="text-gray-500 text-xs ml-1">({conv}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all`}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {pending > 0 && (
              <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-averna-pink/10 border border-averna-pink/20">
                <UserPlus className="h-4 w-4 text-averna-pink shrink-0" />
                <p className="text-xs text-averna-pink">
                  <span className="font-semibold">{pending}</span> ta oʻquvchi guruhga joylashtirilishini kutmoqda.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
