"use client";

import { useEffect, useState } from "react";
import { normalizeUsername, usernameProblem, type UsernameMessageCode } from "@/lib/account/username-rules";

export type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; username: string }
  | { state: "unavailable"; code: UsernameMessageCode }
  /** The server couldn't be asked (busy / offline): the form may still submit — the save itself decides. */
  | { state: "unverified"; code: UsernameMessageCode };

/**
 * Live availability of a username while it is typed: the rules are checked at
 * once, the server (GET /api/account/username/check) 400 ms after typing stops.
 * `same`: the user's current username — shown as available without asking.
 * Only a rule problem or "taken" blocks the form; when the check itself fails
 * (rate limit, network) the status is "unverified" and the sign-up / save
 * request gives the real answer (409 when taken).
 */
export function useUsernameCheck(value: string, opts: { same?: string | null; allowReserved?: boolean } = {}): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" });
  const { same, allowReserved } = opts;

  useEffect(() => {
    const u = normalizeUsername(value);
    if (!u) {
      setStatus({ state: "idle" });
      return;
    }
    const problem = usernameProblem(u, { allowReserved });
    if (problem) {
      setStatus({ state: "unavailable", code: problem });
      return;
    }
    if (same && u === same) {
      setStatus({ state: "available", username: u });
      return;
    }
    setStatus({ state: "checking" });
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/account/username/check?u=${encodeURIComponent(u)}`, { signal: ctrl.signal, cache: "no-store" });
        const body = (await res.json().catch(() => null)) as { available?: boolean; code?: UsernameMessageCode } | null;
        if (ctrl.signal.aborted) return;
        if (body?.available) setStatus({ state: "available", username: u });
        else if (res.ok && body?.code && body.code !== "server" && body.code !== "too_many") setStatus({ state: "unavailable", code: body.code });
        else setStatus({ state: "unverified", code: body?.code === "too_many" ? "too_many" : "server" });
      } catch {
        if (!ctrl.signal.aborted) setStatus({ state: "unverified", code: "server" });
      }
    }, 400);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [value, same, allowReserved]);

  return status;
}
