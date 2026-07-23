import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Teacher workload balance — shows how many students/groups each teacher
 * carries, so admins can rebalance and avoid overloading anyone.
 */
export async function TeacherWorkload() {
  const teachers = await db.teacher.findMany({
    // Explicit `select` avoids querying teacher scalar columns we don't use
    // here (e.g. `ieltsBand`), so this widget never breaks on schema changes.
    select: {
      id: true,
      isSecondTeacher: true,
      user: { select: { name: true } },
      groups: { select: { students: { select: { id: true } } } },
    },
  });

  const rows = teachers
    .map((t) => {
      const students = t.groups.reduce((sum, g) => sum + g.students.length, 0);
      return {
        id: t.id,
        name: t.user.name ?? "Oʻqituvchi",
        groups: t.groups.length,
        students,
        isSecond: t.isSecondTeacher,
      };
    })
    .sort((a, b) => b.students - a.students);

  const max = Math.max(...rows.map((r) => r.students), 1);
  const avg = rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.students, 0) / rows.length) : 0;

  return (
    <Card className="glass border-averna-blue/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-blue">
            <Scale className="h-5 w-5" /> Oʻqituvchi yuklamasi
          </span>
          <span className="text-xs font-normal text-gray-400">oʻrtacha {avg} / oʻqituvchi</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Hozircha oʻqituvchilar yoʻq"
            description="Oʻqituvchilar qoʻshing va ularga guruhlar biriktiring — yuklama muvozanati shu yerda koʻrinadi."
            accent="text-averna-blue"
            action={{ label: "Oʻqituvchilarni boshqarish", href: "/admin/teachers" }}
            compact
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const pct = Math.round((r.students / max) * 100);
              const overloaded = avg > 0 && r.students > avg * 1.5;
              return (
                <div key={r.id}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="flex items-center gap-2 text-white min-w-0">
                      <span className="truncate">{r.name}</span>
                      {r.isSecond && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-averna-pink/20 text-averna-pink shrink-0">
                          1-on-1
                        </span>
                      )}
                      {overloaded && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/20 text-red-400 shrink-0">
                          yuqori yuklama
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {r.groups}
                      </span>
                      <span className="font-semibold text-white">{r.students}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overloaded
                          ? "bg-gradient-to-r from-red-400 to-orange-400"
                          : "bg-gradient-to-r from-averna-blue to-averna-cyan"
                      }`}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
