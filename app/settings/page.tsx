export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { TelegramConnect } from "@/components/settings/telegram-connect";
import { OfflineSettingsRow } from "@/components/offline/offline-settings-row";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import { Settings, User, Bell, ChevronRight } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role?: string }).role;
  const profileHref =
    role === "ADMIN" ? "/admin/profile" : role === "TEACHER" ? "/teacher/profile" : "/profile";

  // Native-language hints are a student setting: their level decides "At my level",
  // their profile language becomes a suggestion. A failed read still shows the setting.
  const student =
    role === "STUDENT"
      ? await db.student
          .findUnique({ where: { userId: (session.user as { id?: string }).id ?? "" }, select: { level: true, nativeLanguage: true } })
          .then((s) => ({ level: s?.level ?? null, nativeLanguage: s?.nativeLanguage ?? null }))
          .catch(() => ({ level: null, nativeLanguage: null }))
      : null;

  const accountLinks = [
    { href: profileHref, label: "Edit profile", desc: "Name, avatar and goal", icon: User },
    { href: "/notifications", label: "Notifications", desc: "View recent alerts", icon: Bell },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-3xl pb-8 lg:pb-6">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Settings}
          title="Settings"
          subtitle="Manage your account and personalise how Averna looks and feels."
        />

        {/* Account */}
        <SectionHeader icon={User} title="Account" subtitle={session.user.email ?? undefined} accent="text-averna-neon" />
        <div className="glass rounded-2xl border border-white/5 divide-y divide-white/5 mb-6 overflow-hidden">
          {accountLinks.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 p-4 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-averna-primary/20 text-averna-neon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white text-sm">{label}</p>
                <p className="text-xs text-gray-400 truncate">{desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </Link>
          ))}
          {/* Saved on this device: flashcards, articles, Listening parts (idea 7). */}
          {role === "STUDENT" && <OfflineSettingsRow />}
        </div>

        {/* Telegram bot */}
        <TelegramConnect />

        {/* Display · Reading comfort · Native-language hints · Comfort · Sound (saved on this device) */}
        <SettingsPanel student={student} />
      </div>
    </div>
  );
}
