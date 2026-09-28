import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STUDIO_TOOLS, type StudioGroup } from "@/components/studio/studio-tools";

/**
 * A tidy grid of Practice Studio tiles (2 per row on phones). Each tile opens
 * the tool on its own page.
 */
export function StudioShelf({
  group,
  exclude,
  limit,
  className,
}: {
  group: StudioGroup;
  exclude?: string;
  limit?: number;
  className?: string;
}) {
  const tools = STUDIO_TOOLS.filter((t) => t.group === group && t.slug !== exclude).slice(0, limit);

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {tools.map(({ slug, title, blurb, icon: Icon, color, bg }) => (
        <Link
          key={slug}
          href={`/studio/${slug}`}
          className="group glass flex flex-col gap-3 rounded-2xl border border-white/10 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
        >
          <div className="flex items-center justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", bg, color)}>
              <Icon className="h-5 w-5" />
            </span>
            <ArrowRight className="h-4 w-4 text-gray-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-white">{title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{blurb}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
