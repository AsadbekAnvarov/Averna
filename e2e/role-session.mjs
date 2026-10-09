/**
 * In-memory, per-origin/role auth cookies for seeded E2E accounts. Each scenario
 * still gets a fresh browser context and its own local/session storage. Never
 * bypass the app's rate limiter or write session cookies to an artifact.
 */
export function createRoleSessionCache() {
  const sessions = new Map();
  return async function ensureSignedIn(context, origin, role, credentials, signIn) {
    const key = `${new URL(origin).origin}:${role}`;
    const cookies = sessions.get(key);
    if (cookies) {
      await context.addCookies(structuredClone(cookies));
      return;
    }
    await signIn(context, credentials);
    sessions.set(key, structuredClone(await context.cookies(origin)));
  };
}
