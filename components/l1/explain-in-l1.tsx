"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import type { L1Lang } from "@/lib/l1/hints";
import { L1_EXPLAIN_MAX_CHARS } from "@/lib/l1/explain-policy";
import { useL1Lang } from "./use-l1";

const BUTTON: Record<L1Lang, string> = { uz: "Explain in Oʻzbekcha", ru: "Объяснить по-русски" };
const DONE_LABEL: Record<L1Lang, string> = { uz: "Explanation in Uzbek", ru: "Explanation in Russian" };

type State =
  | { status: "idle" }
  | { status: "loading"; lang: L1Lang }
  | { status: "done"; lang: L1Lang; text: string }
  | { status: "error"; lang: L1Lang; message: string };

/**
 * "Explain in Oʻzbekcha" / "Объяснить по-русски" under a wrong answer's
 * explanation (result pages, hints on). The AI translation is requested on
 * demand from POST /api/l1/explain and shown under the English text; loading
 * and errors stay inline. Renders nothing when hints are off.
 */
export function ExplainInL1({ text }: { text?: string | null }) {
  const lang = useL1Lang();
  const [state, setState] = useState<State>({ status: "idle" });
  const source = text?.trim() ?? "";
  if (!lang || !source || source.length > L1_EXPLAIN_MAX_CHARS) return null;

  const current = state.status !== "idle" && state.lang === lang ? state : null;

  const run = async () => {
    setState({ status: "loading", lang });
    try {
      const res = await fetch("/api/l1/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: source, lang }),
      });
      const data = (await res.json().catch(() => null)) as { translation?: unknown; error?: unknown } | null;
      if (res.ok && typeof data?.translation === "string" && data.translation.trim()) {
        setState({ status: "done", lang, text: data.translation.trim() });
      } else {
        setState({
          status: "error",
          lang,
          message: typeof data?.error === "string" ? data.error : "The translation didn't come through. Try again in a moment.",
        });
      }
    } catch {
      setState({ status: "error", lang, message: "You seem to be offline. Try again when you're connected." });
    }
  };

  if (current?.status === "done") {
    return (
      <div role="note" aria-label={DONE_LABEL[lang]} className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-gray-200">
        <span aria-hidden="true" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {lang.toUpperCase()} · AI translation
        </span>
        <p lang={lang} className="whitespace-pre-line">
          {current.text}
        </p>
      </div>
    );
  }

  const loading = current?.status === "loading";
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        aria-busy={loading || undefined}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm font-semibold text-averna-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/60 disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Languages className="h-4 w-4" aria-hidden />}
        {loading ? "Translating…" : <span lang={lang === "ru" ? "ru" : undefined}>{BUTTON[lang]}</span>}
      </button>
      {current?.status === "error" && (
        <p role="alert" className="text-sm text-red-300">
          {current.message}
        </p>
      )}
    </div>
  );
}
