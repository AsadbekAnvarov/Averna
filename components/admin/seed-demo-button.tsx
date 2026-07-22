"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Database, Loader2, CheckCircle2 } from "lucide-react";

/**
 * One-click demo data loader for a fresh install. Hits the idempotent /api/seed
 * endpoint so the dashboards immediately have realistic groups, students,
 * homework and payments to render — no more empty, "meaningless" screens.
 */
export function SeedDemoButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const run = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/seed");
      if (!res.ok) throw new Error("seed failed");
      setStatus("done");
      setTimeout(() => router.refresh(), 800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={run}
        disabled={status === "loading"}
        size="sm"
        variant="outline"
        className="border-averna-cyan/40 text-averna-cyan"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yuklanmoqda…
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Bajarildi!
          </>
        ) : (
          <>
            <Database className="mr-2 h-4 w-4" /> Demo maʼlumot yuklash
          </>
        )}
      </Button>
      {status === "error" && <span className="text-xs text-red-400">Xatolik — qayta urining.</span>}
    </div>
  );
}
