/** Server-only. Issue short-lived download URLs; GitHub credentials never leave this module. */
import { PRIVATE_MEDIA_REPOSITORY, type PrivateMediaAsset } from "./private-media";
const cache = new Map<number, { url: string; until: number }>();
const pending = new Map<number, Promise<string>>();
export function isSignedAssetUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "release-assets.githubusercontent.com" && !u.username && !u.password && !u.port; }
  catch { return false; }
}
export async function githubMediaLocation(asset: PrivateMediaAsset): Promise<string> {
  const token = process.env.LISTENING_GITHUB_TOKEN;
  if (!token || process.env.LISTENING_PRIVATE_MEDIA !== "on") throw new Error("private_media_unconfigured");
  const saved = cache.get(asset.id);
  if (saved && saved.until > Date.now()) return saved.url;
  const active = pending.get(asset.id); if (active) return active;
  const request = (async () => {
    const response = await fetch(`https://api.github.com/repos/${PRIVATE_MEDIA_REPOSITORY}/releases/assets/${asset.id}?download=1&t=${Math.floor(Date.now()/60000)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/octet-stream", "X-GitHub-Api-Version": "2022-11-28" },
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (response.status !== 302 || !location || !isSignedAssetUrl(location)) throw new Error("private_media_upstream");
    // Signed links normally last one hour. Reuse for at most five minutes and never near expiry.
    const parsed = new URL(location); const expires = Date.parse(parsed.searchParams.get("se") ?? "");
    const until = Math.min(Date.now() + 300000, Number.isFinite(expires) ? expires - 60000 : Date.now() + 60000);
    if (until <= Date.now()) throw new Error("private_media_expired");
    cache.set(asset.id, { url: location, until }); return location;
  })();
  pending.set(asset.id, request);
  try { return await request; } finally { pending.delete(asset.id); }
}
