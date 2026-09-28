"use client";

/**
 * Admin → Telegram (Uzbek UI): configuration and bot status, linked chats,
 * "Webhookni oʻrnatish", "Test xabar yuborish" and the setup steps.
 * Talks to /api/admin/telegram.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, History, Loader2, RefreshCw, Send, Webhook, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cronRunView } from "@/lib/telegram/cron-runs";
import type { CronRunInfo, LinkRole, TelegramAdminStatus } from "@/lib/telegram/types";

type Tone = "ok" | "warn" | "bad";

const TONE: Record<Tone, { cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { cls: "text-averna-neon", Icon: CheckCircle2 },
  warn: { cls: "text-yellow-400", Icon: AlertTriangle },
  bad: { cls: "text-red-400", Icon: XCircle },
};

const ROLE_LABEL: Record<LinkRole, string> = {
  student: "Oʻquvchilar",
  teacher: "Oʻqituvchilar",
  admin: "Administratorlar",
  parent: "Ota-onalar",
};

const BTN = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const JOB_LABEL: Record<string, string> = {
  "telegram-daily": "Telegram: kechki xabarlar",
  "speaking-recordings-cleanup": "Speaking yozuvlarini tozalash",
};

const LINE_CLS: Record<Tone, string> = { ok: "text-gray-400", warn: "text-yellow-300/80", bad: "text-red-300/80" };

/** Label, tone and counts from lib/telegram/cron-runs: a run that sent nothing, or was cut off, isn't a ✓. */
function CronRunRow({ run }: { run: CronRunInfo }) {
  const v = cronRunView(run);
  const { cls, Icon } = TONE[v.tone];
  return (
    <tr className="border-t border-white/10 align-top">
      <td className="py-2 pr-3 text-white">{JOB_LABEL[run.job] ?? run.job}</td>
      <td className="py-2 pr-3 text-gray-300">{run.day}</td>
      <td className={`py-2 pr-3 ${cls}`}>
        <span className="inline-flex items-center gap-1">
          <Icon className="h-3.5 w-3.5 shrink-0" /> {v.label}
        </span>
        {v.lines.map((line, i) => (
          <span key={i} className={`mt-0.5 block break-words text-xs ${LINE_CLS[v.tone]}`}>
            {line}
          </span>
        ))}
      </td>
      <td className="py-2 text-gray-400">{when(run.at)}</td>
    </tr>
  );
}

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, tone, detail, hint }: { label: string; tone: Tone; detail: React.ReactNode; hint?: React.ReactNode }) {
  const { cls, Icon } = TONE[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-white">{label}</span>
        <span className={`flex min-w-0 items-center gap-1.5 text-sm ${cls}`}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-all">{detail}</span>
        </span>
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.8em] text-averna-cyan">{children}</code>
);

