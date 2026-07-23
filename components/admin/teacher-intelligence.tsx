import { getTeacherIntelligence } from "@/lib/admin-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, CheckCircle2, Clock, Star, Inbox, AlertTriangle } from "lucide-react";

function reviewLabel(hrs: number | null): string {
  if (hrs == null) return "—";
  if (hrs < 24) return `${hrs} soat`;
  return `${Math.round((hrs / 24) * 10) / 10} kun`;
}

/**
 * M10 — Teacher Intelligence. Per-teacher review speed, volume, feedback depth,
 * satisfaction (speaking ratings) and pending queue, with coaching flags for
 * those who need support. Read-only server component. Uzbek UI.
 */
export async function TeacherIntelligence() {
  const teachers = await getTeacherIntelligence();

  return (
    <Card className="glass border-averna-blue/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-blue">
            <GraduationCap className="h-5 w-5" /> Oʻqituvchilar Intellekti
          </span>
          <span className="text-xs font-normal text-gray-400">{teachers.length} ta oʻqituvchi</span>
        </CardTitle>
        <p className="text-xs text-gray-400">Tekshiruv tezligi, hajmi va sifati (soʻnggi 60 kun)</p>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Hozircha oʻqituvchilar maʼlumoti yoʻq.</p>
        ) : (
          <div className="space-y-2.5">
            {teachers.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {t.name}
                    {t.band != null && <span className="text-[11px] text-averna-cyan"> · IELTS {t.band}</span>}
                  </span>
                  {t.flags.length > 0 && (
                    <span className="flex items-center gap-1 flex-wrap justify-end">
                      {t.flags.map((f) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 whitespace-nowrap">
                          {f}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <span className="flex items-center gap-1 text-gray-300" title="Oʻquvchilar">
                    <Users className="h-3.5 w-3.5 text-gray-400" /> {t.students}
                  </span>
                  <span className="flex items-center gap-1 text-gray-300" title="Tekshirilgan">
                    <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" /> {t.reviewed}
                  </span>
                  <span className="flex items-center gap-1 text-gray-300" title="Oʻrtacha tekshiruv vaqti">
                    <Clock className="h-3.5 w-3.5 text-averna-cyan" /> {reviewLabel(t.avgReviewHrs)}
                  </span>
                  <span className="flex items-center gap-1 text-gray-300" title="Oʻrtacha baho (gapirish)">
                    <Star className="h-3.5 w-3.5 text-amber-400" /> {t.avgRating != null ? t.avgRating : "—"}
                  </span>
                  <span className={`flex items-center gap-1 ${t.pending > 10 ? "text-amber-300" : "text-gray-300"}`} title="Navbatdagi ishlar">
                    <Inbox className="h-3.5 w-3.5 text-gray-400" /> {t.pending}
                  </span>
                </div>

                {t.flags.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-300/90 flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Yordam tavsiya etiladi: {t.flags.join(", ").toLowerCase()}.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
