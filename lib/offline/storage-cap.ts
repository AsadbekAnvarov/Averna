/**
 * Offline storage budget (idea 7): everything saved for offline on a device stays under
 * OFFLINE_CAP_BYTES (150 MB), and a save never pushes the browser's own quota past 90 %.
 * Pure: the sizes come from the packs and navigator.storage.estimate().
 */
import { OFFLINE_CAP_BYTES } from "./constants";

export interface SaveCheckInput {
  /** Bytes the saved packs use now. */
  usedBytes: number;
  /** Bytes the new pack needs. */
  addBytes: number;
  /** Bytes of an older copy of the same pack that the save replaces. */
  replacingBytes?: number;
  capBytes?: number;
  /** navigator.storage.estimate(): the origin's quota and usage, when known. */
  quota?: number;
  usage?: number;
}

export interface SaveCheck {
  ok: boolean;
  /** "cap": over Averna's offline cap · "quota": the browser has no room · null: fine. */
  reason: "cap" | "quota" | null;
  /** What the packs would use after the save. */
  afterBytes: number;
  capBytes: number;
}

/** Share of the browser quota a save may fill up to. */
export const QUOTA_SHARE = 0.9;

const size = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function checkSave(input: SaveCheckInput): SaveCheck {
  const capBytes = input.capBytes ?? OFFLINE_CAP_BYTES;
  const add = size(input.addBytes);
  const afterBytes = Math.max(0, size(input.usedBytes) - size(input.replacingBytes)) + add;
  if (afterBytes > capBytes) return { ok: false, reason: "cap", afterBytes, capBytes };
  const quota = size(input.quota);
  if (quota > 0 && size(input.usage) + add > quota * QUOTA_SHARE) return { ok: false, reason: "quota", afterBytes, capBytes };
  return { ok: true, reason: null, afterBytes, capBytes };
}

/** Sum of the packs' sizes (bad values count as 0). */
export function totalBytes(packs: readonly { bytes: number }[]): number {
  return packs.reduce((sum, p) => sum + size(p.bytes), 0);
}

/** "640 KB", "4.2 MB", "150 MB". */
export function formatBytes(bytes: number): string {
  const b = size(bytes);
  const MB = 1024 * 1024;
  if (b < MB) return `${Math.max(b > 0 ? 1 : 0, Math.round(b / 1024))} KB`;
  const mb = b / MB;
  return mb < 10 ? `${(Math.round(mb * 10) / 10).toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
