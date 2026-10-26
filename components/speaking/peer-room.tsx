"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  Captions,
  Check,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Volume2,
} from "lucide-react";
import { MicCheck } from "@/components/speaking/mic-check";
import { PeerFeedbackSlot } from "@/components/speaking/peer-feedback-slot";
import { useOwnCaptions } from "@/components/speaking/use-own-captions";
import { usePeerVoice, type PeerVoice, type VoiceStatus } from "@/components/speaking/use-peer-voice";
import { FORMAT_INFO } from "@/lib/speaking/formats";
import { countFillers, countWords, topFillers, wordsPerMinute } from "@/lib/speaking/fluency";
import { cefrForBand, levelLabel } from "@/lib/speaking/level";
import { phraseGroupsFor, type PhraseRole } from "@/lib/speaking/phrases";
import { clockOffset, formatClock, timeLeftMs, timerMark, timeUpAction } from "@/lib/speaking/room-timer";
import {
  advancer,
  currentPhase,
  isPeerSessionState,
  phasePlan,
  type PeerSessionState,
  type PhaseSpec,
  type Seat,
  type SessionAction,
} from "@/lib/speaking/session";
import type { SessionView } from "@/lib/speaking/session-view";
import {
  addTalk,
  dominantSide,
  NUDGE_WINDOW_MS,
  talkShare,
  vadInit,
  vadStep,
  windowTotals,
  type TalkBucket,
} from "@/lib/speaking/talk-time";

/**
 * The peer speaking room (docs/peer-speaking.md, Phase B) on the session API:
 *   - polls GET every 2 s while the tab is visible; POSTs actions with the current
 *     `version` and adopts the returned state (also on 409);
 *   - timers run on server time (offset from `serverNow`); when the LEAD's timer hits 0
 *     their client sends one `next` (or `skip` while a shared-timer part has questions left);
 *   - role-aware screens: lobby, examiner/candidate, conversation cards, debate turns,
 *     swap, done;
 *   - client-only helpers: talk-time balance, phrase drawer, own-speech captions.
 */

export const POLL_MS = 2000;
const TICK_MS = 500;
const LOBBY_LEAVE_HINT_MS = 60_000;

const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

type RoomView = SessionView & { state: PeerSessionState };

interface ActionReply {
  state?: unknown;
  version?: number;
  changed?: boolean;
  xp?: number;
  error?: string;
}

const btn =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn = `${btn} bg-averna-primary text-white hover:bg-averna-light`;
const outlineBtn = `${btn} border border-white/20 text-white hover:bg-white/10`;

const PHASE_TITLE: Record<string, string> = {
  lobby: "Get ready",
  part1: "Part 1 · Interview",
  "part2-prep": "Part 2 · Preparation",
  "part2-talk": "Part 2 · Long turn",
  "part2-follow": "Part 2 · Follow-up",
  part3: "Part 3 · Discussion",
  card: "Conversation card",
  swap: "Swap roles",
  done: "Session complete",
};

function phaseTitle(p: PhaseSpec): string {
  if (p.key === "opening" || p.key === "rebuttal") return `${p.key === "opening" ? "Opening" : "Rebuttal"} · ${p.side === "for" ? "FOR" : "AGAINST"}`;
  return PHASE_TITLE[p.key] ?? p.key;
}

const partNumber = (key: string) => (key === "part1" ? 1 : key === "part3" ? 3 : 2);

const STATUS_TEXT: Record<VoiceStatus, string> = {
  idle: "Voice off",
  connecting: "Connecting voice…",
  connected: "Voice connected",
  reconnecting: "Reconnecting…",
  failed: "Voice disconnected",
};

