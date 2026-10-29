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
    <div className={cn("av-card-grid av-tool-grid grid auto-rows-fr grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {tools.map(({ slug, title, blurb, icon: Icon, color, bg }) => (
        <Link
          key={slug}
          href={`/studio/${slug}`}
          className="av-tool-card group av-panel flex h-full min-h-[180px] min-w-0 flex-col gap-4 rounded-2xl border border-white/10 p-5 transition-colors hover:border-averna-neon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon"
        >
          <div className="flex items-center justify-between">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", bg, color)}>
              <Icon className="h-5 w-5" />
            </span>
            <ArrowRight className="h-4 w-4 text-gray-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="min-h-[2.75rem] break-words text-base font-semibold leading-snug text-white">{title}</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-gray-400">{blurb}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
