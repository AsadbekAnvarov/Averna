"use client";

import { useContext, useEffect, useState } from "react";
import { SessionContext } from "next-auth/react";
import { useComfortPrefs } from "@/components/comfort/use-comfort-prefs";
import type { L1Lang } from "@/lib/l1/hints";
import { shouldShowL1Hints } from "@/lib/l1/level";

/**
 * The student's level, fetched at most once per page load and only when hints
 * are on with "At my level" (GET /api/profile already returns it). A failed
 * request counts as unknown, which shows hints.
 */
let levelRequest: Promise<string | null> | null = null;

function studentLevel(): Promise<string | null> {
  levelRequest ??= fetch("/api/profile", { credentials: "same-origin", headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { level?: unknown } | null) => (typeof d?.level === "string" && d.level.trim() ? d.level : null))
    .catch(() => null);
  return levelRequest;
}

/** Settings already has the level from the server: skip the request there. */
export function primeStudentLevel(level: string | null | undefined): void {
  levelRequest = Promise.resolve(typeof level === "string" && level.trim() ? level : null);
}

/**
 * "uz" / "ru" when this student should see native-language hints right now,
 * otherwise null — including on the server, before the prefs and session are
 * known, for teachers and admins, and outside a SessionProvider (so a hint never
 * shifts the layout for students with hints off).
 */
export function useL1Lang(): L1Lang | null {
  const { prefs } = useComfortPrefs();
  const session = useContext(SessionContext);
  const isStudent = (session?.data?.user as { role?: string } | undefined)?.role === "STUDENT";
  const needsLevel = !!prefs && prefs.l1 !== "off" && prefs.l1When === "level" && isStudent;
  const [level, setLevel] = useState<{ value: string | null } | null>(null);

  useEffect(() => {
    if (!needsLevel) return;
    let live = true;
    void studentLevel().then((value) => {
      if (live) setLevel({ value });
    });
    return () => {
      live = false;
    };
  }, [needsLevel]);

  if (!prefs || !isStudent || prefs.l1 === "off") return null;
  if (prefs.l1When === "level" && !level) return null;
  return shouldShowL1Hints(prefs, level?.value ?? null) ? prefs.l1 : null;
}
