import { Brain, Clock, Gauge, Lock, Rocket, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDnaAggregate, type DnaAggregate, type DnaDaypart, type LearningStyle, type SkillKey } from "@/lib/engine/learning-dna";
import { DnaBars, DnaTrendLine } from "@/components/learning-dna/dna-primitives";

/**
 * Platform-wide Learning DNA analytics for the administrator.
 *
 * Admin UI is in Uzbek (Latin script). The engine itself stays language-neutral —
 * it returns keys, and the translation tables below live here, in the only place
 * that needs them. That keeps a second language from leaking into the analytics
 * layer, where it would have to be duplicated for every future consumer.
 *
 * Every figure shown has already passed the engine's k-anonymity suppression, so
 * nothing on this page can be traced back to an individual student — which is what
 * makes centre-wide behavioural analytics acceptable to run at all.
 */

const STYLE_UZ: Record<LearningStyle, string> = {
  visual: "Vizual — oʻqib oʻrganadi",
  auditory: "Eshitib oʻrganadi",
  verbal: "Gapirib oʻrganadi",
  kinesthetic: "Faol takrorlash bilan oʻrganadi",
  analytical: "Tahliliy — yozib oʻrganadi",
};

const SKILL_UZ: Record<SkillKey, string> = {
  READING: "Oʻqish",
  LISTENING: "Tinglash",
  WRITING: "Yozish",
  SPEAKING: "Gapirish",
  GRAMMAR: "Grammatika",
  VOCABULARY: "Lugʻat",
};

