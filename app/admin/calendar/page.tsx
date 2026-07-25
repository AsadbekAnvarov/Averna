export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, ArrowRight, Repeat, AlertTriangle, Wallet } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { recordAudit } from "@/lib/audit";
import { getCalendar, EVENT_TYPES, TYPE_ACCENT, eventTypeLabel } from "@/lib/engine/calendar-engine";

const fmt = (n: number) => n.toLocaleString("en-US");

const WEEKDAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d)}`;
}

async function addEvent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const type = (formData.get("type") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const startsRaw = (formData.get("startsAt") as string)?.trim();
  const amountRaw = (formData.get("amount") as string)?.trim();
  const recurring = (formData.get("recurring") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!type || !title || !startsRaw) return;

  await db.businessEvent.create({
    data: {
      type,
      title,
      startsAt: new Date(startsRaw),
      amount: amountRaw ? Math.max(0, Math.round(Number(amountRaw))) : null,
      recurring: recurring === "none" ? null : recurring,
      notes,
      createdById: session.user.id,
      createdByName: session.user.name ?? "Admin",
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Added business event",
    `type=${type} title=${title} date=${startsRaw} recurring=${recurring ?? "none"}`
  );
  revalidatePath("/admin/calendar");
}

async function deleteEvent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const id = formData.get("id") as string;
  if (!id) return;
  const row = await db.businessEvent.findUnique({ where: { id }, select: { title: true } });
  await db.businessEvent.delete({ where: { id } });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted business event",
    `title=${row?.title ?? id}`
  );
  revalidatePath("/admin/calendar");
}

export default async function AdminCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const cal = await getCalendar();
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={CalendarDays}
          iconClassName="text-averna-purple"
          title={<span className="neon-text">Biznes kalendari</span>}
          subtitle="Toʻlov muddatlari, maoshlar, ijara va yigʻilishlar — bitta jadvalda."
        />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="glass border-averna-purple/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-purple flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Rejalashtirilgan</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-purple">{cal.items.length}</p><p className="text-[11px] text-gray-500">keyingi 60 kun</p></CardContent>
          </Card>
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-cyan flex items-center gap-1"><Wallet className="h-4 w-4" /> Jami summa</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-cyan">{fmt(cal.totalScheduled)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-red-500/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-red-300 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Muddati oʻtgan</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-300">{cal.overdueCount}</p><p className="text-[11px] text-gray-500">oxirgi 7 kun</p></CardContent>
          </Card>
        </div>

        {/* Add event */}
        <Card className="glass border-averna-purple/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-purple text-base">
              <Plus className="h-4 w-4" /> Voqea qoʻshish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addEvent} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Turi</label>
                <select name="type" required defaultValue="" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple">
                  <option value="" disabled className="bg-averna-dark">— Tanlang —</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.key} value={t.key} className="bg-averna-dark">{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Nomi</label>
                <input name="title" required placeholder="masalan, Ofis ijarasi" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Sana</label>
                <input name="startsAt" type="date" required className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Summa (ixtiyoriy)</label>
                <input name="amount" type="number" min="0" step="10000" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Takrorlanish</label>
                <select name="recurring" defaultValue="none" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white">
                  <option value="none" className="bg-averna-dark">Takrorlanmaydi</option>
                  <option value="monthly" className="bg-averna-dark">Har oy</option>
                  <option value="yearly" className="bg-averna-dark">Har yil</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Izoh (ixtiyoriy)</label>
                <input name="notes" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
              </div>
              <div className="lg:col-span-3">
                <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light">
                  Qoʻshish
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Agenda */}
        {cal.days.length === 0 ? (
          <Card className="glass border-white/10">
            <CardContent className="py-8 text-center">
              <CalendarDays className="h-10 w-10 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium">Jadval boʻsh</p>
              <p className="text-sm text-gray-400 mt-1">
                Voqea qoʻshing, yoki oʻquvchilarga toʻlov kunini belgilang — muddatlar avtomatik paydo boʻladi.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cal.days.map((d) => {
              const past = d.dateKey < todayKey;
              const isToday = d.dateKey === todayKey;
              return (
                <div key={d.dateKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-sm font-semibold ${isToday ? "text-averna-neon" : past ? "text-red-300" : "text-white"}`}>
                      {dayLabel(d.date)}
                      {isToday && " · bugun"}
                    </p>
                    <div className="flex-1 h-px bg-white/10" />
                    {past && <span className="text-[10px] text-red-300">muddati oʻtgan</span>}
                  </div>

                  <div className="space-y-2">
                    {d.items.map((i) => (
                      <div
                        key={i.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${TYPE_ACCENT[i.type] ?? TYPE_ACCENT.OTHER}`}>
                              {i.typeLabel}
                            </span>
                            <span className="truncate">{i.title}</span>
                            {i.recurring && <Repeat className="h-3 w-3 text-gray-500 shrink-0" />}
                          </p>
                          {i.detail && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{i.detail}</p>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {i.amount != null && (
                            <span className="text-sm font-semibold text-averna-cyan whitespace-nowrap">
                              {fmt(i.amount)}
                            </span>
                          )}
                          {i.href && (
                            <Link href={i.href} className="text-gray-400 hover:text-white" title="Batafsil">
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          )}
                          {i.source === "manual" && (
                            <form>
                              {/* baseId is the real BusinessEvent id, not parsed from the occurrence id. */}
                              <input type="hidden" name="id" value={i.baseId ?? i.id} />
                              <ConfirmButton
                                formAction={deleteEvent}
                                message={`"${i.title}" voqeasini oʻchirasizmi?${i.recurring ? " Barcha takrorlanishlari oʻchadi." : ""}`}
                                title="Oʻchirish"
                                className="h-7 w-7 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              >
                                ×
                              </ConfirmButton>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-gray-500 mt-6">
          Izoh: oʻquvchi toʻlov muddatlari va maosh toʻlovlari jadvalga qoʻlda kiritilmaydi — ular
          haqiqiy maʼlumotdan hisoblanadi, shuning uchun toʻlov qilinsa, yozuv oʻzi yoʻqoladi.
        </p>
      </div>
    </div>
  );
}
