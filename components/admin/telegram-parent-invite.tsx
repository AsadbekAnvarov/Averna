"use client";

/**
 * "Invite a parent to Telegram" on the teacher's parent report: creates a
 * one-parent, 7-day invite link to the Averna bot (POST /api/telegram/parent-invite)
 * with a copy button. The parent presses Start, picks Oʻzbekcha or Русский and
 * gets the child's weekly report every Sunday at 19:00.
 */

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Send, Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { ParentInviteStatus, TelegramCodeResponse } from "@/lib/telegram/types";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function TelegramParentInvite({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [status, setStatus] = useState<ParentInviteStatus | null>(null);
  const [invite, setInvite] = useState<TelegramCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/telegram/parent-invite?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as ParentInviteStatus) : null))
      .catch(() => null)
      .then((s) => {
        if (alive) setStatus(s ?? { available: false, linkedParents: 0 });
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  const create = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const res = await fetch("/api/telegram/parent-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const body = (await res.json().catch(() => null)) as (TelegramCodeResponse & { error?: string }) | null;
      if (!res.ok || !body?.url) throw new Error(body?.error || "Couldn't create the invite. Please try again.");
      setInvite({ url: body.url, expiresAt: body.expiresAt });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invite) return;
    const ok = await copyText(invite.url);
    setCopied(ok);
    if (ok) toast.success("Invite link copied");
    else toast.error("Couldn't copy — select the link and copy it manually.");
  };

  const expires = invite
    ? new Date(invite.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", day: "numeric", month: "short" })
    : "";

  return (
    <div className="glass rounded-2xl border border-averna-cyan/30 p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-averna-cyan">
          <Send className="h-5 w-5" /> Invite a parent to Telegram
        </h2>
        {status?.available && status.linkedParents > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" /> {status.linkedParents} parent{status.linkedParents === 1 ? "" : "s"} connected
          </span>
        )}
      </div>

      {!status ? (
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : !status.available ? (
        <p className="text-sm text-gray-400">Telegram isn&apos;t set up yet — an admin can connect the bot in Admin → Telegram.</p>
      ) : (
        <>
          <p className="text-sm text-gray-300">
            Send this link to a parent (Telegram, SMS…). They press <b>Start</b>, choose Oʻzbekcha or Русский and get{" "}
            {studentName}&apos;s weekly report every Sunday at 19:00. Each link works for one parent and expires in 7 days.
          </p>
          {invite ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={invite.url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Parent invite link"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="neon-button inline-flex h-9 items-center gap-1.5 rounded-lg bg-averna-primary px-3 text-sm font-medium text-white hover:bg-averna-light"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
                <a
                  href={invite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
                  aria-label="Open the invite link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-xs text-gray-500">
                Valid until {expires}. For a second parent,{" "}
                <button type="button" onClick={() => void create()} disabled={busy} className="text-averna-cyan hover:underline disabled:opacity-60">
                  create another link
                </button>
                .
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="neon-button mt-3 inline-flex items-center gap-2 rounded-lg bg-averna-primary px-4 py-2 text-sm font-medium text-white hover:bg-averna-light disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Create invite link
            </button>
          )}
        </>
      )}
    </div>
  );
}
