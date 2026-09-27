import { rawNeededFor } from "@/lib/ielts/bands";

const BANDS = [5.5, 6, 6.5, 7, 7.5, 8];

/** Compact raw-score → band guide for the Reading / Listening libraries. */
export function ScoreGuide({ skill }: { skill: "READING" | "LISTENING" }) {
  const rows = BANDS.map((band) => ({ band, raw: rawNeededFor(band, skill) })).filter(
    (r): r is { band: number; raw: number } => r.raw != null
  );
  if (!rows.length) return null;
  const id = `score-guide-${skill.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="av-panel rounded-2xl p-5 sm:p-6">
      <h2 id={id} className="text-base font-semibold text-white">
        From raw score to band
      </h2>
      <p className="mt-1 text-xs text-gray-400">
        Correct answers out of 40 you typically need for each {skill === "READING" ? "Academic Reading" : "Listening"} band.
        Short practice is scaled to 40.
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {rows.map((r) => (
          <div key={r.band} className="rounded-xl border border-white/5 bg-white/[0.03] px-2 py-2.5 text-center">
            <dt className="text-[11px] uppercase tracking-wider text-gray-500">Band {r.band.toFixed(1)}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">
              {r.raw}
              <span className="text-xs font-normal text-gray-500">/40</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
