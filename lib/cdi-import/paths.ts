/** Output location rule of the importer: never inside the (public) repository. */

import * as path from "path";

/** True when `out` is outside `root` (case-insensitive, as on Windows). */
export function outsideRepo(out: string, root: string): boolean {
  const a = path.resolve(out).toLowerCase();
  const r = path.resolve(root).toLowerCase();
  return a !== r && !a.startsWith(r + path.sep);
}
