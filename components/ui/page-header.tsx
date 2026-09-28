import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent page header used across the app so every screen shares the same
 * rhythm: an optional "back" link, a responsive title with an accent icon,
 * an optional subtitle, and an optional right-aligned action slot.
 *
 * Standardises title sizing (`text-2xl` on phones → `text-4xl` on desktop) and the icon
 * everywhere; on phones the action slot drops under the title instead of squeezing it.
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
    <div className={cn("mb-6 sm:mb-8", className)}>
      {back && (
        <Link
          href={back.href}
          className="text-averna-neon hover:underline text-sm mb-3 sm:mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
            {Icon && <Icon className={cn("h-7 w-7 sm:h-8 sm:w-8 shrink-0", iconClassName)} />}
            <span className="min-w-0">{title}</span>
          </h1>
          {subtitle && <p className="text-sm sm:text-base text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="sm:shrink-0">{action}</div>}
      </div>
    </div>
  );
}
