"use client";

/**
 * "Change password" card — Admin profile (Uzbek) and Teacher profile (English).
 * POST /api/account/password; on success every session of the account ends,
 * so the user is signed out and signs in again with the new password.
 */

import { useState } from "react";
import { signOut } from "next-auth/react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, AlertCircle } from "lucide-react";
import { PASSWORD_MIN_CHARS, passwordProblem } from "@/lib/account/password-rules";

type Lang = "uz" | "en";

const T = {
  uz: {
    title: "Parolni oʻzgartirish",
    current: "Joriy parol",
    next: "Yangi parol",
    confirm: "Yangi parolni takrorlang",
    show: "Parollarni koʻrsatish",
    hint: `Kamida ${PASSWORD_MIN_CHARS} ta belgi, kamida bitta harf va bitta raqam. Oʻzgartirgandan soʻng barcha qurilmalardagi seanslar yopiladi va yangi parol bilan qayta kirasiz.`,
    submit: "Parolni oʻzgartirish",
    busy: "Saqlanmoqda…",
    done: "Parol oʻzgartirildi. Endi yangi parol bilan qayta kiring…",
    errors: {
      mismatch: "Yangi parollar bir xil emas.",
      missing: "Barcha maydonlarni toʻldiring.",
      too_short: `Yangi parol kamida ${PASSWORD_MIN_CHARS} ta belgidan iborat boʻlishi kerak.`,
      too_long: "Yangi parol juda uzun.",
      letters_digits: "Yangi parolda kamida bitta harf va bitta raqam boʻlsin.",
      common: "Bu parol juda oddiy yoki email/foydalanuvchi nomingizga oʻxshaydi — boshqasini tanlang.",
      same: "Yangi parol joriy paroldan farq qilishi kerak.",
      wrong_current: "Joriy parol notoʻgʻri.",
      too_many: "Juda koʻp notoʻgʻri urinish. 15 daqiqadan soʻng qayta urinib koʻring.",
      auth: "Seans tugagan — qayta kiring.",
      not_found: "Akkaunt topilmadi — qayta kiring.",
      server: "Parolni oʻzgartirib boʻlmadi. Qayta urinib koʻring.",
    },
  },
  en: {
    title: "Change password",
    current: "Current password",
    next: "New password",
    confirm: "Repeat the new password",
    show: "Show passwords",
    hint: `At least ${PASSWORD_MIN_CHARS} characters, with at least one letter and one digit. After the change you're signed out on every device and sign in again with the new password.`,
    submit: "Change password",
    busy: "Saving…",
    done: "Password changed. Sign in again with your new password…",
    errors: {
      mismatch: "The new passwords don't match.",
      missing: "Fill in all the fields.",
      too_short: `The new password needs at least ${PASSWORD_MIN_CHARS} characters.`,
      too_long: "The new password is too long.",
      letters_digits: "Use at least one letter and one digit in the new password.",
      common: "This password is too easy to guess or looks like your email / username — choose another.",
      same: "The new password must be different from the current one.",
      wrong_current: "The current password is wrong.",
      too_many: "Too many wrong attempts. Try again in 15 minutes.",
      auth: "Your session has ended — sign in again.",
      not_found: "Account not found — sign in again.",
      server: "The password couldn't be changed. Please try again.",
    },
  },
} as const;

type ErrorCode = keyof (typeof T)["en"]["errors"];

const INPUT =
  "w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan disabled:opacity-60";

export function ChangePasswordForm({ lang, email, username }: { lang: Lang; email?: string | null; username?: string | null }) {
  const t = T[lang];
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    setError(null);
    if (!current || !next || !confirm) return setError("missing");
    const problem = passwordProblem(next, { current, email, username });
    if (problem) return setError(problem);
    if (next !== confirm) return setError("mismatch");

    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
      if (!res.ok || !body?.ok) {
        const code = (body?.code ?? "server") as ErrorCode;
        setError(code in t.errors ? code : "server");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      // Every session of the account has ended (this one too): sign in again with the new password.
      window.setTimeout(() => void signOut({ callbackUrl: "/auth/signin?changed=1" }), 1800);
    } catch {
      setError("server");
    } finally {
      setBusy(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <section id="password" aria-labelledby="change-password-title" className="glass scroll-mt-24 rounded-xl border border-averna-pink/30 p-6">
      <h2 id="change-password-title" className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <KeyRound className="h-5 w-5 text-averna-pink" aria-hidden /> {t.title}
      </h2>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {t.errors[error]}
          </p>
        )}
        {done && (
          <p role="status" className="flex items-center gap-2 rounded-lg border border-averna-neon/40 bg-averna-neon/10 px-3 py-2 text-sm text-averna-neon">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> {t.done}
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="pw-current" className="text-sm font-medium text-gray-200">
            {t.current}
          </label>
          <input
            id="pw-current"
            type={type}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy || done}
            className={INPUT}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="pw-new" className="text-sm font-medium text-gray-200">
              {t.next}
            </label>
            <input
              id="pw-new"
              type={type}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={busy || done}
              className={INPUT}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="pw-confirm" className="text-sm font-medium text-gray-200">
              {t.confirm}
            </label>
            <input
              id="pw-confirm"
              type={type}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy || done}
              className={INPUT}
            />
          </div>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-averna-primary" />
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />} {t.show}
        </label>
        <p className="text-xs text-gray-400">{t.hint}</p>
        <button
          type="submit"
          disabled={busy || done}
          className="neon-button inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-averna-primary px-5 text-sm font-semibold text-white hover:bg-averna-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
          {busy ? t.busy : t.submit}
        </button>
      </form>
    </section>
  );
}
