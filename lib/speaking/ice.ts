/**
 * ICE servers for peer voice calls. Public STUN always; TURN only when configured
 * (TURN_URLS comma-separated `turn:`/`turns:` URLs + TURN_USERNAME + TURN_CREDENTIAL).
 * Without TURN roughly 10–20% of calls on mobile data / CGNAT networks can't connect.
 * The TURN credential is sent to signed-in students only — the browser needs it.
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const STUN_SERVERS: IceServerConfig[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

type Env = Record<string, string | undefined>;

/** STUN plus TURN from the environment (server side). TURN needs URLs and both credentials. */
export function iceServersFromEnv(env: Env, includeTurn = true): IceServerConfig[] {
  const servers = [...STUN_SERVERS];
  if (!includeTurn) return servers;
  const urls = (env.TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => /^turns?:[^\s]+$/i.test(u));
  const username = env.TURN_USERNAME?.trim();
  const credential = env.TURN_CREDENTIAL?.trim();
  if (urls.length && username && credential) servers.push({ urls, username, credential });
  return servers;
}

/** Defensive read of `iceServers` from /api/speaking/capabilities (client side). */
export function parseIceServers(x: unknown): IceServerConfig[] {
  if (!Array.isArray(x)) return STUN_SERVERS;
  const out: IceServerConfig[] = [];
  for (const s of x) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const urls = Array.isArray(o.urls) ? o.urls.filter((u): u is string => typeof u === "string") : typeof o.urls === "string" ? o.urls : null;
    if (!urls || (Array.isArray(urls) && !urls.length)) continue;
    out.push({
      urls,
      ...(typeof o.username === "string" ? { username: o.username } : {}),
      ...(typeof o.credential === "string" ? { credential: o.credential } : {}),
    });
  }
  return out.length ? out : STUN_SERVERS;
}
