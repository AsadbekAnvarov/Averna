"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Download, Trash2, Save } from "lucide-react";
import { CAPSULE_PROMPTS } from "@/lib/adventures/catalog";
import { CAPSULE_LIMIT, CAPSULE_MAX_BYTES, listCapsules, saveCapsule, deleteCapsule, type Capsule } from "@/lib/adventures/capsule-store";
function Clip({ audio, label }: { audio: Blob; label: string }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState(false);
  useEffect(() => { const next = URL.createObjectURL(audio); setUrl(next); setError(false); return () => URL.revokeObjectURL(next); }, [audio]);
  return <><audio controls preload="metadata" src={url || undefined} aria-label={label} onError={() => setError(true)} />{error && <p className="adv-note">This browser could not play that format. Export it and try a compatible player; the stored recording is unchanged.</p>}</>;
}
function exportAudio(item: Capsule) {
  const url = URL.createObjectURL(item.audio); const link = document.createElement("a"); link.href = url;
  const extension = /mp4/i.test(item.audio.type) ? "m4a" : /ogg/i.test(item.audio.type) ? "ogg" : "webm";
  link.download = `averna-capsule-${item.createdAt.slice(0, 10)}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dateLabel = (item: Capsule) => new Date(item.createdAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export function VoiceCapsules({ owner }: { owner: string }) {
  const [promptId, setPromptId] = useState<string>(CAPSULE_PROMPTS[0].id); const prompt = CAPSULE_PROMPTS.find(item => item.id === promptId) || CAPSULE_PROMPTS[0];
  const [store, setStore] = useState<{ owner: string; items: Capsule[] }>({ owner, items: [] }); const [draft, setDraft] = useState<{ owner: string; item: Capsule } | null>(null);
  const [recordingOwner, setRecordingOwner] = useState<string | null>(null); const [seconds, setSeconds] = useState(0); const [note, setNote] = useState(""); const [consent, setConsent] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false);
  const [comparison, setComparison] = useState({ before: "", after: "" }); const [remove, setRemove] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const interval = useRef<ReturnType<typeof setInterval> | null>(null); const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(false); const currentOwner = useRef(owner); currentOwner.current = owner; const pending = useRef(false); const saving = useRef(false); const generation = useRef(0);
  function stopTracks() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (interval.current) clearInterval(interval.current); if (timeout.current) clearTimeout(timeout.current); interval.current = null; timeout.current = null; }
  useEffect(() => {
    alive.current = true; const token = ++generation.current; setStore({ owner, items: [] }); setDraft(null); setReady(false); setConsent(false); setError(""); setRemove(null); setNote(""); setRecordingOwner(null); setBusy(false); setComparison({ before: "", after: "" }); pending.current = false; saving.current = false;
    listCapsules(owner).then(items => { if (alive.current && token === generation.current && currentOwner.current === owner) { setStore({ owner, items }); setReady(true); } }).catch(reason => { if (alive.current && token === generation.current && currentOwner.current === owner) { setError(reason instanceof Error ? reason.message : "Device storage unavailable"); setReady(true); } });
    return () => { alive.current = false; generation.current = token + 1; if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; recorder.current.onerror = null; if (recorder.current.state !== "inactive") recorder.current.stop(); recorder.current = null; } stopTracks(); };
    // All media lifecycle resources belong to this owner's mounted component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  useEffect(() => { const stop = () => { if (document.hidden && recorder.current?.state === "recording") { recorder.current.stop(); stopTracks(); } }; document.addEventListener("visibilitychange", stop); return () => document.removeEventListener("visibilitychange", stop); }, []);
  async function start() {
    if (pending.current || recordingOwner || busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Audio recording is unsupported here. Use a compatible HTTPS browser; no recording was saved."); return; }
    pending.current = true; setBusy(true); setError(""); const recordingPrompt = prompt.id; const recordingUser = owner; const token = generation.current;
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || currentOwner.current !== recordingUser || token !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(acquired, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 }); recorder.current = rec;
      const chunks: Blob[] = []; let bytes = 0; let failed = false; const started = performance.now();
      rec.ondataavailable = event => { if (event.data.size) { bytes += event.data.size; if (bytes <= CAPSULE_MAX_BYTES) chunks.push(event.data); else if (rec.state !== "inactive") rec.stop(); } };
      rec.onerror = () => { failed = true; stopTracks(); if (alive.current && token === generation.current) { setRecordingOwner(null); setError("Recording failed. Your saved capsules are unchanged."); } };
      rec.onstop = () => {
        stopTracks(); if (!alive.current || token !== generation.current || currentOwner.current !== recordingUser) return;
        setRecordingOwner(null); recorder.current = null;
        if (failed) return;
        if (bytes > CAPSULE_MAX_BYTES) { setError("This recording exceeded 4 MB. Try a shorter recording; no audio was saved."); return; }
        const audio = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        const duration = Math.min(120, Math.max(1, Math.round((performance.now() - started) / 1000)));
        if (!audio.size) { setError("No audio was captured. Check your microphone and try again."); return; }
        setDraft({ owner: recordingUser, item: { id: crypto.randomUUID(), promptId: recordingPrompt, createdAt: new Date().toISOString(), seconds: duration, note: "", audio } }); setNote(""); setConsent(false);
      };
      rec.start(1000); setRecordingOwner(recordingUser); setSeconds(0); setDraft(null);
      interval.current = setInterval(() => setSeconds(Math.min(120, Math.floor((performance.now() - started) / 1000))), 500);
      timeout.current = setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 120_000);
    } catch { acquired?.getTracks().forEach(track => track.stop()); stopTracks(); if (alive.current && token === generation.current) setError("Microphone permission was denied or recording could not start. No audio was saved."); }
    finally { if (alive.current && token === generation.current) { pending.current = false; setBusy(false); } }
  }
  async function save() {
    if (!draft || draft.owner !== owner || !consent || saving.current) return;
    saving.current = true; setBusy(true); setError(""); const token = generation.current;
    try { await saveCapsule(owner, { ...draft.item, note }); const items = await listCapsules(owner); if (alive.current && token === generation.current) { setStore({ owner, items }); setDraft(null); setConsent(false); } }
    catch (reason) { if (alive.current && token === generation.current) setError(reason instanceof Error ? reason.message : "Could not save. Export your preview first."); }
    finally { if (alive.current && token === generation.current) { saving.current = false; setBusy(false); } }
  }
  async function erase(id: string) {
    if (busy) return; setBusy(true); setError(""); const token = generation.current;
    try { await deleteCapsule(owner, id); const items = await listCapsules(owner); if (alive.current && token === generation.current) { setStore({ owner, items }); setRemove(null); } }
    catch (reason) { if (alive.current && token === generation.current) setError(reason instanceof Error ? reason.message : "Delete failed"); }
    finally { if (alive.current && token === generation.current) setBusy(false); }
  }
  const items = store.owner === owner ? store.items : []; const matching = items.filter(item => item.promptId === prompt.id);
  const before = matching.find(item => item.id === comparison.before); const after = matching.find(item => item.id === comparison.after); const validPair = before && after && before.id !== after.id && before.createdAt < after.createdAt;
  return <div className="adv-stack"><section className="adv-card"><p className="adv-kicker">Real recordings · your device, your choice</p><h2>A voice you can return to</h2><p className="adv-muted">Answer the same question today and again in a few weeks. Listen for changes yourself; no AI band or pronunciation score is generated.</p><label className="adv-form-grid">Your recurring question<select value={prompt.id} disabled={!!recordingOwner || busy} onChange={event => { setPromptId(event.target.value); setComparison({ before: "", after: "" }); }}>{CAPSULE_PROMPTS.map(item => <option value={item.id} key={item.id}>{item.text}</option>)}</select></label><div className="adv-dialogue"><p>{prompt.text}</p></div>{recordingOwner === owner ? <div className="adv-actions"><span className="adv-recording" role="status">Recording · {seconds}s / 120s</span><button type="button" className="adv-button adv-danger" onClick={() => { if (recorder.current?.state !== "inactive") recorder.current?.stop(); }}><Square size={18} />Stop and preview</button></div> : <button type="button" className="adv-button adv-primary" disabled={!ready || busy || items.length >= CAPSULE_LIMIT || draft?.owner === owner} onClick={start}><Mic size={18} />{busy ? "Working…" : "Record up to 2 minutes"}</button>}<p className="adv-note">Recording starts only when you press Record. Switching apps stops it and creates an unsaved preview; leaving this page discards an unsaved preview. Saved audio is never uploaded by this tool.</p>{draft?.owner === owner && <div className="adv-answer"><h3>Unsaved preview · {draft.item.seconds}s</h3><Clip audio={draft.item.audio} label="Unsaved capsule preview" /><label className="adv-form-grid">A note to your future self<input type="text" maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label><label className="adv-checkline"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Save this audio on this device. It is not encrypted; anyone with access to this browser/device may access stored recordings.</span></label><div className="adv-actions"><button type="button" className="adv-button adv-primary" disabled={!consent || busy} onClick={save}><Save size={18} />Save capsule on this device</button><button type="button" className="adv-button adv-secondary" onClick={() => exportAudio(draft.item)}><Download size={18} />Export preview</button><button type="button" className="adv-button adv-secondary" disabled={busy} onClick={() => setDraft(null)}>Discard preview</button></div></div>}<p role="status" className="adv-note adv-live">{error}</p><p className="adv-note">{items.length}/{CAPSULE_LIMIT} saved recordings · maximum 4 MB each. Clearing browser data deletes them. Export important recordings and delete them before sharing this device.</p></section><section className="adv-card"><h2>Then and now</h2>{matching.length < 2 ? <p className="adv-empty">Save two recordings for this same question to compare them. There is no need to rush the second one.</p> : <><div className="adv-two-cols"><label className="adv-form-grid">Earlier recording<select value={comparison.before} onChange={event => setComparison({ ...comparison, before: event.target.value })}><option value="">Choose a recording</option>{matching.map(item => <option key={item.id} value={item.id}>{dateLabel(item)} · {item.seconds}s</option>)}</select></label><label className="adv-form-grid">Later recording<select value={comparison.after} onChange={event => setComparison({ ...comparison, after: event.target.value })}><option value="">Choose a recording</option>{matching.map(item => <option key={item.id} value={item.id}>{dateLabel(item)} · {item.seconds}s</option>)}</select></label></div>{validPair ? <div className="adv-two-cols"><article className="adv-answer"><h3>Then</h3><p className="adv-note">{dateLabel(before)}</p><Clip audio={before.audio} label="Earlier recording" /></article><article className="adv-answer"><h3>Now</h3><p className="adv-note">{dateLabel(after)}</p><Clip audio={after.audio} label="Later recording" /></article></div> : <p className="adv-note">Choose two different recordings, with the older one first.</p>}<fieldset className="adv-options"><legend>What do you notice? These are your observations, not a score.</legend>{["My ideas are easier to follow", "I use more specific examples", "I sound more comfortable", "I know what I want to practise next"].map(text => <label key={text}><input type="checkbox" /><span>{text}</span></label>)}</fieldset></>}</section><section className="adv-card"><h2>Saved for this question</h2>{!matching.length && <p className="adv-empty">Your first capsule will appear here after you explicitly save it.</p>}{matching.map(item => <article className="adv-answer" key={item.id}><div className="adv-status-line"><h3>{dateLabel(item)}</h3><span className="adv-tag">{item.seconds}s</span></div>{item.note && <p>{item.note}</p>}<Clip audio={item.audio} label={`Recording from ${dateLabel(item)}`} /><div className="adv-actions"><button type="button" className="adv-button adv-secondary" onClick={() => exportAudio(item)}><Download size={18} />Export audio</button><button type="button" className="adv-button adv-secondary" disabled={busy} onClick={() => setRemove(item.id)}><Trash2 size={18} />Delete recording</button></div>{remove === item.id && <div className="adv-feedback"><p>Delete this stored recording permanently? Export it first if you want a copy.</p><div className="adv-actions"><button type="button" className="adv-button adv-secondary" onClick={() => setRemove(null)}>Keep recording</button><button type="button" className="adv-button adv-danger" disabled={busy} onClick={() => erase(item.id)}>Delete permanently</button></div></div>}</article>)}</section></div>;
}
