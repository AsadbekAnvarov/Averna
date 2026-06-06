export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { AuditLogSearch, type AuditRow } from "@/components/admin/audit-log-search";
import { formatDateTime } from "@/lib/utils";

export default async function AdminLogsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  let raw: { id: string; actorName: string; role: string; action: string; detail: string | null; createdAt: Date }[] = [];
  try {
    raw = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  } catch {
    raw = [];
  }
  const logs: AuditRow[] = raw.map((l) => ({
    id: l.id,
    actorName: l.actorName,
    role: l.role,
    action: l.action,
    detail: l.detail,
    dateStr: formatDateTime(l.createdAt),
  }));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Admin Panel</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-averna-cyan" /> Audit <span className="neon-text-cyan">Log</span>
        </h1>
        <p className="text-gray-400 mb-6">A searchable record of important admin &amp; teacher actions across the centre.</p>

        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><ShieldCheck className="h-5 w-5" /> Activity</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">No audit entries yet. Actions like enrolling students, creating groups/teachers and moderating rewards will appear here.</p>
            ) : (
              <AuditLogSearch logs={logs} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
