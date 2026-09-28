"use client";

/**
 * "Username" card on the profile pages: shows the current username, checks a
 * new one live (taken / rules) and saves it (POST /api/account/username).
 * Admin profile in Uzbek, teacher and student profiles in English.
 * `initial` undefined → the current username is loaded from the API.
 */

import { useEffect, useState } from "react";
import { AtSign, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { USERNAME_MAX, USERNAME_TEXT, normalizeUsername, type UsernameLang, type UsernameMessageCode } from "@/lib/account/username-rules";
import { useUsernameCheck } from "./use-username-check";

const T = {
  en: {
    title: "Username",
    current: "Your username:",
    none: "You don't have a username yet — choose one to sign in with it instead of your email.",
    label: "New username",
    hint: "Everyone's username is different. You can sign in with it or with your email.",
    save: "Save username",
    saving: "Saving…",
    saved: "Saved — you can now sign in as",
  },
  uz: {
    title: "Foydalanuvchi nomi (login)",
    current: "Hozirgi nomingiz:",
    none: "Hali foydalanuvchi nomingiz yoʻq — tanlang, shunda email oʻrniga shu nom bilan kira olasiz.",
    label: "Yangi foydalanuvchi nomi",
    hint: "Har bir foydalanuvchining nomi boshqacha boʻladi. Kirishda shu nomni yoki emailni yozish mumkin.",
    save: "Nomni saqlash",
    saving: "Saqlanmoqda…",
    saved: "Saqlandi — endi bu nom bilan kira olasiz:",
  },
} as const;

export function UsernameForm({ lang, initial, allowReserved }: { lang: UsernameLang; initial?: string | null; allowReserved?: boolean }) {
  const t = T[lang];
  const msg = USERNAME_TEXT[lang];
  const [current, setCurrent] = useState<string | null>(initial ?? null);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UsernameMessageCode | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const status = useUsernameCheck(value, { same: current, allowReserved });

  useEffect(() => {
    if (initial !== undefined) return;
    let alive = true;
    fetch("/api/account/username", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { username?: string | null } | null) => {
        if (alive) setCurrent(b?.username ?? null);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [initial]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(null);
    const u = normalizeUsername(value);
    if (!u) return setError("missing");
    if (status.state === "unavailable") return setError(status.code);
    setBusy(true);
    try {
      const res = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; username?: string; code?: UsernameMessageCode } | null;
      if (!res.ok || !body?.ok || !body.username) {
        const code = body?.code ?? "server";
        setError(code in msg ? code : "server");
        return;
      }
      setCurrent(body.username);
      setSaved(body.username);
      setValue("");
    } catch {
      setError("server");
    } finally {
      setBusy(false);
    }
  };

  const unchanged = !!current && normalizeUsername(value) === current;
  return (
    <section id="username" aria-labelledby="username-title" className="glass scroll-mt-24 rounded-xl border border-averna-cyan/30 p-6">
      <h2 id="username-title" className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
        <AtSign className="h-5 w-5 text-averna-cyan" aria-hidden /> {t.title}
      </h2>
      <p className="mb-4 text-sm text-gray-300">
        {!loaded ? (
          <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden />
        ) : current ? (
          <>
            {t.current} <span className="font-semibold text-white">@{current}</span>
          </>
        ) : (
          t.none
        )}
      </p>
      <form onSubmit={save} className="space-y-3" noValidate>
        <label htmlFor="username-input" className="text-sm font-medium text-gray-200">
          {t.label}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">@</span>
            <input
              id="username-input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setSaved(null);
              }}
              maxLength={USERNAME_MAX + 1}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={current ?? "ali_karimov"}
              disabled={busy}
              aria-describedby="username-status username-rules"
              className="w-full rounded-md border border-input bg-background/50 py-2 pl-7 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !value.trim() || unchanged || status.state === "unavailable" || status.state === "checking"}
            className="neon-button inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-averna-primary px-4 text-sm font-semibold text-white hover:bg-averna-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? t.saving : t.save}
          </button>
        </div>
        <p id="username-status" aria-live="polite" className="min-h-[1.25rem] text-sm">
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <XCircle className="h-4 w-4" aria-hidden /> {msg[error]}
            </span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-averna-neon">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> {t.saved} @{saved}
            </span>
          ) : unchanged ? null : status.state === "checking" ? (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {msg.checking}
            </span>
          ) : status.state === "available" ? (
            <span className="inline-flex items-center gap-1.5 text-averna-neon">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> @{status.username} — {msg.available}
            </span>
          ) : status.state === "unavailable" ? (
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <XCircle className="h-4 w-4" aria-hidden /> {msg[status.code]}
            </span>
          ) : status.state === "unverified" ? (
            <span className="text-gray-400">{msg.unverified}</span>
          ) : null}
        </p>
        <p id="username-rules" className="text-xs text-gray-400">
          {msg.rules} {t.hint}
        </p>
      </form>
    </section>
  );
}
