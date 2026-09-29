export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { requestOrigin, telegramAdminStatus } from "@/lib/telegram/admin";
import type { TelegramAdminStatus } from "@/lib/telegram/types";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { TelegramPanel } from "@/components/admin/telegram-panel";

/**
 * Admin → Telegram: the Averna bot's configuration, webhook, linked chats and
 * daily runs. (Setup is documented in .env.example.)
 */
export default async function AdminTelegramPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  let initial: TelegramAdminStatus | null = null;
  try {
    initial = await telegramAdminStatus(requestOrigin(headers()), session.user.id);
  } catch (e) {
    console.error("admin telegram page: status failed", e);
    initial = null; // the panel offers "Qayta urinish"
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Send}
          iconClassName="text-averna-cyan"
          title={
            <>
              Telegram <span className="neon-text-cyan">boti</span>
            </>
          }
          subtitle="Oʻquvchilar, oʻqituvchilar, administratorlar va ota-onalar uchun bildirishnomalar va kunlik hisobotlar Telegramʼda."
        />
        <TelegramPanel initial={initial} />
      </div>
    </div>
  );
}
