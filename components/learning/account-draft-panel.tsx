"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DraftSnapshot, DraftWrite } from "@/lib/writing-drafts/rules";
const parseSnapshot = (raw: unknown): DraftSnapshot | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as DraftSnapshot;
  return typeof r.essay === "string" && r.essay.length <= 20000 && typeof r.attemptId === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(r.attemptId)
    && Number.isInteger(r.version) && r.version >= 1 && Number.isInteger(r.timeLeft) && r.timeLeft >= 0 && r.timeLeft <= 2400 && typeof r.updatedAt === "string" && Number.isFinite(new Date(r.updatedAt).getTime()) ? r : null;
};
export function useAccountDraft({ enabled, taskType, promptId, essay, attemptId, timeLeft, restore }: {
  enabled: boolean; taskType: string; promptId: string; essay: string; attemptId: string; timeLeft: number;
  restore: (draft: DraftSnapshot) => void;
}) {
  const [remote, setRemote] = useState<DraftSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking for an account copy…");
  const [compare, setCompare] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const latest = useRef({ essay, attemptId, timeLeft });
  latest.current = { essay, attemptId, timeLeft };
  const request = useCallback(async (method: string, payload?: DraftWrite) => {
    const activeGeneration = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const query = new URLSearchParams({ taskType, promptId });
      const response = await fetch(`/api/learning/writing/draft?${query}`, { method, cache: "no-store", signal: controller.signal,
        ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (mounted.current && activeGeneration === generation.current && [401, 403, 404].includes(response.status)) { setRemote(null); setBlocked(true); }
        throw Object.assign(new Error(data.error || "Account saving unavailable. Keep your local copy and retry."), { status: response.status });
      }
      const draft = data.draft == null ? null : parseSnapshot(data.draft);
      if (data.draft != null && !draft) throw new Error("The account copy could not be read. Your device text is unchanged.");
      return draft;
    } finally { window.clearTimeout(timer); controllers.current.delete(controller); }
  }, [taskType, promptId]);
  const reload = useCallback(async () => {
    if (lock.current) return;
    const activeGeneration = generation.current;
    lock.current = true; setBusy(true);
    try {
      const copy = await request("GET");
      if (mounted.current && activeGeneration === generation.current) { setRemote(copy); setReady(true); setConfirmed(false); setMessage(copy?.essay ? "Account copy found. Loading it is your choice; your device text has not changed." : "No saved account text yet. Save when you are ready."); }
    } catch (error) {
      if (mounted.current && activeGeneration === generation.current) setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "Connection timed out. Your device text is unchanged; retry.");
    } finally { if (activeGeneration === generation.current) { lock.current = false; if (mounted.current) setBusy(false); } }
  }, [request]);
  useEffect(() => {
    mounted.current = true;
    if (enabled) void reload();
    const active = controllers.current;
    const effectGeneration = generation.current;
    return () => { mounted.current = false; generation.current = effectGeneration + 1; lock.current = false; for (const controller of active) controller.abort(); };
  }, [enabled, reload]);
  const different = !!remote?.essay && (remote.essay !== essay || remote.attemptId !== attemptId);
  const save = async () => {
    if (lock.current || !ready || blocked || (different && !confirmed)) return;
    const activeGeneration = generation.current;
    lock.current = true; setBusy(true);
    const input = { ...latest.current, taskType: taskType as "task1" | "task2", promptId, version: remote?.version ?? 0 };
    try {
      const copy = await request("PUT", input);
      if (mounted.current && activeGeneration === generation.current) { setRemote(copy); setConfirmed(false); setCompare(false); setMessage("Account copy saved. Further typing stays on this device until you save again."); }
    } catch (error) {
      if (mounted.current && activeGeneration === generation.current) {
        if ((error as { status?: number }).status === 409) { setReady(false); setConfirmed(false); setCompare(true); }
        setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "Connection timed out. A save may have completed; reload the account copy before retrying.");
      }
    } finally { if (activeGeneration === generation.current) { lock.current = false; if (mounted.current) setBusy(false); } }
  };
  const load = () => {
    if (!remote || busy || blocked || (essay.trim() && !confirmed)) return;
    restore(remote); setConfirmed(false); setCompare(false);
    setMessage("Account copy loaded onto this device. The practice timer is paused.");
  };
  // Never remove another device's newer revision. Cleanup is best effort after server acknowledgement.
  const clearSubmitted = (submittedId: string) => {
    if (!enabled || !remote || remote.attemptId !== submittedId) return;
    void fetch("/api/learning/writing/draft", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType, promptId, essay: "", timeLeft: 0, attemptId: submittedId, version: remote.version }), signal: AbortSignal.timeout(5000) }).catch(() => {});
  };
  return { enabled, remote, ready, busy, blocked, message, compare, different, confirmed, setConfirmed, setCompare, reload, save, load, clearSubmitted, hasDeviceText: !!essay.trim() };
}
export function AccountDraftPanel({ draft, disabled }: { draft: ReturnType<typeof useAccountDraft>; disabled: boolean }) {
  if (!draft.enabled) return null;
  const controlsDisabled = disabled || draft.busy || draft.blocked;
  return <section aria-labelledby="account-draft-heading" className="min-w-0 rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
    <h2 id="account-draft-heading" className="font-semibold text-white">Continue on another device</h2>
    <p className="text-sm leading-relaxed text-gray-300">Device saving is automatic. Account saving is explicit and private to you; it never submits or grades your essay.</p>
    <p role="status" className="text-sm leading-relaxed text-gray-300">{draft.message}</p>
    {draft.remote?.essay && <p className="text-sm text-gray-300">Account revision {draft.remote.version} · {new Date(draft.remote.updatedAt).toLocaleString()}</p>}
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button type="button" className="min-h-11 h-auto whitespace-normal py-3" disabled={controlsDisabled || !draft.ready || (draft.different && !draft.confirmed)} onClick={() => void draft.save()}>Save to account</Button>
      <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal py-3" disabled={controlsDisabled} onClick={() => void draft.reload()}>Reload account copy</Button>
      {!!draft.remote?.essay && <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal py-3" disabled={controlsDisabled} aria-expanded={draft.compare} onClick={() => { draft.setCompare(!draft.compare); draft.setConfirmed(false); }}>Compare / restore</Button>}
    </div>
    {draft.different && !draft.compare && <p className="text-sm text-gray-300">The two copies differ. Compare them before replacing either one.</p>}
    {draft.compare && draft.remote?.essay && <div className="space-y-3">
      <label className="block text-sm text-gray-300" htmlFor="account-draft-preview">Account copy (read-only)</label>
      <textarea id="account-draft-preview" readOnly value={draft.remote.essay} className="w-full min-w-0 min-h-40 resize-y rounded-lg border border-white/20 bg-background px-3 py-3 text-base leading-relaxed text-white" />
      <label className="flex min-h-11 items-start gap-3 py-2 text-sm leading-relaxed text-gray-300">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.confirmed} onChange={e => draft.setConfirmed(e.target.checked)} disabled={controlsDisabled} />
        <span>I compared both copies. I understand that loading replaces this device text, while saving replaces the account text.</span>
      </label>
      <Button type="button" variant="outline" className="w-full min-h-11 h-auto whitespace-normal py-3 sm:w-auto" onClick={draft.load} disabled={controlsDisabled || (draft.hasDeviceText && !draft.confirmed)}>Load account copy</Button>
    </div>}
  </section>;
}
