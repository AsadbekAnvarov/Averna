export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SettingsGroup } from "@/components/settings/settings-group";
import { TelegramConnect } from "@/components/settings/telegram-connect";
import { OfflineSettingsRow } from "@/components/offline/offline-settings-row";
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

  // Account and Telegram open the second column (on phones they follow the device groups).
  const account = (
    <>
      <SettingsGroup
        id="account"
        icon={<User />}
        title="Account"
        summary={session.user.email || (role === "STUDENT" ? "Profile, notifications and offline library" : "Profile and notifications")}
        accent="text-averna-neon"
      >
        {accountLinks.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.04] sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-averna-primary/20 text-averna-neon">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="truncate text-xs text-gray-400">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          </Link>
        ))}
        {/* Saved on this device: flashcards, articles, Listening parts (idea 7). */}
        {role === "STUDENT" && <OfflineSettingsRow />}
      </SettingsGroup>
      {/* Telegram bot */}
      <TelegramConnect />
    </>
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-3xl px-4 py-4 pb-8 sm:py-6 lg:max-w-6xl lg:pb-6">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Settings}
          title="Settings"
          subtitle="Manage your account and personalise how Averna looks and feels."
        />

        {/* Display · Reading comfort · Native-language hints | Account · Telegram · Comfort · Sound (saved on this device) */}
        <SettingsPanel student={student} account={account} />
      </div>
    </div>
  );
}
