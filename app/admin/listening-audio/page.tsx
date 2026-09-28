export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Headphones } from "lucide-react";
import { auth } from "@/lib/auth";
import { audioOverview } from "@/lib/ielts/audio/store";
import type { AudioOverview } from "@/lib/ielts/audio/admin-types";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ListeningAudioManager } from "@/components/admin/listening-audio-manager";

/**
 * Admin → Listening audio: pre-render every Listening part — the library's
 * tests and the placement test's Listening — to one MP3 with OpenAI voices
 * (British / American / Australian speakers, a British narrator, the exam
 * announcements and pauses baked in), stored in Vercel Blob. Parts without a
 * recording keep using browser voices (and all of them do while
 * LISTENING_AUDIO=off).
 */
export default async function ListeningAudioPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  let initial: AudioOverview | null = null;
  try {
    initial = await audioOverview();
  } catch (e) {
    console.error("listening-audio page: overview failed", e);
    initial = null; // the manager loads it again and shows the error
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-8 pb-24 lg:pb-8">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Headphones}
          iconClassName="text-averna-cyan"
          title={
            <>
              Listening <span className="neon-text-cyan">audio</span>
            </>
          }
          subtitle="Har bir Listening qismi uchun tayyor MP3 yozuv: turli ovozlar, diktor eʼlonlari va pauzalar ichida. Oʻquvchilar uni brauzer ovozi oʻrniga tinglaydi."
        />
        <ListeningAudioManager initial={initial} />
      </div>
    </div>
  );
}
