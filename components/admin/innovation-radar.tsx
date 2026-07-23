import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Telescope, Info } from "lucide-react";

type Status = "done" | "partial" | "new";

interface Idea {
  pattern: string;
  opportunity: string;
  status: Status;
  impact: number; // 1-10
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  done: { label: "Joriy etilgan", cls: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" },
  partial: { label: "Qisman", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  new: { label: "Yangi imkoniyat", cls: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan" },
};

// Curated patterns in modern EdTech + how Averna can improve upon them.
// This is a static, hand-picked board — NOT live market monitoring.
const IDEAS: Idea[] = [
  {
    pattern: "Moslashuvchan qiyinlik (adaptive difficulty)",
    opportunity: "Testlar oʻquvchi natijasiga qarab real vaqtda qiyinlashsin — hozircha faqat tavsiya bor, keyingi qadam: test dvijkiga ulash.",
    status: "partial",
    impact: 9,
  },
  {
    pattern: "Ovozli AI hamsuhbat (real-time speaking partner)",
    opportunity: "Rolli suhbat allaqachon bor; keyingisi — jonli talaffuz va oraliq baholash bilan real vaqtli suhbat.",
    status: "partial",
    impact: 8,
  },
  {
    pattern: "Interval takrorlash (spaced repetition)",
    opportunity: "Xatolar banki SRS asosida ishlaydi — buni lugʻat va grammatikaga ham kengaytirish mumkin.",
    status: "done",
    impact: 8,
  },
  {
    pattern: "Ijtimoiy oʻrganish (peer accountability)",
    opportunity: "Study Squad guruh maqsadini beradi; keyingisi — kichik ligalar va doʻstona musobaqalar.",
    status: "partial",
    impact: 7,
  },
  {
    pattern: "Mikro-oʻrganish (micro-learning)",
    opportunity: "60-soniyalik warm-up bor; kunlik 2-3 daqiqalik “darcha”larni push bilan bogʻlash mumkin.",
    status: "done",
    impact: 7,
  },
  {
    pattern: "Emotsional bogʻlanish (mood-aware learning)",
    opportunity: "Kayfiyatga qarab tavsiya beriladi; keyingisi — motivatsiya pasayganini oldindan sezish.",
    status: "partial",
    impact: 6,
  },
  {
    pattern: "Kohorta asosidagi kurslar (cohort learning)",
    opportunity: "Belgilangan sanada boshlanadigan, jamoaviy tugatiladigan “sprint” kurslar sadoqatni oshiradi.",
    status: "new",
    impact: 7,
  },
  {
    pattern: "AI portfel va sertifikatlar",
    opportunity: "Oʻquvchining oʻsishini avtomatik hujjatlashtirib, ulashiladigan sertifikat/portfelga aylantirish.",
    status: "new",
    impact: 6,
  },
];

/**
 * M15 — Innovation Radar (curated). A hand-picked board of emerging EdTech
 * patterns and how Averna can improve upon them, with an honest status per idea.
 * NOTE: this is a curated list, not live market monitoring (which would need
 * external data feeds). Clearly labelled as such. Uzbek UI.
 */
export function InnovationRadar() {
  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-averna-purple/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Telescope className="h-5 w-5" /> Innovatsiya Radari
        </CardTitle>
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" /> Kurirlangan gʻoyalar roʻyxati — jonli bozor monitoringi emas.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-2.5">
          {IDEAS.map((idea) => {
            const s = STATUS_META[idea.status];
            return (
              <div key={idea.pattern} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{idea.pattern}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>{s.label}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{idea.opportunity}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon"
                      style={{ width: `${idea.impact * 10}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">taʼsir {idea.impact}/10</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
