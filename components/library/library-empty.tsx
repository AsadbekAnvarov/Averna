import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

/** Calm empty state for a library list (no tests at all, or none match the filters). */
export function LibraryEmpty({
  icon: Icon = SearchX,
  title,
  description,
  action,
  secondary,
}: {
  icon?: typeof SearchX;
  title: string;
  description: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div role="status" className="av-panel rounded-2xl px-6 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-averna-neon/10 text-averna-neon" aria-hidden>
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">{description}</p>
      {(action || secondary) && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {action && (
            <Link
              href={action.href}
              className="glow-cta inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light"
            >
              {action.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="glow-hover inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-5 text-sm font-medium text-gray-300 hover:text-white"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
