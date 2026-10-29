/** Server-only registry: immutable GitHub asset IDs, never access tokens or keys. */
import registry from "./private-media.json";
export interface PrivateMediaAsset { id: number; bytes: number; sha256: string; kind: string }
const assets: Record<string, PrivateMediaAsset> = registry.assets;
const urls: Record<string, string> = registry.urls;
export const PRIVATE_MEDIA_REPOSITORY = registry.repository;
export function privateMediaAsset(file: string): PrivateMediaAsset | null {
  return /^[a-z0-9][a-z0-9.-]{0,180}$/.test(file) && Object.hasOwn(assets, file) ? assets[file] : null;
}
/** Rewrite only verified, exact original URLs. Never accept an arbitrary fetch target. */
export function privateMediaUrl(original: string): string {
  if (process.env.LISTENING_PRIVATE_MEDIA !== "on") return original;
  const file = Object.hasOwn(urls, original) ? urls[original] : undefined;
  return file ? `/api/listening/media/${file}` : original;
}
