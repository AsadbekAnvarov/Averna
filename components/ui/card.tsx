import * as React from "react";
import { cn } from "@/lib/utils";

/** Sides each padding utility touches (ps/pe map to left/right in LTR). */
const PAD_SIDES: Record<string, string> = { p: "trbl", px: "rl", py: "tb", pt: "t", pr: "r", pb: "b", pl: "l", ps: "l", pe: "r" };

/**
 * The `sm:` half of a card part's default padding, minus the sides the caller
 * already pads at the base size. twMerge only resolves conflicts within one
 * variant, so without this a caller's `py-8` or `p-6` would lose to the
 * default `sm:p-5` from 640px up. Sides the caller owns keep the caller's
 * value at every width; the other sides still get the roomier desktop padding.
 * (Tokens are spelled out in full so Tailwind's content scan generates them.)
 */
function smPadding(defaults: string, top: "sm:pt-0" | "sm:pt-5", className?: string): string {
  const owned = new Set<string>();
  for (const token of className?.split(/\s+/) ?? []) {
    const m = /^!?(p[xytrblse]?)-/.exec(token);
    if (m) for (const side of PAD_SIDES[m[1]] ?? "") owned.add(side);
  }
  if (owned.size === 0) return defaults;
  const free = (side: string) => !owned.has(side);
  return [
    free("t") && top,
    free("r") && free("l") ? "sm:px-5" : free("r") ? "sm:pr-5" : free("l") && "sm:pl-5",
    free("b") && "sm:pb-5",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A caller-chosen title size (e.g. `text-base`) applies at every width. */
const FONT_SIZE = /^!?text-(?:xs|sm|base|lg|\d?xl|\[\d[\d.]*(?:px|rem|em)\])$/;

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-4", smPadding("sm:p-5", "sm:pt-5", className), className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight",
      !className?.split(/\s+/).some((t) => FONT_SIZE.test(t)) && "sm:text-xl",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", smPadding("sm:p-5 sm:pt-0", "sm:pt-0", className), className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0", smPadding("sm:p-5 sm:pt-0", "sm:pt-0", className), className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
