import Link from "next/link";

/** CDI sample questions are examiner resources, not a fabricated computer Speaking test. */
export function TeacherSpeakingPractice({ teacher = false }: { teacher?: boolean }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6" aria-labelledby="teacher-speaking-title">
      <p className="text-sm font-semibold text-averna-cyan">Averna CDI · Speaking</p>
      <h1 id="teacher-speaking-title" className="mt-2 text-2xl font-semibold text-white">Speaking with your teacher</h1>
      <p className="mt-3 text-base leading-relaxed text-gray-300">Practise an interview with your teacher: Part 1 questions, the Part 2 long turn and the Part 3 discussion. Agree which part to practise before starting, or complete all three for a full Mock interview.</p>
      <ol className="my-6 grid gap-3 sm:grid-cols-3">
        {["Part 1 · Interview", "Part 2 · Long turn", "Part 3 · Discussion"].map(part => <li key={part} className="av-panel rounded-xl p-4 text-sm font-medium text-white">{part}</li>)}
      </ol>
      <p className="text-sm leading-relaxed text-gray-400">Your teacher chooses the questions and assesses your speaking. Averna CDI samples are teacher resources; they are not complete Speaking papers and are not scored by AI.</p>
      <Link href={teacher ? "/teacher/mock/sessions" : "/learning/mock-exam"} className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-averna-primary px-5 text-sm font-semibold text-white">Open teacher-led Mock sessions</Link>
      <Link href="/learning" className="ml-4 inline-flex min-h-[44px] items-center text-sm text-gray-300">Back to Learning</Link>
    </section>
  );
}
