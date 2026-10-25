"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExamShell } from "@/components/exam/exam-shell";
import { Textarea } from "@/components/ui/textarea";



import { toast } from "@/components/ui/toast";
import { Task1Chart } from "@/components/learning/task1-chart";
import { formatDateTime } from "@/lib/utils";
import { AccountDraftPanel, useAccountDraft } from "./account-draft-panel";
import type { Task1ChartData } from "@/lib/writing-data";

interface WritingEditorProps {
  prompt: {
    id: string;
    title: string;
    prompt: string;
    type: string;
    imageUrl?: string;
    chart?: Task1ChartData[];
  };
  config: {
    title: string;
    timeLimit: number;
    wordCount: number;
    type: string;
  };
  userId: string;
  cloudDraftsEnabled?: boolean;
  /** This essay completes exam homework (sent with the submission; the server re-validates it). */
  homework?: { id: string; title: string; due: string; /** e.g. "Your first attempt with at least 120 words on the task counts." */ rule?: string };
}

export default function WritingEditor({ prompt, config, userId, homework, cloudDraftsEnabled = false }: WritingEditorProps) {
  const router = useRouter();
  const [fontScale, setFontScale] = useState(1);
  const [essay, setEssay] = useState("");
  const [timeLeft, setTimeLeft] = useState(config.timeLimit * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  // One id per attempt → retried submissions can't double-award XP.
  const attemptIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `a-${Date.now()}`
  );

  const draftKey = `averna_writing_draft_v1:${userId}:${prompt.id}:${homework?.id ?? "practice"}`;
  const submittedRef = useRef(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Draft saves on this device");
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft && typeof draft.essay === "string") {
        setEssay(draft.essay.slice(0, 20000));
        setIsTimerRunning(draft.essay.trim().length > 0);
        if (typeof draft.attemptId === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(draft.attemptId)) attemptIdRef.current = draft.attemptId;
        if (typeof draft.timeLeft === "number" && Number.isFinite(draft.timeLeft)) setTimeLeft(Math.floor(Math.max(0, Math.min(config.timeLimit * 60, draft.timeLeft))));
        setDraftStatus("Draft restored from this device");
      }
    } catch { setDraftStatus("Local draft could not be restored"); }
    setDraftLoaded(true);
  }, [draftKey, config.timeLimit]);
  useEffect(() => {
    if (!draftLoaded || isSubmitting || submittedRef.current) return;
    const id = window.setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ essay, timeLeft, attemptId: attemptIdRef.current })); setDraftStatus("Draft saved on this device"); }
      catch { setDraftStatus("Local saving unavailable — keep this tab open"); }
    }, 400);
    return () => window.clearTimeout(id);
  }, [draftKey, draftLoaded, essay, timeLeft, isSubmitting]);

  useEffect(() => {
    if (!draftLoaded) return;
    const saveBeforeLeaving = () => {
      if (submittedRef.current) return;
      try { localStorage.setItem(draftKey, JSON.stringify({ essay, timeLeft, attemptId: attemptIdRef.current })); } catch {}
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    return () => window.removeEventListener("pagehide", saveBeforeLeaving);
  }, [draftKey, draftLoaded, essay, timeLeft]);

  const accountDraft = useAccountDraft({
    enabled: cloudDraftsEnabled && draftLoaded && !homework,
    taskType: config.type, promptId: prompt.id, essay, timeLeft,
    attemptId: attemptIdRef.current,
    restore: (copy) => {
      setIsTimerRunning(false);
      attemptIdRef.current = copy.attemptId;
      setEssay(copy.essay);
      setTimeLeft(Math.min(config.timeLimit * 60, copy.timeLeft));
      setDraftStatus("Account copy restored; saving to this device");
    },
  });

  // Calculate word count
  useEffect(() => {
    const words = essay.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
  }, [essay]);

  // Timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timeLeft]);

  // Format time display
  // Start timer on first character
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEssay(value);
    
    if (!isTimerRunning && value.length > 0) {
      setIsTimerRunning(true);
    }
  };

  // Submit essay
  const handleSubmit = async () => {
    // Validate word count
    if (wordCount < config.wordCount) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    setShowWarning(false);

    try {
      const response = await fetch("/api/learning/writing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay,
          taskType: config.type,
          prompt: prompt.prompt,
          timeSpent: (config.timeLimit * 60) - timeLeft,
          // Makes a retried submission idempotent (no double XP).
          submissionId: attemptIdRef.current,
          promptId: prompt.id,
          ...(homework ? { homeworkId: homework.id } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "");
      }

      const data = await response.json();

      submittedRef.current = true;
      accountDraft.clearSubmitted(attemptIdRef.current);
      try { localStorage.removeItem(draftKey); } catch {}
      // Redirect to results page
      router.push(`/learning/writing/result/${data.testId}`);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(
        (error instanceof Error && error.message) ||
          "Your essay wasn't submitted. Your text is still here — check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const taskNumber = config.type === "task1" ? 1 : 2;
  return (
    <ExamShell
      title="Averna CDI · Writing"
      itemLabel="tasks"
      reviewDescription={`Task ${taskNumber}: ${wordCount} words. Check your answer before submitting. The recommended minimum is ${config.wordCount} words.`}
      subtitle={`${prompt.title} · Task ${taskNumber} only · ${config.timeLimit} minutes`}
      remainingMs={timeLeft * 1000}
      parts={[{title: `Task ${taskNumber}`, numbers: [taskNumber]}]}
      activePart={0} onPartChange={() => {}}
      answered={new Set(essay.trim() ? [taskNumber] : [])} flagged={new Set()}
      current={taskNumber} onJump={() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Your essay"]')?.focus()}
      fontScale={fontScale} onFontScale={setFontScale}
      left={<div className="mx-auto max-w-3xl p-4 sm:p-6" style={{fontSize: `${fontScale}rem`}}>
        <h2 className="text-lg font-semibold text-white">Writing Task {taskNumber}</h2>
        <p className="mt-3 text-gray-300">You should spend about {config.timeLimit} minutes on this task.</p>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-gray-200">{prompt.prompt}</p>
        {/* Original supplied image: avoid transformations of exam diagrams. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {prompt.imageUrl && <img src={prompt.imageUrl} alt="Original Task 1 diagram" className="mt-5 h-auto w-full rounded-lg border border-white/15 bg-white" />}
        {prompt.chart && <Task1Chart charts={prompt.chart} />}
        <p className="mt-4 text-gray-300">Write at least {config.wordCount} words.</p>
        {homework && <p className="mt-4 text-sm text-gray-300">Homework: {homework.title} · {formatDateTime(homework.due)}. {homework.rule}</p>}
      </div>}
      leftLabel={`Task ${taskNumber}`} rightLabel="Your answer"
      footerExtra={<p role="status" className="px-4 py-2 text-sm text-gray-300">Words: {wordCount} · {draftStatus}. {isTimerRunning ? "Practice timer running" : "Timer starts when you begin writing"}</p>}
      onSubmit={handleSubmit} submitting={isSubmitting} submitLabel="Submit" exitHref={homework ? "/homework" : `/learning/writing/${config.type}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Your answer · Task {taskNumber}</h2>
        {showWarning && <p role="alert" className="text-sm text-red-400">Write at least {config.wordCount} words before submitting. Current: {wordCount}.</p>}
        {timeLeft === 0 && <p role="status" className="text-sm text-amber-300">Time is up. This is practice: you can still submit for feedback.</p>}
        <Textarea value={essay} onChange={handleTextChange} placeholder="Write your answer here…" aria-label="Your essay" spellCheck={false} autoCorrect="off" autoCapitalize="off" className="min-h-[500px] resize-y border-white/20 bg-exam-bg leading-relaxed" style={{fontSize: `${fontScale}rem`}} disabled={isSubmitting} />
        <AccountDraftPanel draft={accountDraft} disabled={isSubmitting} />
      </div>
    </ExamShell>
  );
}
