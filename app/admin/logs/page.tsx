export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, ShieldCheck } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/utils";

export default async function AdminLogsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  let logs: { id: string; actorName: string; role: string; action: string; detail: string | null; createdAt: Date }[] = [];
  try {
    logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  } catch {
    logs = [];
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Back to Admin Panel" }}
          icon={ScrollText}
          iconClassName="text-averna-cyan"
          title={<>Audit <span className="neon-text-cyan">Log</span></>}
          subtitle="A record of important admin & teacher actions across the centre."
        />

        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><ShieldCheck className="h-5 w-5" /> Recent Activity ({logs.length})</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">No audit entries yet. Actions like enrolling students, creating groups/teachers and moderating rewards will appear here.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 shrink-0 mt-0.5">
                      {l.role}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm">
                        <span className="font-medium">{l.actorName}</span> — {l.action}
                      </p>
                      {l.detail && <p className="text-xs text-gray-400 break-words">{l.detail}</p>}
                      <p className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(l.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
