/**
 * A question group's map / plan / diagram, above its questions. A white panel
 * keeps scanned drawings readable in the dark theme (and is neutral in the light
 * one); the full-size link opens the file itself for small screens.
 *
 * No hooks: used by the exam (client, question-group.tsx) and by the answer
 * review on the result pages (server, review-group.tsx).
 */
export function GroupImage({ src, alt }: { src: string; alt: string }) {
  const label = alt?.trim() || "Diagram for these questions";
  return (
    <figure className="mb-4 overflow-hidden rounded-xl border border-slate-300 bg-white p-2 sm:p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        className="mx-auto h-auto max-h-[60vh] w-auto max-w-full rounded-md object-contain"
      />
      <figcaption className="sr-only">{label}</figcaption>
      <p className="mt-2 text-right text-[0.8em]">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
        >
          Open full size<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </figure>
  );
}
