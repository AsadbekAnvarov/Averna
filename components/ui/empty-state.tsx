import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * A friendly, consistent empty state used across all panels. Turns "0 / nothing
 * here" into guidance with an optional call-to-action, so a fresh platform feels
 * intentional rather than broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  accent = "text-averna-cyan",
  compact = false,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-10"}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-3 ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-white font-semibold">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