function ConnectionPill({ status }: { status: VoiceStatus }) {
  const dot =
    status === "connected" ? "bg-averna-neon" : status === "failed" ? "bg-red-400" : status === "idle" ? "bg-gray-400" : "bg-yellow-300";
  return (
    <span role="status" className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-white/15 px-3 text-xs text-gray-200">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {STATUS_TEXT[status]}
    </span>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-full rounded-full bg-averna-cyan transition-[width] duration-100 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TalkBar({ me, partner, partnerName, title }: { me: number; partner: number; partnerName: string; title: string }) {
  const share = talkShare(me, partner);
  return (
    <section aria-label={title} className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-medium text-gray-300">{title}</p>
      {share ? (
        <>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full bg-averna-pink" style={{ width: `${share.me}%` }} />
            <div className="h-full bg-averna-cyan" style={{ width: `${share.partner}%` }} />
          </div>
          <p className="mt-1 text-sm text-white">
            You {share.me}% · {partnerName} {share.partner}%
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Shows up once you both start talking.</p>
      )}
    </section>
  );
}

function Notes({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return (
    <div className="mt-3">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
        <NotebookPen className="h-4 w-4" aria-hidden /> {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={2000}
        className="mt-1 w-full rounded-lg border border-white/15 bg-background/50 p-2 text-sm text-white"
        placeholder="Key words, ideas, examples…"
      />
      <p className="mt-1 text-[11px] text-gray-400">Only you can see these notes. They aren&apos;t saved.</p>
    </div>
  );
}

function Say({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border-l-4 border-averna-purple bg-averna-purple/10 px-3 py-2 text-sm text-white">
      <span className="font-semibold text-averna-purple">Say: </span>
      {children}
    </p>
  );
}

function CueCard({ cue, points, closing }: { cue: string; points: string[]; closing: string }) {
  return (
    <div className="mt-3 rounded-xl border border-averna-cyan/40 bg-averna-cyan/5 p-4">
      <p className="text-base font-semibold text-white">{cue}</p>
      <p className="mt-2 text-sm text-gray-300">You should say:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-white">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-gray-300">{closing}</p>
    </div>
  );
}

function ConfirmEnd({ onCancel, onConfirm, partnerName, busy }: { onCancel: () => void; onConfirm: () => void; partnerName: string; busy: boolean }) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="av-panel w-full max-w-sm rounded-2xl p-5">
        <h2 id={titleId} className="text-lg font-semibold text-white">
          End the session?
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          It ends for {partnerName} too. XP is given only when both rounds are finished.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className={outlineBtn}>
            Keep going
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`${btn} bg-red-500 text-white hover:bg-red-600`}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}

function VoiceIssues({ voice, partnerName }: { voice: PeerVoice; partnerName: string }) {
  if (voice.micIssue) {
    const text =
      voice.micIssue === "blocked"
        ? "Your microphone is blocked. Allow it in your browser's site settings (the lock icon next to the address), then try again."
        : voice.micIssue === "unsupported"
          ? "This browser can't make voice calls here. Try the latest Chrome, Edge, Firefox or Safari."
          : "No microphone found, or another app is using it.";
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
        <MicOff className="h-5 w-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">{text}</p>
        {voice.micIssue !== "unsupported" && (
          <button type="button" onClick={voice.retry} className={outlineBtn}>
            Try again
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {voice.audioBlocked && (
        <button type="button" onClick={voice.resumeAudio} className={`${primaryBtn} w-full`}>
          <Volume2 className="h-4 w-4" aria-hidden /> Tap to hear {partnerName}
        </button>
      )}
      {voice.status === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-yellow-300/40 bg-yellow-300/10 p-3 text-sm text-white">
          <p className="min-w-0 flex-1">Voice isn&apos;t connected. It reconnects by itself when {partnerName} rejoins — or check your internet and reconnect.</p>
          <button type="button" onClick={voice.retry} className={outlineBtn}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Reconnect
          </button>
        </div>
      )}
    </>
  );
}

export function PeerRoom({ initial }: { initial: RoomView }) {
  const roomId = initial.roomId;
  const me = initial.me;
  const partner = initial.partner;
  const pName = partner.firstName || "your partner";

  const [view, setView] = useState({ state: initial.state, version: initial.version, status: initial.status });
  const [xp, setXp] = useState<number | null>(initial.xp);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [pending, setPending] = useState<SessionAction | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [talk, setTalk] = useState({ r0: { me: 0, partner: 0 }, r1: { me: 0, partner: 0 }, win: { me: 0, partner: 0 }, ownMs: 0 });

  const versionRef = useRef(initial.version);
  const busy = useRef(false);
  const fetching = useRef(false);
  const autoSent = useRef(new Set<string>());
  const lobbySince = useRef(Date.now());
  const phrasesId = useId();

  const state = view.state;
  const phase = currentPhase(state);
  const ended = phase.kind === "done" || view.status !== "ACTIVE";
  const serverNow = now + offset;
  const left = phase.kind === "timed" ? timeLeftMs(state, serverNow) : null;
  const natural = phase.kind === "done" && state.endedBy === null;

  // ----- sync --------------------------------------------------------------------
  const adopt = useCallback((next: unknown, version: unknown, status?: unknown, force = false) => {
    if (!isPeerSessionState(next) || typeof version !== "number") return;
    if (!force && version < versionRef.current) return;
    versionRef.current = version;
    setView((v) => ({ state: next, version, status: typeof status === "string" ? status : currentPhase(next).kind === "done" ? "ENDED" : v.status }));
  }, []);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const sent = Date.now();
    try {
      const res = await fetch(`/api/speaking/session/${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const received = Date.now();
      const d = (await res.json().catch(() => ({}))) as Partial<SessionView> & { error?: string };
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) setError(d.error || "This session isn't available.");
        return;
      }
      if (typeof d.serverNow === "number") setOffset(clockOffset(d.serverNow, sent, received));
      if (typeof d.xp === "number") setXp(d.xp);
      if (busy.current) return; // the action's reply brings the newer state
      adopt(d.state, d.version, d.status);
    } catch {
      /* the next poll retries */
    } finally {
      fetching.current = false;
    }
  }, [adopt, roomId]);

  const act = useCallback(
    async (action: SessionAction) => {
      if (busy.current) return;
      busy.current = true;
      setPending(action);
      setError("");
      let refetch = false;
      try {
        const res = await fetch(`/api/speaking/session/${encodeURIComponent(roomId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, version: versionRef.current }),
        });
        const d = (await res.json().catch(() => ({}))) as ActionReply;
        if (res.ok) {
          adopt(d.state, d.version);
          if (typeof d.xp === "number") setXp(d.xp);
        } else if (res.status === 409) {
          // Someone else moved first (or the room ended): take the server's state.
          adopt(d.state, d.version, undefined, true);
          refetch = true;
        } else {
          setError(d.error || "Something went wrong. Try again.");
        }
      } catch {
        setError("Connection problem. Check your internet and try again.");
      } finally {
        busy.current = false;
        setPending(null);
      }
      if (refetch) void refresh();
    },
    [adopt, refresh, roomId],
  );

  // Poll every 2 s while visible; refetch as soon as the tab is visible again.
  useEffect(() => {
    if (ended) return;
    void refresh();
    const id = setInterval(() => {
      if (visible()) void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (visible()) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ended, refresh]);

  // The partner finished the session: fetch our XP (the award may still be writing).
  useEffect(() => {
    if (!natural || xp !== null) return;
    void refresh();
    const id = setTimeout(() => void refresh(), 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  // ----- voice + talk time -----------------------------------------------------------
  const vad = useRef({ me: vadInit(), partner: vadInit(), buckets: [] as TalkBucket[], rounds: [{ me: 0, partner: 0 }, { me: 0, partner: 0 }] });
  const counting = useRef({ on: false, round: 0 as 0 | 1 });
  counting.current = { on: phase.kind === "timed", round: phase.round };

  const onLevels = useCallback((local: number, remote: number, at: number) => {
    const v = vad.current;
    const before = { me: v.me.totalMs, partner: v.partner.totalMs };
    v.me = vadStep(v.me, local, at);
    v.partner = vadStep(v.partner, remote, at);
    if (!counting.current.on) return;
    const dm = v.me.totalMs - before.me;
    const dp = v.partner.totalMs - before.partner;
    if (!dm && !dp) return;
    v.buckets = addTalk(v.buckets, at, dm, dp);
    const r = v.rounds[counting.current.round];
    r.me += dm;
    r.partner += dp;
  }, []);

  const voice = usePeerVoice({ roomId, initiator: me.seat === "A", enabled: !ended, onLevels });
  const captions = useOwnCaptions("en-GB");
  const captionsFrom = useRef(0);
  const setCaptions = captions.setOn;

  useEffect(() => {
    if (ended && captions.on) setCaptions(false);
  }, [ended, captions.on, setCaptions]);

  // Clock + talk-time snapshot.
  useEffect(() => {
    if (ended) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const v = vad.current;
      setTalk({ r0: { ...v.rounds[0] }, r1: { ...v.rounds[1] }, win: windowTotals(v.buckets, t, NUDGE_WINDOW_MS), ownMs: v.me.totalMs });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ended]);

  // ----- timers ------------------------------------------------------------------
  // The lead's client moves on once when the timer hits 0 (one POST per state version).
  useEffect(() => {
    if (ended || phase.kind !== "timed" || phase.lead !== me.seat || left === null || left > 0) return;
    const key = `${view.version}:${state.phase}:${state.prompt}`;
    if (autoSent.current.has(key)) return;
    autoSent.current.add(key);
    void act(timeUpAction(phase, state.prompt));
  }, [act, ended, left, me.seat, phase, state.phase, state.prompt, view.version]);

  const nameOf = (s: Seat | null) => (s === me.seat ? "you" : pName);
  const doneTitle =
    phase.kind !== "done" ? "This session has ended" : state.endedBy === null ? "Session complete" : `Session ended by ${nameOf(state.endedBy)}`;
  const screenTitle = ended ? doneTitle : phaseTitle(phase);

  // Announce 1 min / 30 s / time, and each new phase, to screen readers.
  const lastMark = useRef<{ key: string; ms: number | null }>({ key: "", ms: null });
  const phaseKey = `${state.phase}:${state.prompt}:${state.startAt ?? ""}:${view.status}`;
  useEffect(() => {
    const prev = lastMark.current;
    if (prev.key !== phaseKey) {
      if (prev.key) setAnnounce(screenTitle);
    } else {
      const mark = timerMark(prev.ms, left);
      if (mark) setAnnounce(mark);
    }
    lastMark.current = { key: phaseKey, ms: left };
  }, [left, phaseKey, screenTitle]);

  // ----- derived ---------------------------------------------------------------------
  const examLike = state.format === "exam" || state.format === "quick";
  const nextLead = phase.kind === "lobby" || phase.kind === "swap" ? advancer(state) : phase.lead;
  const role: PhraseRole = examLike
    ? nextLead === me.seat
      ? "examiner"
      : "candidate"
    : (phase.kind === "timed" ? phase.speaker : nextLead) === me.seat
      ? "speaker"
      : "listener";
  const groups = useMemo(() => phraseGroupsFor(state.format, phase.key, role), [state.format, phase.key, role]);
  const noteKey = `${phase.round}`;
  const note = notes[noteKey] ?? "";
  const setNote = (v: string) => setNotes((n) => ({ ...n, [noteKey]: v }));
  const partnerLevel = partner.level != null ? levelLabel({ band: partner.level, cefr: cefrForBand(partner.level) }) : null;
  const words = countWords(captions.transcript);
  const fillers = countFillers(captions.transcript);
  const wpm = wordsPerMinute(words, talk.ownMs - captionsFrom.current);
  const roundTalk = phase.round === 0 ? talk.r0 : talk.r1;
  const allTalk = { me: talk.r0.me + talk.r1.me, partner: talk.r0.partner + talk.r1.partner };
  const nudge = state.format === "conversation" && phase.kind === "timed" && dominantSide(talk.win) === "me";
  const timeUp = left !== null && left <= 0;

  // ----- screens ---------------------------------------------------------------------
  const timer =
    left !== null ? (
      <div className="text-right">
        <p role="timer" aria-label="Time left" className={`text-4xl font-bold tabular-nums sm:text-5xl ${left <= 30_000 ? "text-yellow-300" : "text-white"}`}>
          {formatClock(left)}
        </p>
        {timeUp && <p className="text-xs text-gray-300">{phase.lead === me.seat ? "Time is up — moving on…" : `Time is up — waiting for ${pName}…`}</p>}
      </div>
    ) : null;

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-averna-pink">
          {FORMAT_INFO[state.format].title}
          {phase.kind === "timed" && ` · Round ${phase.round + 1} of 2`}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">{phaseTitle(phase)}</h2>
      </div>
      {timer}
    </div>
  );

  function lobbyScreen() {
    const first = advancer(state);
    const bothReady = state.ready.A && state.ready.B;
    const waitedLong = now - lobbySince.current > LOBBY_LEAVE_HINT_MS && !state.ready[partner.seat];
    const c = state.content;
    const rolesLine =
      c.format === "exam" || c.format === "quick"
        ? first === me.seat
          ? `You're the examiner first, then you swap with ${pName}.`
          : `${pName} is the examiner first, then you swap.`
        : c.format === "conversation"
          ? first === me.seat
            ? `You answer the first cards, then ${pName} does.`
            : `${pName} answers the first cards, then you do.`
          : first === me.seat
            ? `You argue FOR the motion first, then you swap sides.`
            : `${pName} argues FOR the motion first; you argue AGAINST. Then you swap sides.`;
    return (
      <div className="space-y-4">
        {heading}
        <p className="text-sm text-gray-300">{FORMAT_INFO[state.format].text}</p>
        <p className="text-sm text-white">{rolesLine}</p>
        {c.format === "debate" && (
          <p className="rounded-xl border border-averna-purple/40 bg-averna-purple/10 p-3 text-sm text-white">
            <span className="font-semibold">Motion:</span> {c.motion.text}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <MicCheck stream={voice.localStream} />
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-medium text-white">Hearing {pName}</p>
            <p className="mb-3 text-xs text-gray-400">
              {voice.status === "connected" ? `The bar moves when ${pName} talks.` : STATUS_TEXT[voice.status]}
            </p>
            <Meter label={`${pName}'s voice level`} value={voice.remoteLevel} />
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Who is ready">
          {[me, partner].map((p) => (
            <li key={p.seat} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-white">
              {state.ready[p.seat] ? <Check className="h-4 w-4 text-averna-neon" aria-hidden /> : <Loader2 className="h-4 w-4 animate-spin text-gray-400 motion-reduce:animate-none" aria-hidden />}
              {p.seat === me.seat ? "You" : pName}: {state.ready[p.seat] ? "ready" : "not ready yet"}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          {state.ready[me.seat] ? (
            <button type="button" disabled aria-pressed className={outlineBtn}>
              <Check className="h-4 w-4 text-averna-neon" aria-hidden /> Ready
            </button>
          ) : (
            <button type="button" onClick={() => void act("ready")} disabled={!!pending || !!voice.micIssue} aria-pressed={false} className={primaryBtn}>
              I&apos;m ready
            </button>
          )}
          {bothReady && first === me.seat && (
            <button type="button" onClick={() => void act("start")} disabled={!!pending} className={primaryBtn}>
              Start
            </button>
          )}
          {bothReady && first !== me.seat && <p className="text-sm text-gray-300" role="status">Waiting for {pName} to start…</p>}
          {state.ready[me.seat] && !bothReady && <p className="text-sm text-gray-300" role="status">You&apos;re ready. Waiting for {pName}…</p>}
        </div>
        {waitedLong && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
            <p className="min-w-0 flex-1">{pName} isn&apos;t ready yet. You can leave and find another partner.</p>
            <button type="button" onClick={() => void act("end")} disabled={!!pending} className={outlineBtn}>
              <LogOut className="h-4 w-4" aria-hidden /> Leave
            </button>
          </div>
        )}
      </div>
    );
  }

  function examScreen() {
    const c = state.content;
    if (c.format !== "exam" && c.format !== "quick") return null;
    const examiner = phase.lead === me.seat;
    const cue = c.format === "exam" ? c.rounds[phase.round].cue : c.rounds[phase.round];
    const last = state.prompt >= phase.prompts - 1;
    const lastRound = phase.round === 1;
    const n = partNumber(phase.key);
    const rounding =
      c.format === "quick" && phase.key === "part2-follow"
        ? `“Thank you. That's the end of the cue card${lastRound ? " and of the session" : ""}.”`
        : `“Thank you, that's the end of Part ${n}${lastRound && phase.key === "part3" ? ". That is the end of the speaking test" : ""}.”`;
    const nearEnd = left !== null && left <= 20_000;
    const roleBadge = (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-averna-pink/15 px-3 py-1 text-xs font-semibold text-averna-pink">
        {examiner ? `You are the examiner · ${pName} answers` : "You are the candidate"}
      </p>
    );

    if (!examiner) {
      const showCue = phase.key === "part2-prep" || phase.key === "part2-talk";
      return (
        <div>
          {heading}
          <div className="mt-2">{roleBadge}</div>
          {showCue ? (
            <>
              <p className="mt-3 text-sm text-gray-300">
                {phase.key === "part2-prep" ? "You have 1 minute to prepare. Make notes if you like." : "Talk for up to 2 minutes. Your examiner will stop you."}
              </p>
              <CueCard cue={cue.cue} points={cue.points} closing={cue.closing} />
              <Notes value={note} onChange={setNote} label="Your notes" />
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-base text-white">
              <Volume2 className="mr-2 inline h-5 w-5 text-averna-cyan" aria-hidden />
              Listen to your examiner and answer.
            </p>
          )}
        </div>
      );
    }

    let body: React.ReactNode = null;
    let nextLabel = "Next question";
    if (phase.key === "part1" && c.format === "exam") {
      const items = c.rounds[phase.round].part1;
      const item = items[state.prompt];
      const newTopic = state.prompt === 0 || items[state.prompt - 1]?.topic !== item?.topic;
      body = (
        <>
          {newTopic && item && <Say>“{state.prompt === 0 ? "Let's talk about" : "Now let's talk about"} {item.topic.toLowerCase()}.”</Say>}
          <p className="mt-3 text-xs text-gray-400">
            Question {state.prompt + 1} of {items.length} · {item?.topic}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{item?.q}</p>
        </>
      );
      if (last) nextLabel = "Finish Part 1";
    } else if (phase.key === "part3" && c.format === "exam") {
      const p3 = c.rounds[phase.round].part3;
      body = (
        <>
          {state.prompt === 0 && <Say>“We&apos;ve been talking about the topic on your card. Now I&apos;d like to ask you some more general questions about {p3.theme.toLowerCase()}.”</Say>}
          <p className="mt-3 text-xs text-gray-400">
            Question {state.prompt + 1} of {p3.questions.length} · {p3.theme}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{p3.questions[state.prompt]}</p>
        </>
      );
      if (last) nextLabel = "Finish Part 3";
    } else if (phase.key === "part2-prep") {
      body = (
        <>
          <Say>
            “Now I&apos;m going to give you a topic, and I&apos;d like you to talk about it for one to two minutes. You have one minute to think about
            what you&apos;re going to say. You can make some notes if you wish.”
          </Say>
          <CueCard cue={cue.cue} points={cue.points} closing={cue.closing} />
        </>
      );
      nextLabel = "Start the talk now";
    } else if (phase.key === "part2-talk") {
      body = (
        <>
          <Say>“Remember, you have one to two minutes for this. I&apos;ll tell you when the time is up. Can you start speaking now, please?”</Say>
          <CueCard cue={cue.cue} points={cue.points} closing={cue.closing} />
          {c.format === "exam" && <p className="mt-3 text-sm text-gray-300">When they finish, you can ask: “{cue.followUp}”</p>}
        </>
      );
      nextLabel = "Finish Part 2";
    } else if (phase.key === "part2-follow") {
      body = (
        <>
          <p className="mt-3 text-xs text-gray-400">Follow-up question</p>
          <p className="mt-1 text-lg font-semibold text-white">{cue.followUp}</p>
        </>
      );
      nextLabel = "Finish";
    }
    const showRounding = phase.key !== "part2-prep" && (last || nearEnd);
    return (
      <div>
        {heading}
        <div className="mt-2">{roleBadge}</div>
        {body}
        {showRounding && <Say>{rounding}</Say>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void act("next")} disabled={!!pending} className={primaryBtn}>
            {nextLabel}
          </button>
        </div>
      </div>
    );
  }

  function conversationScreen() {
    const c = state.content;
    if (c.format !== "conversation") return null;
    const cards = c.rounds[phase.round];
    const card = cards[state.prompt];
    const lead = phase.lead === me.seat;
    const last = state.prompt >= cards.length - 1;
    return (
      <div>
        {heading}
        <p className="mt-3 text-xs text-gray-400">
          Card {state.prompt + 1} of {cards.length}
          {card?.topic ? ` · ${card.topic}` : ""}
        </p>
        <p className="mt-1 rounded-xl border border-averna-cyan/40 bg-averna-cyan/5 p-4 text-lg font-semibold text-white">{card?.text}</p>
        <p className="mt-3 text-sm text-gray-300">
          {lead ? `You answer first, then ask ${pName} what they think.` : `${pName} answers first. Then share your view and ask a follow-up question.`}
        </p>
        {lead && (
          <div className="mt-4">
            <button type="button" onClick={() => void act("next")} disabled={!!pending} className={primaryBtn}>
              {last ? "Finish round" : "Next card"}
            </button>
          </div>
        )}
      </div>
    );
  }

  function debateScreen() {
    const c = state.content;
    if (c.format !== "debate") return null;
    const speaking = phase.speaker === me.seat;
    const plan = phasePlan(state);
    const myNext = plan.slice(state.phase + 1).find((p) => p.kind === "timed" && p.round === phase.round && p.speaker === me.seat);
    return (
      <div>
        {heading}
        <p className="mt-3 rounded-xl border border-averna-purple/40 bg-averna-purple/10 p-4 text-base font-semibold text-white">{c.motion.text}</p>
        <p className="mt-3 text-sm text-white">
          {speaking ? (
            <>
              <span className="font-semibold">Your turn.</span> Argue {phase.side === "for" ? "FOR" : "AGAINST"} the motion.
            </>
          ) : (
            <>
              <span className="font-semibold">{pName}&apos;s turn</span> ({phase.side === "for" ? "FOR" : "AGAINST"}).
            </>
          )}
        </p>
        {speaking ? (
          <div className="mt-4">
            <button type="button" onClick={() => void act("next")} disabled={!!pending} className={primaryBtn}>
              Finish my turn
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-300">{myNext ? "Your turn next — note your rebuttal." : `Listen to ${pName}'s rebuttal.`}</p>
            <Notes value={note} onChange={setNote} label="Rebuttal notes" />
          </>
        )}
      </div>
    );
  }

  function swapScreen() {
    const lead = advancer(state);
    const mine = lead === me.seat;
    const summary =
      state.format === "exam" || state.format === "quick"
        ? mine
          ? `Now you're the examiner and ${pName} is the candidate.`
          : `Now ${pName} is the examiner and you're the candidate.`
        : state.format === "conversation"
          ? mine
            ? "Now you answer the first cards."
            : `Now ${pName} answers the first cards.`
          : mine
            ? `Swap sides: now you argue FOR the motion and ${pName} argues AGAINST.`
            : `Swap sides: now ${pName} argues FOR the motion and you argue AGAINST.`;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-averna-pink">Round 1 done</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-white">
            <ArrowLeftRight className="h-5 w-5 text-averna-cyan" aria-hidden /> Swap roles
          </h2>
        </div>
        <p className="text-sm text-white">{summary}</p>
        <TalkBar me={talk.r0.me} partner={talk.r0.partner} partnerName={pName} title="Talk time in round 1" />
        {mine ? (
          <button type="button" onClick={() => void act("start")} disabled={!!pending} className={primaryBtn}>
            Start round 2
          </button>
        ) : (
          <p className="text-sm text-gray-300" role="status">
            Waiting for {pName} to start round 2…
          </p>
        )}
      </div>
    );
  }

  function doneScreen() {
    const title = doneTitle;
    const minutes = state.endedAt && initial.createdAt ? Math.max(1, Math.round((state.endedAt - initial.createdAt) / 60_000)) : null;
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
          {natural && <Trophy className="h-6 w-6 text-averna-neon" aria-hidden />}
          {title}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {minutes !== null && <span className="rounded-full border border-white/15 px-3 py-1 text-gray-200">Duration: {minutes} min</span>}
          {natural && xp !== null && xp > 0 && <span className="rounded-full bg-averna-neon/15 px-3 py-1 font-semibold text-averna-neon">+{xp} XP</span>}
        </div>
        {!natural && phase.kind === "done" && <p className="text-sm text-gray-300">XP is given when both rounds are finished.</p>}
        {(allTalk.me > 0 || allTalk.partner > 0) && <TalkBar me={allTalk.me} partner={allTalk.partner} partnerName={pName} title="Talk time" />}
        <PeerFeedbackSlot roomId={roomId} partnerName={pName} />
        <Link href="/learning/speaking" className={primaryBtn}>
          Back to Speaking
        </Link>
      </div>
    );
  }

  let screen: React.ReactNode;
  if (ended) screen = doneScreen();
  else if (phase.kind === "lobby") screen = lobbyScreen();
  else if (phase.kind === "swap") screen = swapScreen();
  else if (state.format === "conversation") screen = conversationScreen();
  else if (state.format === "debate") screen = debateScreen();
  else screen = examScreen();

  const showTalk = !ended && phase.kind === "timed";

  return (
    <div className="space-y-4">
      {/* The partner's voice; captions don't apply to a live call. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={voice.attachAudio} autoPlay className="hidden" />

      <header className="av-panel flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">
            {pName}
            {partnerLevel && <span className="ml-2 text-xs font-normal text-gray-400">{partnerLevel}</span>}
          </p>
          <ConnectionPill status={ended ? "idle" : voice.status} />
        </div>
        {!ended && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={voice.toggleMute}
              disabled={!voice.localStream}
              aria-pressed={voice.muted}
              aria-label={voice.muted ? "Unmute microphone" : "Mute microphone"}
              className={`${btn} border ${voice.muted ? "border-red-400/60 text-red-300" : "border-white/20 text-white"}`}
            >
              {voice.muted ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
              <span className="hidden sm:inline">{voice.muted ? "Muted" : "Mute"}</span>
            </button>
            <button type="button" onClick={() => setConfirmEnd(true)} className={`${btn} border border-red-400/50 text-red-300 hover:bg-red-500/10`}>
              <LogOut className="h-4 w-4" aria-hidden /> End session
            </button>
          </div>
        )}
      </header>

      {!ended && <VoiceIssues voice={voice} partnerName={pName} />}

      <section className="av-panel rounded-2xl p-4 sm:p-6">{screen}</section>

      {showTalk && (
        <>
          {examLike ? (
            <TalkBar me={roundTalk.me} partner={roundTalk.partner} partnerName={pName} title="Talk time this round" />
          ) : (
            <TalkBar me={allTalk.me} partner={allTalk.partner} partnerName={pName} title="Talk time" />
          )}
          {nudge && (
            <p role="status" className="rounded-xl border border-averna-cyan/40 bg-averna-cyan/10 p-3 text-sm text-white">
              Invite {pName} in — ask a follow-up question.
            </p>
          )}
        </>
      )}

      {!ended && (
        <section aria-label="Helpers" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPhrasesOpen((o) => !o)} aria-expanded={phrasesOpen} aria-controls={phrasesId} className={outlineBtn}>
              <BookOpen className="h-4 w-4" aria-hidden /> Useful phrases
            </button>
            {captions.supported && (
              <button
                type="button"
                onClick={() => {
                  if (!captions.on) captionsFrom.current = vad.current.me.totalMs;
                  captions.setOn(!captions.on);
                }}
                aria-pressed={captions.on}
                className={outlineBtn}
              >
                <Captions className="h-4 w-4" aria-hidden /> {captions.on ? "Captions on" : "My captions"}
              </button>
            )}
          </div>
          {phrasesOpen && (
            <div id={phrasesId} className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
              {groups.map((g) => (
                <div key={g.id}>
                  <h3 className="text-sm font-semibold text-white">{g.title}</h3>
                  <ul className="mt-1 space-y-0.5 text-sm text-gray-300">
                    {g.phrases.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {captions.error && <p className="text-sm text-yellow-300">{captions.error}</p>}
          {captions.on && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">
                {`Only you see your captions. They stay in this tab and aren't saved — your browser's speech service may process them online. If ${pName} can't hear you on a phone, turn captions off.`}
              </p>
              <p className="mt-2 max-h-32 overflow-y-auto text-sm text-white">
                {captions.transcript.slice(-400)} <span className="text-gray-400">{captions.interim}</span>
              </p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
                <div>
                  <dt className="inline">Words: </dt>
                  <dd className="inline font-semibold text-white">{words}</dd>
                </div>
                <div>
                  <dt className="inline">Pace: </dt>
                  <dd className="inline font-semibold text-white">{wpm !== null ? `${wpm} words/min` : "—"}</dd>
                </div>
                <div>
                  <dt className="inline">Fillers: </dt>
                  <dd className="inline font-semibold text-white">
                    {fillers.total}
                    {fillers.total > 0 && ` (${topFillers(fillers).map(([f, k]) => `${f} ×${k}`).join(", ")})`}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      )}

      <p className="flex items-start gap-2 text-xs text-gray-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        Voice only. Nothing is recorded. Talk time and notes stay on this device.
      </p>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {confirmEnd && (
        <ConfirmEnd
          partnerName={pName}
          busy={!!pending}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            void act("end");
          }}
        />
      )}
    </div>
  );
}
