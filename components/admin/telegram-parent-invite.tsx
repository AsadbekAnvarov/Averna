"use client";

/**
 * "Invite a parent to Telegram" on the teacher's parent report: creates a
 * one-parent, 7-day invite link to the Averna bot (POST /api/telegram/parent-invite)
 * with a copy button. The parent presses Start, picks Oʻzbekcha or Русский and
 * gets the child's weekly report every Sunday evening (around 19:00).
 *
 * Below it, the chats already linked as this student's parents (Telegram name,
 * date, paused or not) with Remove (DELETE /api/telegram/parent-invite) — for an
 * invite that reached the wrong person.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, PauseCircle, Send, Trash2, Users } from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { ParentInviteStatus, ParentLinkInfo, TelegramCodeResponse } from "@/lib/telegram/types";

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

const EMPTY: ParentInviteStatus = { available: false, linkedParents: 0, parents: [] };

function parentName(p: ParentLinkInfo): string {
  if (p.firstName && p.username) return `${p.firstName} (@${p.username})`;
  if (p.username) return `@${p.username}`;
  return p.firstName || "Telegram user";
}

function linkedOn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", day: "numeric", month: "short", year: "numeric" });
}

export function TelegramParentInvite({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [status, setStatus] = useState<ParentInviteStatus | null>(null);
  const [invite, setInvite] = useState<TelegramCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ParentInviteStatus> => {
    try {
      const res = await fetch(`/api/telegram/parent-invite?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
      if (!res.ok) return EMPTY;
      const body = (await res.json()) as Partial<ParentInviteStatus> | null;
      return {
        available: !!body?.available,
        linkedParents: typeof body?.linkedParents === "number" ? body.linkedParents : 0,
        parents: Array.isArray(body?.parents) ? body.parents : [],
      };
    } catch {
      return EMPTY;
    }
  }, [studentId]);

  useEffect(() => {
    let alive = true;
    void load().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [load]);

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

  const remove = async (linkId: string) => {
    setRemoving(linkId);
    try {
      const res = await fetch("/api/telegram/parent-invite", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, linkId }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      // 404: already gone — the list below is refreshed either way.
      if (!res.ok && res.status !== 404) throw new Error(body?.error || "Couldn't remove the parent connection. Please try again.");
      toast.success("Parent connection removed");
      setConfirming(null);
      setStatus(await load());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the parent connection.");
    } finally {
      setRemoving(null);
    }
  };

  const expires = invite
    ? new Date(invite.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", day: "numeric", month: "short" })
    : "";
  const parents = status?.parents ?? [];

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
            {studentName}&apos;s weekly report every Sunday evening (around 19:00). Each link works for one parent and expires in 7
            days.
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
                  title="Opening it yourself and pressing Start would connect YOUR Telegram as the parent"
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

      {parents.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Connected parents</h3>
          <ul className="space-y-2">
            {parents.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
                <span className="min-w-0 text-sm text-white">
                  <span className="break-all">{parentName(p)}</span>
                  <span className="block text-xs text-gray-400">
                    Linked {linkedOn(p.linkedAt)}
                    {p.active ? (
                      " · active"
                    ) : (
                      <span className="text-yellow-300">
                        {" "}
                        · <PauseCircle className="inline h-3.5 w-3.5" /> paused (sent /stop or blocked the bot)
                      </span>
                    )}
                  </span>
                </span>
                {confirming === p.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Stop their reports?</span>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded-lg px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(p.id)}
                      disabled={removing === p.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      {removing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(p.id)}
                    disabled={!!removing}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Don&apos;t recognise someone? Remove them — their chat stops getting {studentName}&apos;s reports. Parents can also send
            /disconnect to the bot.
          </p>
        </div>
      )}
    </div>
  );
}
