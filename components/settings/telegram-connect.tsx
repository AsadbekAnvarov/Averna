"use client";

/**
 * Settings → Telegram: connect the Averna bot, choose what it sends, disconnect.
 *
 * "Connect Telegram" asks /api/telegram/link for a one-time deep link (15 min),
 * opens it in a new tab (pre-opened on the click so popup blockers allow it)
 * and polls the status until the bot reports the chat linked — then shows
 * "Connected as @user", the role's toggles and Disconnect.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, PauseCircle, RefreshCw, Send, Unlink } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "@/components/ui/toast";
import type { LinkRole, PrefKey, TelegramCodeResponse, TelegramLinkStatus } from "@/lib/telegram/types";

const POLL_FAST_MS = 3000;
const POLL_SLOW_MS = 8000;
const FAST_FOR_MS = 2 * 60 * 1000;

type PrefText = { label: string; desc: string };
const STAFF_ANNOUNCEMENTS: PrefText = { label: "Announcements & updates", desc: "School announcements and other updates" };
const PREF_TEXT: Record<LinkRole, Partial<Record<PrefKey, PrefText>>> = {
  student: {
    homework: { label: "New homework", desc: "When your teacher assigns homework" },
    reviews: { label: "Reviews & grades", desc: "When your teacher reviews your work or posts a grade" },
    reminders: {
      label: "Reminders & updates",
      desc: "A reminder every evening (around 19:00) when homework is due tomorrow or your streak is at risk, plus announcements and milestones",
    },
  },
  teacher: {
    reports: {
      label: "Daily report",
      desc: "Every evening (around 19:00): homework due today and yesterday with who's missing, work to review, inactive students",
    },
    reminders: STAFF_ANNOUNCEMENTS,
  },
  admin: {
    reports: {
      label: "Daily summary",
      desc: "Every evening (around 19:00): new students, placement tests, pending payments, reviews and homework",
    },
    reminders: STAFF_ANNOUNCEMENTS,
  },
  parent: {},
};

const INTRO: Record<LinkRole, string> = {
  student: "Get new homework, teacher reviews and a reminder every evening (around 19:00) when something is due — right in Telegram.",
  teacher: "Get a report on your groups every evening (around 19:00): missing homework, work waiting for review and inactive students.",
  admin: "Get a summary of the school every evening (around 19:00): new students, placement tests, payments, reviews and homework.",
  parent: "",
};

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await res.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorOf(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-averna-cyan/70" : "bg-white/15"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </span>
  );
}

export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ url: string; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (quiet = false): Promise<TelegramLinkStatus | null> => {
    try {
      const res = await fetch("/api/telegram/link", { cache: "no-store" });
      const body = await readJson(res);
      if (!res.ok || !body) throw new Error(errorOf(body, `Couldn't load your Telegram connection (${res.status}).`));
      const s = body as unknown as TelegramLinkStatus;
      if (mounted.current) {
        setStatus(s);
        setLoadError(null);
      }
      return s;
    } catch (e) {
      if (!quiet && mounted.current) setLoadError(e instanceof Error ? e.message : "Couldn't load your Telegram connection.");
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While a link is open: poll until the bot reports the chat linked (or the link expires).
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const check = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      const s = await load(true);
      inFlight = false;
      if (!alive) return;
      if (s?.linked && s.active) {
        setPending(null);
        toast.success(s.username ? `Telegram connected as @${s.username}` : "Telegram connected");
        return;
      }
      if (Date.now() >= pending.expiresAt) {
        setPending(null);
        toast.info("The Telegram link expired — press Connect Telegram to get a new one.");
        return;
      }
      timer = setTimeout(check, Date.now() - started < FAST_FOR_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    };
    timer = setTimeout(check, POLL_FAST_MS);
    const onFocus = () => {
      if (timer) clearTimeout(timer);
      void check();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [pending, load]);

  const connect = async () => {
    if (busy) return;
    setBusy("connect");
    // Opened during the click so popup blockers allow it; pointed at Telegram once the link exists.
    const win = window.open("", "_blank");
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const body = await readJson(res);
      if (!res.ok || typeof body?.url !== "string") throw new Error(errorOf(body, "Couldn't create a Telegram link. Please try again."));
      const code = body as unknown as TelegramCodeResponse;
      setPending({ url: code.url, expiresAt: new Date(code.expiresAt).getTime() || Date.now() + 15 * 60 * 1000 });
      if (win && !win.closed) {
        try {
          win.opener = null;
        } catch {
          /* cross-origin already */
        }
        win.location.href = code.url;
      }
    } catch (e) {
      if (win && !win.closed) win.close();
      toast.error(e instanceof Error ? e.message : "Couldn't create a Telegram link.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (key: PrefKey) => {
    if (!status || busy) return;
    const next = !status.prefs[key];
    setBusy(key);
    setStatus({ ...status, prefs: { ...status.prefs, [key]: next } });
    try {
      const res = await fetch("/api/telegram/link", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prefs: { [key]: next } }),
      });
      const body = await readJson(res);
      if (!res.ok || !body?.prefs) throw new Error(errorOf(body, "Couldn't save your Telegram settings."));
      const prefs = body.prefs as TelegramLinkStatus["prefs"];
      setStatus((s) => (s ? { ...s, prefs } : s));
    } catch (e) {
      setStatus((s) => (s ? { ...s, prefs: { ...s.prefs, [key]: !next } } : s));
      toast.error(e instanceof Error ? e.message : "Couldn't save your Telegram settings.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy("disconnect");
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorOf(body, "Couldn't disconnect Telegram."));
      setConfirming(false);
      await load();
      toast.success("Telegram disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't disconnect Telegram.");
    } finally {
      setBusy(null);
    }
  };

  const role: LinkRole = status?.role ?? "student";
  let body: React.ReactNode;

  if (!status && !loadError) {
    body = (
      <p className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  } else if (!status) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  } else if (!status.available && !status.linked) {
    body =
      status.reason === "parent_account" ? (
        <p className="text-sm text-gray-400">Parents connect with an invite link from their child&apos;s teacher.</p>
      ) : (
        <div>
          <p className="text-sm font-medium text-white">Telegram notifications are not available yet.</p>
          <p className="mt-1 text-xs text-gray-400">Your school hasn&apos;t connected the Averna bot yet — check back later.</p>
        </div>
      );
  } else if (status.linked) {
    const keys = status.prefKeys.filter((k) => PREF_TEXT[role][k]);
    const who = status.username ? `@${status.username}` : status.firstName || "your Telegram";
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-white">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" />
            <span>
              Connected as <span className="font-semibold">{who}</span>
            </span>
          </p>
          {status.botUrl && (
            <a
              href={status.botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-averna-cyan hover:underline"
            >
              Open the bot <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {!status.active && (
          <p className="flex items-start gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs text-yellow-200">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Paused — Telegram notifications stopped (you sent /stop or blocked the bot). Send <b>/start</b> to the bot to turn
              them back on.
            </span>
          </p>
        )}

        {keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((key) => {
              const t = PREF_TEXT[role][key] as PrefText;
              const on = status.prefs[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void toggle(key)}
                  disabled={busy === key}
                  aria-pressed={on}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition-colors hover:border-white/20 disabled:opacity-70"
                >
                  <span className="min-w-0 text-sm text-white">
                    {t.label}
                    <span className="block text-xs font-normal text-gray-400">{t.desc}</span>
                  </span>
                  <Switch on={on} />
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-gray-400">Stop all Telegram notifications?</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={busy === "disconnect"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
              >
                {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Unlink className="h-4 w-4" /> Disconnect
            </button>
          )}
        </div>
      </div>
    );
  } else if (pending) {
    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-white">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-averna-cyan" />
          Waiting for Telegram — press <b>Start</b> in the chat with the Averna bot.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={pending.url}
            target="_blank"
            rel="noopener noreferrer"
            className="neon-button inline-flex items-center gap-1.5 rounded-lg bg-averna-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-averna-light"
          >
            <Send className="h-4 w-4" /> Open Telegram
          </a>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-500">The link works once, for 15 minutes. On a computer you can also open it on your phone.</p>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 flex-1 text-sm text-gray-300">{INTRO[role] || INTRO.student}</p>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy === "connect"}
          className="neon-button inline-flex items-center gap-2 rounded-lg bg-averna-primary px-4 py-2 text-sm font-medium text-white hover:bg-averna-light disabled:opacity-60"
        >
          {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Connect Telegram
        </button>
      </div>
    );
  }

  return (
    <>
      <SectionHeader icon={Send} title="Telegram" subtitle="Homework, reviews and reminders in Telegram" accent="text-averna-cyan" />
      <div className="glass mb-8 rounded-2xl border border-white/5 p-5">{body}</div>
    </>
  );
}
