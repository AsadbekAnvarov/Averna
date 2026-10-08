/** State-changing browser calls must originate on the served host. CLI calls still require route auth. */
export function trustedMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return true;
  try {
    const internal = new URL(request.url);
    // Next's internal URL may use localhost while the browser uses a public host.
    // The ingress must preserve Host and replace (not append untrusted) forwarding headers.
    const host = request.headers.get("host") ?? internal.host;
    const scheme =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      internal.protocol.slice(0, -1);
    if (scheme !== "http" && scheme !== "https") return false;
    return new URL(rawOrigin).origin === new URL(`${scheme}://${host}`).origin;
  } catch {
    return false;
  }
}
