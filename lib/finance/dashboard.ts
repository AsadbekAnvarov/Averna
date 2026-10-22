import type { financeSnapshot } from "./service";
/** Retired: accounting is not part of the Averna learning admin portal. No data read. */
export async function getDashboardFinance(): Promise<Awaited<ReturnType<typeof financeSnapshot>> | null> { return null; }
