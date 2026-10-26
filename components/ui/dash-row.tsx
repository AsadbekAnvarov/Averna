import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Even dashboard rows. A DashRow is the one grid every side-by-side row of
 * widgets uses (student tabs, teacher and admin dashboards): one column on
 * phones, `cols` columns from the `at` breakpoint, the same gaps everywhere,
 * and every cell stretched to the tallest card in its row (see ".dash-row" in
 * app/globals.css — a wrapper div's single card fills its cell too, and an
 * empty cell takes no space).
 *
 * Widget cards wear DASH_CARD so their frames match (radius, 1 px border) and
 * their body can grow; short single-purpose widgets centre their content in
 * the space they get with DASH_CENTER.
 */

export type DashRowCols = 2 | 3 | 4 | 5;
export type DashRowAt = "md" | "lg";

/** Spelled out in full so Tailwind's content scan generates every class. */
const COLS: Record<DashRowAt, Record<DashRowCols, string>> = {
  md: { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" },
  lg: { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" },
};

/** Base classes of every dashboard row (the gaps the rows have always used). */
export const DASH_ROW = "dash-row grid grid-cols-1 gap-3 md:gap-4 lg:gap-5";

/** The shared widget frame: same radius + 1 px border, fills its row cell, body can grow. */
export const DASH_CARD = "dash-card rounded-2xl border h-full flex flex-col";

/** Body of a short single-purpose widget: vertically centred in the space left. */
export const DASH_CENTER = "flex-1 flex flex-col justify-center";

export interface DashRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Columns from the `at` breakpoint up. Default 2. */
  cols?: DashRowCols;
  /** Breakpoint where the row stops stacking. Default "lg". */
  at?: DashRowAt;
}

export function dashRowClass(cols: DashRowCols = 2, at: DashRowAt = "lg", className?: string): string {
  return cn(DASH_ROW, COLS[at][cols], className);
}

export function DashRow({ cols = 2, at = "lg", className, children, ...rest }: DashRowProps) {
  return (
    <div className={dashRowClass(cols, at, className)} {...rest}>
      {children}
    </div>
  );
}
