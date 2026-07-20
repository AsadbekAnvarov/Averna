export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Settings, User, Bell, Wallet, Palette, ChevronRight } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role?: string }).role;
  const profileHref =
    role === "ADMIN" ? "/admin/profile" : role === "TEACHER" ? "/teacher/profile" : "/profile";

  const accountLinks = [
    { href: profileHref, label: "Edit profile", desc: "Name, avatar and goal", icon: User },
    { href: "/notifications", label: "Notifications", desc: "View recent alerts", icon: Bell },
    ...(role === "STUDENT"
      ? [{ href: "/billing", label: "Billing", desc: "Payments and plan", icon: Wallet }]
      : []),
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Settings className="h-8 w-8 text-averna-cyan" />
          Settings
        </h1>
        <p className="text-gray-400 mb-8">Manage your account and personalise how Averna looks and feels.</p>

        {/* Account */}
        <SectionHeader icon={User} title="Account" subtitle={session.user.email ?? undefined} accent="text-averna-neon" />
        <div className="glass rounded-2xl border border-white/5 divide-y divide-white/5 mb-8 overflow-hidden">
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
        </div>

        {/* Appearance & comfort */}
        <SectionHeader icon={Palette} title="Appearance & Comfort" subtitle="Preferences are saved on this device" accent="text-averna-cyan" />
        <div className="glass rounded-2xl border border-white/5 p-5">
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}
