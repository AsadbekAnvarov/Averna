"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Headphones } from "lucide-react";
import { QuestionGroupView } from "@/components/exam/question-group";
import type { ExamAnswers } from "@/lib/ielts/types";
import type { ListeningPack } from "@/lib/offline/packs";
import { readPackFile, updatePack } from "@/lib/offline/store";
import { useOnline } from "./use-offline";

/**
 * A saved Listening part with no connection (idea 7): the recording plays from the device
 * (a blob: URL, so seeking works without a network or the service worker) and the questions
 * can be answered. Answers are kept with the pack but not marked: the answer key never
 * reaches the browser, so marking needs the part online.
 */
export function OfflineListen({ pack, onBack }: { pack: ListeningPack; onBack: () => void }) {
  const online = useOnline();
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [answers, setAnswers] = useState<ExamAnswers>(pack.answers ?? {});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void readPackFile(pack.audio.file).then((blob) => {
      if (!alive) return;
      if (!blob) return setMissing(true);
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pack.audio.file]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const onAnswer = (n: number, value: string | string[]) => {
    setAnswers((prev) => {
      const next = { ...prev, [String(n)]: value };
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void updatePack({ ...pack, answers: next }), 600);
      return next;
    });
  };
  const onToggleFlag = (n: number) =>
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const onlineHref = `/learning/listening/${encodeURIComponent(pack.testId)}?part=${pack.partIndex}`;

  return (
    <section aria-labelledby="offline-listen-title">
      <button type="button" onClick={onBack} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-sm font-medium text-gray-300 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Saved on this device
      </button>
      <h1 id="offline-listen-title" className="flex items-start gap-3 text-2xl font-bold text-white">
        <Headphones className="mt-1 h-6 w-6 shrink-0 text-averna-purple" aria-hidden />
        {pack.title}
      </h1>
      {pack.context && <p className="mt-2 text-sm text-gray-300">{pack.context}</p>}

      <div className="glass mt-4 rounded-2xl border border-white/10 p-4">
        {missing ? (
          <p role="alert" className="text-sm text-gray-200">This part&apos;s saved recording is missing. Remove it and save it again when you&apos;re online.</p>
        ) : src ? (
          // No captions: the transcript is never sent to the browser (it holds the answers).
          <audio controls preload="metadata" src={src} className="w-full" aria-label={`${pack.title} recording`} />
        ) : (
          <p role="status" className="text-sm text-gray-400">Loading the recording…</p>
        )}
        <p className="mt-3 text-sm text-gray-400">
          Answers aren&apos;t marked offline. {online ? (
            <a href={onlineHref} className="inline-flex min-h-11 items-center font-semibold text-averna-cyan hover:underline">Open this part online to check them</a>
          ) : (
            "Open this part online to check them."
          )}
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {pack.groups.map((group, i) => (
          <QuestionGroupView
            key={`${group.kind}-${group.questions[0]?.n ?? i}`}
            group={group}
            skill="LISTENING"
            answers={answers}
            onAnswer={onAnswer}
            flagged={flagged}
            onToggleFlag={onToggleFlag}
          />
        ))}
      </div>
    </section>
  );
}
