"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { itemSchema, workshopRequest, type WorkshopItem } from "./workshop-client";
export function TeacherWorkshops({ owner, enabled }: { owner: string; enabled: boolean }) {
  const [store, setStore] = useState<{ owner: string; items: WorkshopItem[] }>({ owner, items: [] }); const [refresh, setRefresh] = useState(0); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [more, setMore] = useState(false);
  const current = useRef(owner); current.current = owner;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); setLoading(true); setError("");
    workshopRequest("/api/adventures/workshop?mode=review", {}, controller.signal).then(body => { if (!controller.signal.aborted && current.current === owner) { const parsed = z.object({ items: z.array(itemSchema).max(25), more: z.boolean() }).parse(body); setStore({ owner, items: parsed.items }); setMore(parsed.more); } }).catch(reason => { if (!controller.signal.aborted && current.current === owner) setError(reason instanceof Error ? reason.message : "Review list unavailable"); }).finally(() => { if (!controller.signal.aborted && current.current === owner) setLoading(false); }); return () => controller.abort();
  }, [enabled, owner, refresh]);
  if (!enabled) return <section className="adv-card"><h2>Class sharing is not enabled yet</h2><p>Your school has not enabled class sharing yet. Students can still build, preview and export personal challenges.</p></section>;
  return <section className="adv-card"><div className="adv-status-line"><h2>Student-authored challenges</h2><button type="button" className="adv-button adv-secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? "Loading…" : "Refresh queue"}</button></div><p className="adv-note">Only active students in your currently assigned classes are listed. Approval publishes to that class, never publicly. These are practice exercises, not IELTS exams.</p>{error && <p role="status" className="adv-note">{error}</p>}{!loading && !error && (!store.items.length || store.owner !== owner) && <p className="adv-empty">No workshops from your classes yet.</p>}{store.owner === owner && store.items.map(item => <ReviewCard key={`${item.id}:${item.version}`} item={item} onChanged={() => setRefresh(value => value + 1)} />)}{more && <p className="adv-note">The 25 most recently updated submissions are shown.</p>}</section>;
}
function ReviewCard({ item, onChanged }: { item: WorkshopItem; onChanged: () => void }) {
  const [feedback, setFeedback] = useState(item.feedback || ""); const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function decide(decision: "APPROVED" | "REJECTED") {
    if (busy || decision === "APPROVED" && !checked || decision === "REJECTED" && feedback.trim().length < 8) return;
    setBusy(true); setError("");
    try { await workshopRequest("/api/adventures/workshop", { method: "PATCH", body: JSON.stringify({ id: item.id, version: item.version, decision, feedback }) }); if (alive.current) onChanged(); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Review not saved"); }
    finally { if (alive.current) setBusy(false); }
  }
  return <article className="adv-answer adv-review-card"><div className="adv-status-line"><h3>{item.title}</h3><span className="adv-tag">{item.status.toLowerCase()} · revision {item.version}</span></div><p className="adv-note">{item.authorName || "Student"} · {item.groupName || "Assigned class"}</p><details className="adv-details"><summary>Inspect passage, questions and key</summary><div className="adv-inspection adv-stack"><p>{item.payload.passage}</p>{item.payload.questions.map((question, index) => <div key={index} className="adv-stack"><h3>{index + 1}. {question.prompt}</h3><ol type="A" className="adv-review-options">{question.options.map((option, i) => <li key={i}>{option}</li>)}</ol><div className="adv-feedback"><p><b>Author key:</b> {question.options[question.answer]}</p><p>{question.explanation}</p></div></div>)}</div></details><label className="adv-form-grid">Feedback to the author<textarea rows={3} maxLength={800} value={feedback} disabled={busy} onChange={e => setFeedback(e.target.value)} /></label><label className="adv-checkline"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} /><span>I checked the passage, answer keys, explanations and sharing permission. I want this visible to the class.</span></label><div className="adv-actions"><button type="button" className="adv-button adv-primary" disabled={busy || !checked} onClick={() => decide("APPROVED")}>{busy ? "Saving…" : "Approve for class"}</button><button type="button" className="adv-button adv-secondary" disabled={busy || feedback.trim().length < 8} onClick={() => decide("REJECTED")}>Return / remove from class</button></div>{error && <p role="status" className="adv-note">{error}</p>}</article>;
}
