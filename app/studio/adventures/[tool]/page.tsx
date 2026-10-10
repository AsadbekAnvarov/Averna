export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { Compass } from "lucide-react";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { adventure } from "@/lib/adventures/catalog";
import { Series, Detective, Debate, Rescue } from "@/components/adventures/guided-tools";
import { QuestionWorkshop } from "@/components/adventures/question-workshop";
import { VoiceCapsules } from "@/components/adventures/voice-capsules";
import "@/components/adventures/adventures.css";
export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) { const item = adventure((await params).tool); return { title: item ? `${item.title} · Adventures` : "Adventures" }; }
export default async function AdventurePage({ params }: { params: Promise<{ tool: string }> }) {
  const item = adventure((await params).tool); if (!item) notFound();
  const { student, session } = await getPageStudent();
  if (!student) return <AccountNotice title="Student account required" message="Sign in with a student account to practise." />;
  const owner = session!.user.id;
  return <div className="min-h-screen premium-gradient"><div className="container mx-auto max-w-4xl px-4 py-6 pb-10 sm:py-8"><PageHeader className="adventure-header" back={{ href: "/studio/adventures", label: "All adventures" }} icon={Compass} title={item.title} subtitle={item.description} /><div className="adventure-space"><p className="adv-kicker adv-tool-meta">{item.skill} · {item.minutes}</p>{item.slug === "series" && <Series owner={owner} />}{item.slug === "detective" && <Detective owner={owner} />}{item.slug === "debate" && <Debate owner={owner} />}{item.slug === "rescue" && <Rescue owner={owner} />}{item.slug === "builder" && <QuestionWorkshop owner={owner} sharing={process.env.ADVENTURE_WORKSHOP === "on"} />}{item.slug === "capsules" && <VoiceCapsules owner={owner} />}</div></div></div>;
}
