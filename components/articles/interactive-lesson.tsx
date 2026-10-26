"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { applyLessonWrite, isAllowedLessonMessage, LESSON_NS, LESSON_SANDBOX, parseLessonMessage, readLessonItems } from "@/lib/articles/lesson-bridge";

/** How long to wait for the lesson frame's first message before offering Retry. */
export const LESSON_LOAD_TIMEOUT_MS = 10_000;

type Props = {
  lesson: { slug: string; title: string; topic: string };
  /** The signed-in student: lesson progress is kept per student on shared devices. */
  userId: string;
  /** Another document URL for the frame (the offline library's saved copy, a blob: URL). */
  src?: string;
  /** Replaces the "Back to Articles" link (the offline library goes back to its list). */
  onBack?: () => void;
  /** Extra controls at the end of the top bar (e.g. Save for offline). */
  actions?: ReactNode;
};

/**
 * An interactive Intermediate lesson, full screen. The supplied file runs unchanged in a
 * sandboxed, opaque-origin frame (no allow-same-origin: it can't read the app's cookies
 * or storage). Its localStorage calls arrive here as messages and are kept in the app's
 * localStorage under `averna_lesson:{userId}:{key}` (lib/articles/lesson-bridge.ts).
 */
export function InteractiveLesson({ lesson, userId, src, onBack, actions }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const helloRef = useRef(false);
  const { mode } = useTheme();
  const modeRef = useRef(mode);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Full-screen view: the page behind doesn't scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = frameRef.current?.contentWindow;
      if (!frame || !isAllowedLessonMessage(event, frame)) return;
      const message = parseLessonMessage(event.data);
      if (!message) return;
      if (message.type === "hello") {
        helloRef.current = true;
        setStatus(s => (s === "error" ? "loading" : s));
        let items: Record<string, string> = {};
        try {
          items = readLessonItems(window.localStorage, userId);
        } catch {
          // Storage blocked: the lesson starts fresh.
        }
        // "*": the frame's origin is opaque and can't be named. The payload is only lesson progress.
        frame.postMessage({ ns: LESSON_NS, type: "state", items, theme: modeRef.current }, "*");
      } else if (message.type === "ready") {
        setStatus("ready");
      } else {
        try {
          applyLessonWrite(window.localStorage, userId, message);
        } catch {
          // Storage blocked: progress lasts for this visit only.
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [userId]);

  // Each (re)load of the frame: offer Retry if it never says hello.
  useEffect(() => {
    helloRef.current = false;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      if (!helloRef.current) setStatus("error");
    }, LESSON_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  // The app's light/dark theme follows into the lesson (its own toggle keeps working too).
  useEffect(() => {
    modeRef.current = mode;
    frameRef.current?.contentWindow?.postMessage({ ns: LESSON_NS, type: "theme", theme: mode }, "*");
  }, [mode]);

  return (
    <div className="article-space interactive-lesson fixed inset-0 z-[60] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <header className="interactive-lesson-bar flex shrink-0 items-center gap-2 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:gap-4 sm:px-5">
        {onBack ? (
          <button type="button" onClick={onBack} className="interactive-lesson-back inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Saved lessons</span>
          </button>
        ) : (
          <Link href="/article?level=Intermediate" className="interactive-lesson-back inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back to Articles</span>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight">{lesson.title}</h1>
          <p className="article-muted truncate text-xs leading-tight">Intermediate · {lesson.topic}</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <iframe
          key={attempt}
          ref={frameRef}
          title={`${lesson.title} — interactive lesson`}
          src={src ?? `/api/articles/lesson/${encodeURIComponent(lesson.slug)}`}
          sandbox={LESSON_SANDBOX}
          allow="clipboard-write *; web-share *; autoplay *"
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0"
        />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background p-6">
            {status === "loading" ? (
              <p role="status" className="article-muted inline-flex items-center gap-2 text-sm">
                <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" /> Loading lesson…
              </p>
            ) : (
              <div role="alert" className="article-card max-w-sm text-center">
                <p>This lesson could not be loaded. Check your connection and try again.</p>
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="interactive-lesson-retry mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-semibold">
                  <RotateCcw size={16} aria-hidden="true" /> Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
