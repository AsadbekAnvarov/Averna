import { cn, initialsOf } from "@/lib/utils";

/**
 * Shared avatar. Shows the user's photo when present, otherwise coloured
 * initials. Size/border go in `className`; background + text colour go in
 * `fallbackClassName`, so each usage keeps its own look while sharing one
 * implementation (and one source of truth for initials).
 */
export function Avatar({
  name,
  image,
  className,
  fallbackClassName,
  alt,
}: {
  name?: string | null;
  image?: string | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex items-center justify-center shrink-0",
        className
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt ?? name ?? "Avatar"} className="h-full w-full object-cover" />
      ) : (
        <span className={cn("font-bold", fallbackClassName)}>{initialsOf(name)}</span>
      )}
    </div>
  );
}
