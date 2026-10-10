/** Serial, revision-checked mock autosave. The device copy is written BEFORE network work. */
export type DraftStatus = "saved" | "pending" | "saving" | "offline" | "conflict" | "storage-error";
export class MockDraftQueue {
  pending: unknown = undefined;
  latest: unknown;
  revision: number;
  status: DraftStatus = "saved";
  paused = false;
  closed = false;
  detached = false;
  conflict = false;
  storageFailed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flight: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  constructor(readonly attemptId: string, readonly index: number, readonly strict: boolean, draft: unknown) {
    const meta = (draft as any)?.__mock;
    this.revision = Number.isInteger(meta?.revision) ? meta.revision : 0;
    this.latest = cleanDraft(draft);
    if (typeof window !== "undefined" && strict) {
      try {
        const raw = localStorage.getItem(this.key);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.draft && Number.isInteger(saved.revision)) {
          this.latest = saved.draft;
          if (saved.revision !== this.revision) { this.conflict = true; this.status = "conflict"; }
          else { this.pending = saved.draft; this.status = "pending"; }
        }
      } catch { this.storageFailed = true; this.status = "storage-error"; }
    }
  }
  get key() { return `averna-mock-draft:${this.attemptId}:${this.index}`; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.status;
  private notify(status: DraftStatus) { this.status = status; this.listeners.forEach(f => f()); }
  private persist() {
    if (!this.strict || typeof window === "undefined") return;
    try { localStorage.setItem(this.key, JSON.stringify({ draft: this.latest, revision: this.revision })); }
    catch { this.storageFailed = true; }
  }
  queue(draft: unknown) {
    if (this.closed) return;
    this.latest = draft; this.pending = draft; this.persist();
    // Runner callbacks may run inside a React updater; notification must be deferred.
    queueMicrotask(() => this.notify(this.conflict ? "conflict" : this.storageFailed ? "storage-error" : "pending"));
    if (this.detached) void this.send(true); else this.schedule();
  }
  schedule(delay = 4000) {
    if (this.timer || this.detached || this.paused || this.closed || this.conflict || this.pending === undefined) return;
    this.timer = setTimeout(() => { this.timer = null; void this.send(); }, delay);
  }
  pause() { this.paused = true; if (this.timer) clearTimeout(this.timer); this.timer = null; }
  resume() { this.paused = false; this.schedule(); }
  close() { this.pause(); this.closed = true; this.pending = undefined; try { localStorage.removeItem(this.key); } catch {} }
  keepDevice() { this.conflict = false; this.persist(); this.pending = this.latest; this.notify("pending"); this.schedule(0); }
  async settle() { if (this.flight) await this.flight; }
  async send(urgent = false): Promise<void> {
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    if (this.closed || this.paused || this.conflict || this.pending === undefined) return;
    if (this.flight) { await this.flight; if (!this.paused && !this.closed) return this.send(urgent); return; }
    const draft = this.pending; this.pending = undefined; this.notify("saving");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    this.flight = (async () => {
      try {
        const body = JSON.stringify({ section: this.index, draft, ...(this.strict ? { revision: this.revision } : {}) });
        const r = await fetch(`/api/mock/${encodeURIComponent(this.attemptId)}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body, signal: controller.signal, keepalive: urgent && new TextEncoder().encode(body).length <= 60000 });
        const data = await r.json();
        if (!r.ok || data?.ok !== true) {
          if (data?.conflict) { this.conflict = true; if (Number.isInteger(data.revision)) this.revision = data.revision; this.notify("conflict"); }
          throw new Error("Save not confirmed");
        }
        if (Number.isInteger(data.revision)) this.revision = data.revision;
        this.persist();
        this.notify(this.pending !== undefined ? "pending" : this.storageFailed ? "storage-error" : "saved");
      } catch {
        if (this.pending === undefined) this.pending = draft;
        if (!this.conflict) this.notify(this.storageFailed ? "storage-error" : "offline");
      } finally { clearTimeout(timeout); }
    })();
    await this.flight; this.flight = null;
    if (!this.closed && !this.paused && !this.conflict && this.pending !== undefined) this.schedule(this.status === "offline" ? 5000 : 0);
  }
}
export function cleanDraft(draft: unknown): unknown {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  const { __mock: _meta, ...payload } = draft as Record<string, unknown>;
  return payload;
}
