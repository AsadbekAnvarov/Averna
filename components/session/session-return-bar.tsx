"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SESSION_FROM_PARAM, SESSION_FROM_VALUE, SESSION_STEP_KEY } from "@/lib/session/daily-plan";

function readStep(): { step: number; total: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STEP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { step?: unknown; total?: unknown };
    const step = Number(v.step);
    const total = Number(v.total);
    return Number.isInteger(step) && Number.isInteger(total) && step >= 1 && step <= total && total <= 4 ? { step, total } : null;
  } catch {
    return null;
  }
}

/**
 * "Back to today's session" — a slim bar on any page opened from the Daily
 * Session (links carry `?from=session`). Mounted once in the app shell; renders
 * nothing when the param is absent. In the page flow (not fixed), so it never
 * covers exam controls.
 */
export function SessionReturnBar() {
  const params = useSearchParams();
  const pathname = usePathname();
  const active = params?.get(SESSION_FROM_PARAM) === SESSION_FROM_VALUE && pathname !== "/dashboard";
  const [step, setStep] = useState<{ step: number; total: number } | null>(null);

  useEffect(() => {
    setStep(active ? readStep() : null);
  }, [active, pathname]);

  if (!active) return null;
  return (
    <nav aria-label="Today's session" data-testid="session-return-bar" className="border-b border-averna-neon/20 bg-averna-neon/[0.06] px-3 sm:px-4">
      <Link
        href="/dashboard"
        className="mx-auto flex min-h-11 max-w-6xl items-center gap-2 text-sm text-gray-200 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        <span className="truncate">
          Today&apos;s session{step ? ` · step ${step.step} of ${step.total}` : ""}
        </span>
        <span className="ml-auto font-semibold text-averna-neon">Back</span>
      </Link>
    </nav>
  );
}