export function TelegramPanel({ initial }: { initial: TelegramAdminStatus | null }) {
  const [status, setStatus] = useState<TelegramAdminStatus | null>(initial);
  const [busy, setBusy] = useState<"refresh" | "set_webhook" | "test_message" | null>(null);

  const refresh = async () => {
    setBusy("refresh");
    try {
      const res = await fetch("/api/admin/telegram", { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error || `Server xatosi (${res.status}).`);
      setStatus(body as TelegramAdminStatus);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Holatni yuklab boʻlmadi.");
    } finally {
      setBusy(null);
    }
  };

  const run = async (action: "set_webhook" | "test_message") => {
    setBusy(action);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; status?: TelegramAdminStatus | null } | null;
      if (body?.status) setStatus(body.status);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `Server xatosi (${res.status}).`);
      toast.success(body.message || "Bajarildi.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amalni bajarib boʻlmadi.");
    } finally {
      setBusy(null);
    }
  };

  if (!status) {
    return (
      <div className="glass rounded-2xl border border-white/10 p-6 text-center">
        <p className="text-sm text-gray-300">Holatni yuklab boʻlmadi.</p>
        <button type="button" onClick={() => void refresh()} className={`${BTN} mt-3 border border-white/15 text-gray-200 hover:bg-white/5`}>
          {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Qayta urinish
        </button>
      </div>
    );
  }

  const { config, bot, webhook, counts, me } = status;
  const cronRuns = status.cronRuns ?? [];
  const hook = webhook && webhook.ok ? webhook : null;
  const hookHere = !!hook?.url && hook.url === status.expectedWebhookUrl;
  const canSetWebhook = config.ready && !!status.expectedWebhookUrl && !status.preview;
  const totalActive = (Object.keys(counts) as LinkRole[]).reduce((n, r) => n + counts[r].active, 0);

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className="glass rounded-2xl border border-white/10 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Holat</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!!busy}
            className={`${BTN} border border-white/15 px-3 py-1.5 text-gray-200 hover:bg-white/5`}
          >
            {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Yangilash
          </button>
        </div>
        <div className="space-y-2">
          <Row label="Bot tokeni (TELEGRAM_BOT_TOKEN)" tone={config.token ? "ok" : "bad"} detail={config.token ? "oʻrnatilgan" : "yoʻq"} />
          <Row
            label="Bot username (TELEGRAM_BOT_USERNAME)"
            tone={!config.username ? "bad" : status.usernameMatches === false ? "warn" : "ok"}
            detail={config.username ? `@${config.username}` : "yoʻq yoki notoʻgʻri"}
            hint={
              status.usernameMatches === false && bot && bot.ok
                ? `Botning haqiqiy usernameʼi: @${bot.username}. Havolalar notoʻgʻri botga olib boradi — oʻzgaruvchini tuzating.`
                : undefined
            }
          />
          <Row
            label="Webhook kaliti (TELEGRAM_WEBHOOK_SECRET)"
            tone={config.secretValid ? "ok" : "bad"}
            detail={!config.secret ? "yoʻq" : config.secretValid ? "oʻrnatilgan" : "notoʻgʻri format"}
            hint={
              config.secret && !config.secretValid ? "16–256 ta belgi, faqat A–Z, a–z, 0–9, _ va - (masalan: openssl rand -hex 32)." : undefined
            }
          />
          <Row
            label="Kunlik xabarlar (CRON_SECRET)"
            tone={config.cronSecret ? "ok" : "warn"}
            detail={config.cronSecret ? "oʻrnatilgan" : "yoʻq"}
            hint={
              config.cronSecret
                ? "Har kuni kechqurun (taxminan 19:00 da, Toshkent vaqti) yuboriladi."
                : "Usiz kechki kunlik xabarlar yuborilmaydi."
            }
          />
          <Row
            label="Bot"
            tone={!bot ? "warn" : bot.ok ? "ok" : "bad"}
            detail={!bot ? "—" : bot.ok ? `@${bot.username} · ${bot.firstName}` : bot.error}
          />
          <Row
            label="Webhook"
            tone={!webhook ? "warn" : !webhook.ok ? "bad" : hookHere ? "ok" : hook?.url ? "warn" : "bad"}
            detail={
              !webhook
                ? "—"
                : !webhook.ok
                  ? webhook.error
                  : !webhook.url
                    ? "oʻrnatilmagan"
                    : hookHere
                      ? "toʻgʻri manzilga ulangan"
                      : webhook.url
            }
            hint={
              hook ? (
                <>
                  {hook.url && !hookHere ? "Webhook boshqa manzilga ulangan (masalan, ikkinchi Vercel loyihasi) — bu ham ishlaydi, agar oʻsha loyihada ham aynan shu kalitlar boʻlsa. " : null}
                  {hook.pendingUpdateCount > 0 ? `Navbatda: ${hook.pendingUpdateCount} ta yangilanish. ` : null}
                  {hook.lastErrorMessage ? `Oxirgi xato (${when(hook.lastErrorDate)}): ${hook.lastErrorMessage}` : null}
                  {hook.lastErrorMessage && /\b30[1-8]\b|redirect|moved/i.test(hook.lastErrorMessage)
                    ? " — domen boshqa manzilga yoʻnaltiryapti, Telegram esa redirectga ergashmaydi: NEXTAUTH_URL ga toʻgʻridan-toʻgʻri javob beradigan manzilni yozing va webhookni qayta oʻrnating."
                    : null}
                </>
              ) : undefined
            }
          />
          <Row
            label="Ilova havolasi (xabarlardagi tugma)"
            tone={config.appUrl ? "ok" : "warn"}
            detail={config.appUrl ?? "yoʻq"}
            hint={config.appUrl ? undefined : "NEXTAUTH_URL (https) yoki Vercel production domeni kerak — usiz xabarlar tugmasiz boradi."}
          />
        </div>
        <p className={`mt-4 text-sm ${config.ready ? "text-averna-neon" : "text-yellow-300"}`}>
          {config.ready
            ? "Telegram yoqilgan: ulash, bildirishnomalar va kunlik xabarlar ishlaydi."
            : "Telegram hali oʻchiq: yuqoridagi uchta TELEGRAM_* oʻzgaruvchisi kerak. Usiz bildirishnomalar faqat ilova ichida qoladi."}
        </p>
      </section>

      {/* Linked chats */}
      <section className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">
          Ulangan chatlar <span className="text-sm font-normal text-gray-400">· faol: {totalActive}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(ROLE_LABEL) as LinkRole[]).map((r) => (
            <div key={r} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-xs text-gray-400">{ROLE_LABEL[r]}</p>
              <p className="text-2xl font-bold text-white">{counts[r].active}</p>
              {counts[r].inactive > 0 && <p className="text-xs text-gray-500">toʻxtatilgan: {counts[r].inactive}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Daily jobs (cron_runs) */}
      <section className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <History className="h-5 w-5 text-averna-cyan" /> Kunlik ishlar{" "}
          <span className="text-sm font-normal text-gray-400">· oxirgi ishga tushirishlar</span>
        </h2>
        {cronRuns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Ish</th>
                  <th className="pb-2 pr-3 font-medium">Kun</th>
                  <th className="pb-2 pr-3 font-medium">Holat</th>
                  <th className="pb-2 font-medium">Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {cronRuns.map((run) => (
                  <CronRunRow key={`${run.job}:${run.day}`} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Hali birorta ishga tushirish yoʻq — cron har kuni kechqurun (taxminan 19:00 da) ishlaydi.</p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Ikkala Vercel loyihasining cronʼi ham ishlaydi: kunni shu ishni bajara oladigan loyiha oladi. Xato bilan tugagan yoki uzilib
          qolgan ishni oʻsha kuni keyingi ishga tushirish qayta bajaradi. Raqamlar ish oxirida yozib qoʻyilgan natija: nechta xabar
          yuborildi, nechtasi xato berdi yoki vaqt/limit tufayli yuborilmay qoldi.
        </p>
      </section>

      {/* Actions */}
      <section className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Amallar</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void run("set_webhook")}
            disabled={!!busy || !canSetWebhook}
            className={`${BTN} neon-button bg-averna-primary text-white hover:bg-averna-light`}
          >
            {busy === "set_webhook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />} Webhookni oʻrnatish
          </button>
          <button
            type="button"
            onClick={() => void run("test_message")}
            disabled={!!busy || !config.token || !me.linked}
            className={`${BTN} border border-white/15 text-gray-200 hover:bg-white/5`}
          >
            {busy === "test_message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Test xabar yuborish
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs text-gray-400">
          {status.preview && (
            <p className="text-yellow-300">
              Bu preview deployment — webhookni faqat production saytidan oʻrnatish mumkin (aks holda bot hamma uchun ishlamay qoladi).
            </p>
          )}
          <p>
            Webhook manzili:{" "}
            {status.expectedWebhookUrl ? (
              <Code>{status.expectedWebhookUrl}</Code>
            ) : (
              <span className="text-yellow-300">faqat HTTPS domen orqali ochilganda oʻrnatiladi.</span>
            )}
          </p>
          <p>
            Manzil <Code>NEXTAUTH_URL</Code> dan olinadi (u boʻlmasa — Vercel production domeni). Bu domen soʻrovga toʻgʻridan-toʻgʻri
            javob berishi kerak: Telegram yoʻnaltirishga (redirect, masalan <Code>averna.uz</Code> → <Code>www.averna.uz</Code>)
            ergashmaydi. Domen yoʻnaltirsa, <Code>NEXTAUTH_URL</Code> ga oxirgi manzilni yozing, redeploy qiling va webhookni qayta
            oʻrnating.
          </p>
          <p>
            Test xabar sizning Telegramʼingizga boradi
            {me.linked ? (
              me.username ? ` (@${me.username})` : ""
            ) : (
              <>
                {" "}
                — avval{" "}
                <Link href="/settings" className="text-averna-cyan hover:underline">
                  Settings → Telegram
                </Link>{" "}
                orqali ulaning
              </>
            )}
            .
          </p>
        </div>
      </section>

      {/* Setup */}
      <section className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Sozlash bosqichlari</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-300 marker:text-averna-cyan">
          <li>
            Telegramʼda <b>@BotFather</b> ni oching → <Code>/newbot</Code> → botga nom va username bering (username <Code>bot</Code> bilan
            tugaydi). BotFather sizga <b>token</b> beradi.
          </li>
          <li>
            Bot guruhlarga qoʻshilmasin: <b>@BotFather</b> → <Code>/setjoingroups</Code> → botingizni tanlang → <b>Disable</b>.
            Hisobotlar faqat shaxsiy chatlarga boradi, guruhlardagi xabarlarga bot javob bermaydi.
          </li>
          <li>
            Vercel → Project → Settings → Environment Variables:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <Code>TELEGRAM_BOT_TOKEN</Code> — BotFather bergan token
              </li>
              <li>
                <Code>TELEGRAM_BOT_USERNAME</Code> — bot username, @ belgisisiz (masalan <Code>AvernaSchoolBot</Code>)
              </li>
              <li>
                <Code>TELEGRAM_WEBHOOK_SECRET</Code> — 16+ belgi, faqat A–Z, a–z, 0–9, _ va - (masalan <Code>openssl rand -hex 32</Code>)
              </li>
              <li>
                <Code>CRON_SECRET</Code> — istalgan tasodifiy satr (16+ belgi): har kuni kechqurun (taxminan 19:00 da) yuboriladigan
                xabarlar uchun
              </li>
            </ul>
            <p className="mt-2 text-xs text-gray-400">Ikkala Vercel loyihasiga ham aynan bir xil qiymatlarni kiriting — bitta bot, bitta baza.</p>
          </li>
          <li>Redeploy qiling — oʻzgaruvchilar faqat yangi deploydan keyin ishlaydi.</li>
          <li>
            Shu sahifani saytning production domenida oching va <b>Webhookni oʻrnatish</b> tugmasini bosing (preview deploymentʼda bu
            tugma ishlamaydi). Webhook <Code>NEXTAUTH_URL</Code> domeniga (u boʻlmasa, Vercel production domeniga) oʻrnatiladi — bu
            domen redirectsiz javob berishi kerak. Botning «/» buyruqlar menyusi ham shu tugma bilan yangilanadi, shuning uchun yangi
            deploydan keyin uni yana bir marta bosing.
          </li>
          <li>
            <Link href="/settings" className="text-averna-cyan hover:underline">
              Settings → Telegram
            </Link>{" "}
            → <b>Connect Telegram</b> orqali oʻz Telegramʼingizni ulang va <b>Test xabar yuborish</b> ni bosing.
          </li>
          <li>
            Ota-onalar: oʻqituvchi (yoki admin) oʻquvchining <b>Parent report</b> sahifasida taklif havolasini yaratib, ota-onaga yuboradi.
            Oʻsha yerda ulangan ota-onalar roʻyxati ham bor — notoʻgʻri odamga tushgan ulanishni <b>Remove</b> bilan oʻchirish mumkin; ota-ona
            esa botga <Code>/disconnect</Code> yuborib oʻzi uzilishi mumkin.
          </li>
        </ol>
      </section>
    </div>
  );
}
