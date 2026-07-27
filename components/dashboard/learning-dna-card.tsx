import Link from "next/link";
import { ArrowRight, Dna, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLearningDna } from "@/lib/engine/learning-dna";

/**
 * Compact Learning DNA teaser for the student dashboard.
 *
 * Shows the four headline traits plus the single strongest insight, then links to
 * the full page. Deliberately small: the dashboard's job is to make the student
 * aware the engine has learned something new about them, not to duplicate the
 * Learning DNA page.
 *
 * When nothing is established yet it says so honestly and explains what unlocks
 * it — the same rule as everywhere else in this feature.
 */
export async function LearningDnaCard({ studentId }: { studentId: string }) {
  try {
    const profile = await getLearningDna(studentId);
    const top = profile.insights[0];

    const traits: { label: string; value: string | null }[] = [
      { label: "Learning style", value: profile.style.label },
      {
        label: "Focus window",
        value: profile.focus.idealLessonMin != null ? `${profile.focus.idealLessonMin} min` : null,
      },
      {
        label: "Best time",
        value:
          profile.timing.optimalHourStart != null && profile.timing.optimalHourEnd != null
            ? `${String(profile.timing.optimalHourStart).padStart(2, "0")}:00–${String(profile.timing.optimalHourEnd).padStart(2, "0")}:00`
            : null,
      },
      {
        label: "Retention",
        value: profile.retention.value != null ? `${profile.retention.value}%` : null,
      },
    ];

    const established = traits.filter((t) => t.value != null).length;

    return (
      <Card className="glass border-averna-purple/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-averna-purple">
              <Dna className="h-5 w-5" /> Learning DNA
            </span>
            <span className="text-xs font-normal text-gray-400">
              maturity {profile.maturity.value ?? 0}/100
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {traits.map((trait) => (
              <div key={trait.label} className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 truncate">
                  {trait.label}
                </p>
                <p
                  className={`text-sm font-semibold leading-snug ${
                    trait.value != null ? "text-white" : "text-gray-500"
                  }`}
                >
                  {trait.value ?? "Forming…"}
                </p>
              </div>
            ))}
          </div>

          {top ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-averna-neon/25 bg-averna-neon/5 p-3">
              <Lightbulb className="h-4 w-4 text-averna-neon shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-snug">{top.title}</p>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed line-clamp-2">{top.text}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 leading-relaxed">
              {established === 0
                ? "Keep practising — after a few varied, timed sessions this profile will start telling you how you learn best."
                : "Your profile is forming. Insights appear as soon as there's enough evidence to back one up."}
            </p>
          )}

          <Link
            href="/learning-dna"
            className="inline-flex items-center gap-1.5 text-sm text-averna-purple hover:text-white transition-colors"
          >
            Open your full Learning DNA
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  } catch {
    return null; // never break the dashboard for a teaser
  }
}