const DAYPART_UZ: Record<DnaDaypart, string> = {
  early: "Erta tong",
  morning: "Ertalab",
  afternoon: "Kunduzi",
  evening: "Kechqurun",
  night: "Tunda",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  accent = "text-averna-cyan",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="glass rounded-xl border border-white/10 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accent)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
          {label}
        </span>
      </div>
      {value != null ? (
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold leading-none", accent)}>{value}</span>
          {unit && <span className="text-xs text-gray-400">{unit}</span>}
        </div>
      ) : (
        <span className="text-sm font-semibold text-gray-500">Maʼlumot yetarli emas</span>
      )}
      {hint && <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export async function LearningDnaAnalytics() {
  let data: DnaAggregate;
  try {
    data = await getDnaAggregate();
  } catch {
    return null;
  }

  const motivationTotal = data.motivation.rising + data.motivation.steady + data.motivation.falling;
  const pct = (n: number) => (motivationTotal > 0 ? Math.round((n / motivationTotal) * 100) : 0);

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-averna-purple">
            <Brain className="h-5 w-5" /> Oʻquv DNK tahlili
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
            <ShieldCheck className="h-3 w-3 text-averna-neon" />
            Anonim
          </span>
        </CardTitle>
        <p className="text-xs text-gray-400">
          Platforma boʻylab xatti-harakat tahlili — {data.profiles} ta oʻquvchi profili asosida. Hech qanday
          ism yoki shaxsiy maʼlumot ishlatilmaydi.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {data.suppressed ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
            <Lock className="mx-auto h-6 w-6 text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-white">Tahlil hozircha yopiq</p>
            <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              Koʻrsatkichlar faqat kamida <strong className="text-white">{data.kThreshold}</strong> ta
              oʻquvchi profili shakllangandan keyin ochiladi. Hozir {data.profiles} ta profil bor. Bu chegara
              kichik guruhlarda raqamlar orqali aniq bir oʻquvchini tanib olishning oldini oladi.
            </p>
          </div>
        ) : (
          <>
            {/* ---- Asosiy koʻrsatkichlar ---- */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiCard
                icon={Clock}
                label="Oʻrtacha diqqat davomiyligi"
                value={data.avgFocusMinutes}
                unit="daqiqa"
                hint="Oʻquvchilar eng aniq ishlaydigan mashgʻulot uzunligi."
                accent="text-averna-cyan"
              />
              <KpiCard
                icon={Clock}
                label="Tavsiya etilgan dars uzunligi"
                value={data.avgIdealLessonMinutes}
                unit="daqiqa"
                hint="Dars rejasini tuzishda shu raqamga tayanish mumkin."
                accent="text-averna-neon"
              />
              <KpiCard
                icon={Rocket}
                label="Oʻrtacha oʻrganish tezligi"
                value={data.avgLearningSpeed}
                unit="ball / 10 kun"
                hint="Har 10 faol oʻqish kunida IELTS ballining oʻsishi."
                accent="text-averna-pink"
              />
              <KpiCard
                icon={Gauge}
                label="Oʻrtacha barqarorlik"
                value={data.avgConsistency}
                unit="/100"
                hint="Muntazam oʻqish darajasi."
                accent="text-orange-400"
              />
              <KpiCard
                icon={Brain}
                label="Oʻrtacha eslab qolish"
                value={data.retention.avg}
                unit="%"
                hint={`${data.retention.strong} ta kuchli, ${data.retention.fading} ta susayib borayotgan.`}
                accent="text-emerald-400"
              />
              <KpiCard
                icon={TrendingUp}
                label="Oʻrtacha oʻquv yetukligi"
                value={data.avgMaturity}
                unit="/100"
                hint="Oʻquvchining oʻqish madaniyati — bali emas."
                accent="text-averna-purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ---- Oʻrganish uslublari ---- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-averna-purple mb-3">
                  Eng koʻp tarqalgan oʻrganish uslublari
                </p>
                {data.styles.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Hali biror uslub {data.kThreshold} ta oʻquvchida aniqlanmagan.
                  </p>
                ) : (
                  <DnaBars
                    rows={data.styles.map((s, i) => ({
                      label: STYLE_UZ[s.style],
                      value: s.share,
                      meta: `${s.count} ta`,
                      highlight: i === 0,
                    }))}
                  />
                )}
              </div>

              {/* ---- Eng qiyin koʻnikmalar ---- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-3">
                  Eng qiyin IELTS koʻnikmalari
                </p>
                {data.hardestSkills.length === 0 ? (
                  <p className="text-xs text-gray-500">Maʼlumot hozircha yetarli emas.</p>
                ) : (
                  <>
                    <DnaBars
                      rows={data.hardestSkills.map((s, i) => ({
                        label: SKILL_UZ[s.skill],
                        value:
                          data.profiles > 0
                            ? Math.round((s.learners / data.profiles) * 100)
                            : null,
                        meta: `${s.learners} ta oʻquvchida eng past`,
                        highlight: i === 0,
                        color: i === 0 ? "#fbbf24" : undefined,
                      }))}
                    />
                    <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                      Koʻrsatkich — bu koʻnikma necha foiz oʻquvchida eng kuchsiz boʻlib chiqqani. Dars
                      rejasida qoʻshimcha vaqt ajratish kerak boʻlgan yoʻnalishni koʻrsatadi.
                    </p>
                  </>
                )}
              </div>

              {/* ---- Motivatsiya ---- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-averna-pink mb-3">
                  Motivatsiya tendensiyasi
                </p>
                <DnaBars
                  rows={[
                    {
                      label: "Ortib bormoqda",
                      value: pct(data.motivation.rising),
                      meta: `${data.motivation.rising} ta`,
                      color: "#00FF94",
                    },
                    {
                      label: "Barqaror",
                      value: pct(data.motivation.steady),
                      meta: `${data.motivation.steady} ta`,
                      color: "#00E5FF",
                    },
                    {
                      label: "Pasayib bormoqda",
                      value: pct(data.motivation.falling),
                      meta: `${data.motivation.falling} ta`,
                      color: "#fbbf24",
                    },
                  ]}
                />
                {data.motivation.falling > data.motivation.rising && (
                  <p className="text-[11px] text-amber-300/90 mt-2 leading-relaxed">
                    Diqqat: motivatsiyasi pasayayotgan oʻquvchilar ortib borayotganlardan koʻp. Oʻqituvchilar
                    bilan bu holatni muhokama qilish tavsiya etiladi.
                  </p>
                )}
              </div>

              {/* ---- Eng samarali vaqt ---- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-3">
                  Oʻquvchilar eng samarali ishlaydigan vaqt
                </p>
                {data.dayparts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Hali biror vaqt oraligʻi {data.kThreshold} ta oʻquvchida aniqlanmagan.
                  </p>
                ) : (
                  <>
                    <DnaBars
                      rows={data.dayparts.map((d, i) => ({
                        label: DAYPART_UZ[d.daypart],
                        value: d.share,
                        meta: `${d.count} ta`,
                        highlight: i === 0,
                      }))}
                    />
                    <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                      Dars jadvalini tuzishda foydali: koʻpchilik uchun eng samarali vaqtga eng ogʻir
                      mavzularni qoʻyish mumkin.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ---- Yetuklik tendensiyasi ---- */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-averna-purple" />
                <p className="text-xs font-semibold uppercase tracking-wider text-averna-purple">
                  Oʻquv yetukligining oʻsishi (soʻnggi 30 kun)
                </p>
              </div>
              <DnaTrendLine
                points={data.maturityTrend.map((p) => p.maturity)}
                stroke="#B14EFF"
                fill="rgba(177,78,255,0.14)"
                height={72}
              />
              {data.maturityTrend.length >= 2 ? (
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                  <span>{data.maturityTrend[0].dayKey}</span>
                  <span>{data.maturityTrend[data.maturityTrend.length - 1].dayKey}</span>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1">
                  Tendensiya uchun kamida bir necha kunlik maʼlumot kerak.
                </p>
              )}
            </div>
          </>
        )}

        <p className="text-[10px] text-gray-500 leading-relaxed">
          Barcha raqamlar kamida {data.kThreshold} ta oʻquvchini tavsiflaganda koʻrsatiladi. Aks holda ular
          yashiriladi — bu shaxsiy maʼlumot maxfiyligini taʼminlaydi.
        </p>
      </CardContent>
    </Card>
  );
}
