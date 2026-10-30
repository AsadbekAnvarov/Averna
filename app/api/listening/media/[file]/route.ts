import { getCurrentUser } from "@/lib/auth";
import { reserveLimits } from "@/lib/security/rate-limit";
import { privateMediaAsset } from "@/lib/ielts/audio/private-media";
import { githubMediaLocation } from "@/lib/ielts/audio/github-media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers });
  const { file } = await context.params;
  const asset = privateMediaAsset(file);
  if (!asset) return new Response(null, { status: 404, headers });
  try {
    const limit = await reserveLimits([{ key: `listening-media:${user.id}`, limit: 180, seconds: 60 }]);
    if (!limit.ok) return new Response(null, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    // A redirect keeps large recordings off Vercel's function-body limit. The browser can
    // request byte ranges directly; only an expiring signed URL, never a GitHub token, is sent.
    const location = await githubMediaLocation(asset);
    return new Response(null, { status: 307, headers: { ...headers, Location: location } });
  } catch { return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "10" } }); }
}
export const HEAD = GET;
