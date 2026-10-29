/** Recording_Host budget (GitHub Pages site: 1 GB) and exact host confirmation. */

export const HOST_BUDGET_BYTES = 1024 ** 3;

export type BudgetDecision = { ok: true } | { ok: false; usedBytes: number | null; newBytes: number; limitBytes: number };

/** Upload only when the used size is known and used + new ≤ the limit. */
export function budgetDecision(usedBytes: number | null, newBytes: number, limit = HOST_BUDGET_BYTES): BudgetDecision {
  if (usedBytes == null || !Number.isFinite(usedBytes) || usedBytes < 0 || usedBytes + newBytes > limit) {
    return { ok: false, usedBytes: usedBytes != null && Number.isFinite(usedBytes) ? usedBytes : null, newBytes, limitBytes: limit };
  }
  return { ok: true };
}

/** The hostname of a URL, or null (never throws, never echoes the URL). */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Writing / uploading proceeds only when the expected host is given and equals
 * the actual host exactly. The message never contains the URL or credentials.
 */
export function confirmHost(expected: string | undefined | null, actualUrl: string | undefined | null): { ok: true } | { ok: false; message: string } {
  const actual = hostOf(actualUrl);
  if (!expected) return { ok: false, message: "Pass the expected host explicitly (--expected-host / --expected-upload-host)." };
  if (!actual) return { ok: false, message: "The target URL is missing or invalid." };
  if (actual !== expected) return { ok: false, message: "The expected host does not match the target; nothing was written." };
  return { ok: true };
}
