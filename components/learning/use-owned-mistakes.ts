"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { parseMistake } from "@/lib/mistakes/rules";
export interface PracticeMistake {
  id: string;
  wrong: string;
  right: string;
  note?: string;
}
const EMPTY: PracticeMistake[] = [];
/** Games consume the same owner-scoped correction content, never the legacy shared browser key. */
export function useOwnedMistakes() {
  const { data, status } = useSession();
  const owner = data?.user?.id ?? "";
  const [snapshot, setSnapshot] = useState<{
    owner: string;
    items: PracticeMistake[];
    loading: boolean;
  }>({ owner: "", items: EMPTY, loading: true });
  useEffect(() => {
    if (!owner) {
      setSnapshot({ owner: "", items: EMPTY, loading: status === "loading" });
      return;
    }
    const controller = new AbortController();
    const clean = (raw: unknown): PracticeMistake[] =>
      Array.isArray(raw)
        ? raw
            .map(parseMistake)
            .filter((c) => c !== null)
            .map((c) => ({
              id: c.id,
              wrong: c.wrong,
              right: c.right,
              note: c.note ?? undefined,
            }))
        : EMPTY;
    let cached = EMPTY;
    try {
      cached = clean(
        JSON.parse(localStorage.getItem(`averna_mistakes_v2:${owner}`) || "[]"),
      );
    } catch {}
    setSnapshot({ owner, items: cached, loading: true });
    fetch("/api/mistakes", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Correction sync unavailable");
        const result = await response.json();
        if (!controller.signal.aborted)
          setSnapshot({ owner, items: clean(result.items), loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setSnapshot({ owner, items: cached, loading: false });
      });
    return () => controller.abort();
  }, [owner, status]);
  return {
    owner,
    items: snapshot.owner === owner ? snapshot.items : EMPTY,
    loading:
      status === "loading" || owner !== snapshot.owner || snapshot.loading,
  };
}
