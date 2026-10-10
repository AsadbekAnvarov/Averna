"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { MockDraftQueue } from "./mock-draft-queue";
export const MockSaveContext = createContext<MockDraftQueue | null>(null);
export function MockSaveStatus() {
  const queue = useContext(MockSaveContext);
  return queue ? <Status queue={queue} /> : null;
}
function Status({ queue }: { queue: MockDraftQueue }) {
  const status = useSyncExternalStore(queue.subscribe, queue.snapshot, () => "saved");
  const text = { saved: "Saved to account", pending: "Changes waiting to save", saving: "Saving to account…", offline: "Account save not confirmed — keep this page open. The exam clock continues.", conflict: "Another tab or device changed this draft. Reload to compare both copies before continuing.", "storage-error": "Device backup unavailable. Keep this page open and check account saving." }[status];
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-exam-bar px-4 py-2 text-sm text-gray-300"><p role="status" aria-live="polite">{text}</p>{(status === "offline" || status === "storage-error") && <button type="button" className="min-h-[44px] rounded-lg border border-white/20 px-3 text-white" onClick={() => void queue.send()}>Retry save</button>}{status === "conflict" && <button type="button" className="min-h-[44px] rounded-lg border border-white/20 px-3 text-white" onClick={() => window.location.reload()}>Reload & compare</button>}</div>;
}
