import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

/**
 * Standard error state: clear message, calm red accent, an explanation and a
 * recovery action. Never just "Error."
 */
export function ErrorPanel({
  title = "Something went wrong.",
  detail,
  retryHref,
  retryLabel = "Try again",
}: {
  title?: string;
  detail?: string;
  retryHref?: string;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="error-surface flex items-start gap-3 rounded-2xl p-4 sm:p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-200">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-red-100/80">{detail}</p>}
        {retryHref && (
          <Link
            href={retryHref}
            className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-400/40 px-3 text-sm font-medium text-red-200 transition hover:bg-red-500/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> {retryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
