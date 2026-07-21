import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent page header used across the app so every screen shares the same
 * rhythm: an optional "back" link, a responsive title with an accent icon,
 * an optional subtitle, and an optional right-aligned action slot.
 *
 * Standardises title sizing to `text-3xl sm:text-4xl` and the icon to h-8 w-8
 * everywhere, replacing the ad-hoc mix of text-3xl/text-4xl + h-8/h-10 icons.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  back,
  iconClassName = "text-averna-cyan",
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  iconClassName?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8", className)}>
      {back && (
        <Link
          href={back.href}
          className="text-averna-neon hover:underline text-sm mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            {Icon && <Icon className={cn("h-8 w-8 shrink-0", iconClassName)} />}
            <span className="min-w-0">{title}</span>
          </h1>
          {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
