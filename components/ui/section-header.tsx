import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * A consistent section heading used to group dashboard zones
 * ("Today", "Needs action", "Analytics", "Management"). Gives every panel the
 * same rhythm and visual language.
 */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  accent = "text-averna-neon",
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  accent?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4 mt-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
