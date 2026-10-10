"use client";
import { useEffect, useId, useState } from "react";
import { Volume2, Square, Mic, MicOff } from "lucide-react";
export function ReadAloud({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false); const [error, setError] = useState("");
  useEffect(() => () => { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }, []);
  function play() {
    if (typeof speechSynthesis === "undefined") { setError("Read-aloud is unavailable here. Open the transcript instead."); return; }
    speechSynthesis.cancel(); if (speaking) { setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-GB";
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => { setSpeaking(false); setError("Audio could not play. The transcript is still available."); };
    setError(""); setSpeaking(true); speechSynthesis.speak(utterance);
  }
  return <><button type="button" className="adv-button adv-secondary" onClick={play}>{speaking ? <Square size={18} /> : <Volume2 size={18} />}{speaking ? "Stop audio" : "Browser read-aloud"}</button>{error && <p className="adv-note" role="status">{error}</p>}</>;
}
// Browser speech services may process audio externally; never starts on page load.
interface Recognition { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void; abort(): void; }
export function ResponseBox({ value, onChange, label = "Your response", disabled = false }: { value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }) {
  const id = useId(); const [listening, setListening] = useState(false); const [error, setError] = useState("");
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  useEffect(() => {
    const w = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    const rec = new Constructor(); rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false;
    rec.onend = () => setListening(false); rec.onerror = () => { setListening(false); setError("Dictation stopped. You can still type your response."); };
    setRecognition(rec);
    return () => { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.abort(); };
  }, []);
  useEffect(() => { if (recognition) recognition.onresult = event => { const text = Array.from(event.results).map(item => item[0].transcript).join(" "); onChange(`${value}${value ? " " : ""}${text}`.slice(0, 1600)); }; }, [recognition, value, onChange]);
  return <div className="adv-response"><label htmlFor={id}>{label}</label><textarea id={id} rows={5} maxLength={1600} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder="Make it your own. A short, clear answer is enough." /><div className="adv-response-footer"><span>{value.length}/1600 · device draft</span>{recognition && <button type="button" disabled={disabled} className="adv-button adv-secondary" aria-pressed={listening} onClick={() => { if (listening) recognition.stop(); else { try { recognition.start(); setListening(true); setError(""); } catch { setError("Dictation is unavailable. Please type instead."); } } }}>{listening ? <MicOff size={18} /> : <Mic size={18} />}{listening ? "Stop dictation" : "Dictate"}</button>}</div>{recognition && <p className="adv-note">Optional dictation uses your browser&apos;s speech service, which may process audio externally.</p>}{error && <p role="status" className="adv-note">{error}</p>}</div>;
}
export function LocalNotice({ warning }: { warning?: string }) { return <p className="adv-note" role={warning ? "status" : undefined}>{warning || "Practice only · Device drafts are private to this account in the app, not encrypted. Clear them before sharing this browser. No IELTS score or XP is awarded."}</p>; }
export function ResetButton({ reset }: { reset: () => void }) { const [confirm, setConfirm] = useState(false); return confirm ? <div className="adv-actions"><span>Replace this device draft?</span><button className="adv-button adv-secondary" type="button" onClick={() => setConfirm(false)}>Keep draft</button><button className="adv-button adv-danger" type="button" onClick={() => { reset(); setConfirm(false); }}>Start again</button></div> : <button type="button" className="adv-button adv-secondary" onClick={() => setConfirm(true)}>Restart activity</button>; }
