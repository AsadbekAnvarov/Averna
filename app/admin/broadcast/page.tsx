export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";
import { AccountNotice } from "@/components/account-notice";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { Send, ArrowLeft } from "lucide-react";

export default async function AdminBroadcastPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Panel
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Send className="h-8 w-8 text-averna-cyan" />
          Broadcast <span className="neon-text-cyan">Composer</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Quickly compose announcements from templates and send them to your students via Telegram. 📣
        </p>
        <BroadcastComposer />
      </div>
    </div>
  );
}
