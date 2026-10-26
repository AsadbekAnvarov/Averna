"use client";

import { useId, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { PeerCoachResult } from "@/lib/ai";

/**
 * Opt-in AI coach on the done screen (docs/peer-speaking.md, Phase C): only when AI is
 * configured and the student had captions on. Explicit consent first; the captions
 * transcript (own words only) is sent once and never stored.
 */

export const COACH_CONSENT =
  "Your captions transcript (your words only) is sent to our AI provider to give feedback. Nothing of your partner is sent.";

const btn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const band = (n: number) => n.toFixed(1);

interface Props {
  roomId: string;
  transcript: string;
  stats: { words: number; wpm: number | null; fillers: number };
}

export function PeerCoach({ roomId, transcript, stats }: Props) {
  const [step, setStep] = useState<"idle" | "consent" | "sending" | "done">("idle");
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<PeerCoachResult | null>(null);
  const [error, setError] = useState("");
  const consentId = useId();

  const send = async () => {
    if (!agreed) return;
    setStep("sending");
    setError("");
    try {
      const res = await fetch("/api/speaking/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, consent: true, transcript: transcript.slice(-6000), stats }),
      });
      const d = (await res.json().catch(() => ({}))) as Partial<PeerCoachResult> & { error?: string };
      if (res.ok && d.bandEstimate) {
        setResult(d as PeerCoachResult);
        setStep("done");
      } else {
        setError(d.error || "The AI coach couldn't answer this time. Try again later.");
        setStep("consent");
      }
    } catch {
      setError("Connection problem. Try again later.");
      setStep("consent");
    }
  };

  return (
    <section aria-label="AI coach" className="rounded-xl border border-averna-purple/30 bg-averna-purple/5 p-4">
      {step === "idle" && (
        <button type="button" onClick={() => setStep("consent")} className={`${btn} border border-averna-purple/50 text-white hover:bg-averna-purple/10`}>
          <Sparkles className="h-4 w-4 text-averna-purple" aria-hidden /> Get AI feedback on your own speaking
        </button>
      )}
      {(step === "consent" || step === "sending") && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">AI feedback on your own speaking</p>
          <p className="text-sm text-gray-300">{COACH_CONSENT}</p>
          <label htmlFor={consentId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-white">
            <input id={consentId} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-averna-purple" />
            I agree to send my captions transcript
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void send()} disabled={!agreed || step === "sending"} className={`${btn} bg-averna-primary text-white`}>
              {step === "sending" && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />} Get feedback
            </button>
            <button type="button" onClick={() => setStep("idle")} disabled={step === "sending"} className={`${btn} border border-white/20 text-white`}>
              Not now
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      )}
      {step === "done" && result && (
        <div className="space-y-3 text-sm">
          <p className="text-base font-semibold text-white">
            Estimated band {band(result.bandEstimate.low)}–{band(result.bandEstimate.high)}
            <span className="ml-2 text-xs font-normal text-gray-400">An estimate from your captions, not an official score.</span>
          </p>
          <div>
            <h3 className="font-semibold text-white">What went well</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-200">
              {result.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white">Try this next time</h3>
            <ul className="mt-1 space-y-2">
              {result.improvements.map((i) => (
                <li key={i.point} className="rounded-lg border border-white/10 p-2">
                  <p className="text-white">{i.point}</p>
                  {i.original && <p className="mt-1 text-gray-400">You said: “{i.original}”</p>}
                  <p className="mt-0.5 text-averna-neon">Better: “{i.rewrite}”</p>
                </li>
              ))}
            </ul>
          </div>
          {result.vocabularyUpgrades.length > 0 && (
            <div>
              <h3 className="font-semibold text-white">Vocabulary upgrades</h3>
              <ul className="mt-1 space-y-1 text-gray-200">
                {result.vocabularyUpgrades.map((v) => (
                  <li key={`${v.instead}-${v.try}`}>
                    Instead of “{v.instead}”, try “{v.try}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
