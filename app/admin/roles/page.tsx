export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, KeyRound, Info } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { recordAudit } from "@/lib/audit";
import {
  can,
  ADMIN_ROLE_OPTIONS,
  roleLabel,
  allowedModules,
  isAdminArea,
} from "@/lib/engine/permissions";

/**
 * Change a staff member's role. Only roles that belong to the admin area can be
 * assigned here — student and teacher accounts are managed by their own flows, so
 * this page can't accidentally strip someone's teaching access.
 */
async function setRole(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "roles")) redirect("/auth/signin");

  const userId = formData.get("userId") as string;
  const role = (formData.get("role") as string)?.trim();
  if (!userId || !isAdminArea(role)) return;

  // Guard against locking yourself out of role management entirely.
  if (userId === session.user.id && role !== "ADMIN" && role !== "OWNER") {
    return;
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!target || !isAdminArea(target.role)) return; // never touch students/teachers

  await db.user.update({ where: { id: userId }, data: { role: role as UserRole } });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Changed staff role",
    `email=${target.email} ${target.role} -> ${role}`
  );
  revalidatePath("/admin/roles");
}

export default async function AdminRolesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (!can(session.user.role, "roles")) {
    return <AccountNotice title="Ruxsat yoʻq" message="Rollarni faqat administrator boshqaradi." />;
  }

  const staff = await db.user.findMany({
    where: { role: { in: ["ADMIN", "OWNER", "FINANCE_MANAGER", "ACCOUNTANT", "RECEPTION"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={ShieldCheck}
          iconClassName="text-averna-purple"
          title={<span className="neon-text">Rollar va ruxsatlar</span>}
          subtitle="Har bir xodim faqat oʻz ishiga kerakli boʻlimlarni koʻradi."
        />

        {/* Role reference */}
        <Card className="glass border-averna-purple/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-purple text-base">
              <KeyRound className="h-4 w-4" /> Rollar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {ADMIN_ROLE_OPTIONS.map((r) => (
                <div key={r.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{r.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{r.description}</p>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    {allowedModules(r.key).length} boʻlim
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Staff list */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Xodimlar ({staff.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-gray-400 text-sm">Xodim akkauntlari topilmadi.</p>
            ) : (
              <div className="space-y-2">
                {staff.map((u) => {
                  const isSelf = u.id === session.user.id;
                  return (
                    <form
                      key={u.id}
                      action={setRole}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <input type="hidden" name="userId" value={u.id} />
                      <div className="sm:w-64 min-w-0">
                        <p className="text-white text-sm truncate">
                          {u.name ?? "Nomsiz"}
                          {isSelf && <span className="text-[10px] text-gray-500 ml-1.5">(siz)</span>}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="w-full rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple"
                        >
                          {ADMIN_ROLE_OPTIONS.map((r) => (
                            <option key={r.key} value={r.key} className="bg-averna-dark">
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-[11px] text-gray-500 sm:w-28 shrink-0">
                        {roleLabel(u.role)}
                      </span>
                      <Button type="submit" size="sm" variant="outline" className="border-white/20 text-gray-300 shrink-0">
                        Saqlash
                      </Button>
                    </form>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-gray-400 space-y-1">
            <p>
              Bu sahifa faqat xodim rollarini oʻzgartiradi — oʻquvchi va oʻqituvchi akkauntlariga
              tegmaydi, shuning uchun tasodifan oʻqituvchilik huquqini olib qoʻyish mumkin emas.
            </p>
            <p>
              Oʻzingizni administratorlikdan chiqarib yubormaslik uchun oʻz rolingizni faqat
              Administrator yoki Egasi qilib qoldirish mumkin.
            </p>
            <p>
              Ruxsat har bir sahifada tekshiriladi (nafaqat menyuda yashiriladi), shuning uchun
              havolani qoʻlda kiritish ham ishlamaydi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
