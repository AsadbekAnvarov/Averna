import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { compareTestTitles } from "@/lib/ielts/catalog-order";
export const dynamic = "force-dynamic";
const resourceSchema = z.object({
  title: z.string(), prompt: z.string(), paragraphs: z.array(z.string()),
  speakingQuestions: z.array(z.string()),
  images: z.array(z.object({ url: z.string().url().refine(v => v.startsWith("https://")), alt: z.string() })),
});
export default async function Page() {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  if (session.user.role !== "TEACHER") return redirect("/dashboard");
  const rows = await db.generatedTest.findMany({ where: { module: "CDI_SAMPLE", published: true }, select: { id: true, data: true }, orderBy: { title: "asc" } });
  const samples = rows.flatMap(row => { const parsed = resourceSchema.safeParse(row.data); return parsed.success ? [{ ...parsed.data, id: row.id }] : []; }).sort(compareTestTitles);
  return <main className="container mx-auto max-w-5xl space-y-4 sm:space-y-5 px-4 py-6">
    <Link href="/teacher/mock/sessions" className="inline-flex min-h-[44px] items-center text-averna-light">← Teacher-led sessions</Link>
    <header className="av-panel rounded-2xl p-6"><h1 className="text-2xl font-bold">CDI teaching resources</h1>
      <p className="mt-3 text-gray-300">Supplied Writing samples and discussion prompts. A sample is not a verified band score. Speaking remains a teacher-conducted Parts 1–3 assessment; these prompts do not prove that an interview took place.</p>
    </header>
    {!samples.length && <p className="text-gray-300">No supplied samples have been published yet.</p>}
    {samples.map((sample, index) => <section key={sample.id} className="av-panel space-y-4 rounded-2xl p-5 sm:p-7">
      <h2 className="text-xl font-semibold"><span className="text-averna-cyan">Resource {index + 1}</span> · {sample.title}</h2>
      <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-gray-200">{sample.prompt}</p>
      {sample.images.map(image => <figure key={image.url} className="overflow-auto rounded-xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt} loading="lazy" className="mx-auto h-auto max-w-full" />
      </figure>)}
      <h3 className="font-semibold">Supplied model response</h3>
      {sample.paragraphs.map((paragraph, index) => <p key={index} className="leading-relaxed text-gray-200">{paragraph}</p>)}
      {!!sample.speakingQuestions.length && <div className="rounded-xl border border-averna-purple/30 p-4">
        <h3 className="font-semibold">Teacher-led discussion prompts</h3>
        <p className="mt-2 text-sm text-gray-300">Choose suitable topics yourself. Do not use these samples as an automatic Speaking score or substitute for the complete interview.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">{sample.speakingQuestions.map(question => <li key={question}>{question}</li>)}</ol>
      </div>}
    </section>)}
  </main>;
}
