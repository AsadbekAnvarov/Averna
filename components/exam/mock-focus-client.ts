/** Bounded durable queue. One ID per visibility episode; retries are idempotent. */
export type FocusEvent = { eventId: string; kind: "monitor" | "hidden"; section: number; leftAt: string; returnedAt: string | null };
export class MockFocusQueue {
  events: FocusEvent[] = [];
  pending: FocusEvent | null = null;
  private busy = false;
  private key: string;
  constructor(readonly attemptId: string) {
    this.key = `averna-mock-focus:${attemptId}`;
    try { const v = JSON.parse(localStorage.getItem(this.key) || "null"); if (Array.isArray(v?.events)) this.events = v.events.slice(-64); if (v?.pending?.kind === "hidden") this.pending = v.pending; } catch { /* storage may be unavailable */ }
  }
  private store() { try { localStorage.setItem(this.key, JSON.stringify({ events: this.events, pending: this.pending })); } catch { /* best effort, never stop answers */ } }
  private put(e: FocusEvent) { this.events = [...this.events.filter(x => x.eventId !== e.eventId), e].slice(-64); this.store(); }
  monitor(section: number) { this.put({ eventId: crypto.randomUUID(), kind: "monitor", section, leftAt: new Date().toISOString(), returnedAt: null }); }
  hide(section: number, now = Date.now()) { if (this.pending) return; this.pending = { eventId: crypto.randomUUID(), kind: "hidden", section, leftAt: new Date(now).toISOString(), returnedAt: null }; this.put(this.pending); }
  show(now = Date.now()) { if (!this.pending) return null; const e = { ...this.pending, returnedAt: new Date(Math.max(now, Date.parse(this.pending.leftAt))).toISOString() }; this.pending = null; this.put(e); return Math.max(0, now - Date.parse(e.leftAt)); }
  beacon() { try { if (this.events.length) navigator.sendBeacon?.(`/api/mock/${encodeURIComponent(this.attemptId)}/focus`, new Blob([JSON.stringify({ events: this.events.slice(0, 16) })], { type: "application/json" })); } catch { /* retained for retry */ } }
  async flush() {
    if (this.busy || !this.events.length) return;
    this.busy = true; const batch = this.events.slice(0, 16);
    try {
      const r = await fetch(`/api/mock/${encodeURIComponent(this.attemptId)}/focus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: batch }), keepalive: true });
      if (r.ok) { this.events = this.events.filter(e => !batch.some(b => JSON.stringify(b) === JSON.stringify(e))); this.store(); }
    } catch { /* offline: retry without touching the exam */ } finally { this.busy = false; }
  }
}
