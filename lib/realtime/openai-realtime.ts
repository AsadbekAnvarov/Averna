/**
 * OpenAI Realtime API — the only module that talks to it (docs/elegance-roadmap.md,
 * idea 3), over plain fetch like lib/openai-audio.ts. SERVER ONLY.
 *
 * Unified WebRTC interface (verified against developers.openai.com, Oct 2026):
 *   POST https://api.openai.com/v1/realtime/calls
 *        multipart/form-data: `sdp` (the browser's offer) + `session` (JSON config)
 *        Authorization: Bearer <key>, OpenAI-Safety-Identifier: sha256(user id)
 *     → 201, body = SDP answer (application/sdp),
 *       Location: /v1/realtime/calls/{call_id}
 *   POST https://api.openai.com/v1/realtime/calls/{call_id}/hangup → ends the call
 * The API key never reaches the browser, and the server knows every call id, so it
 * can hang a call up itself (the hard stop in the start route).
 *
 * Models: OPENAI_REALTIME_MODEL (default gpt-realtime-2.1-mini), input transcription
 * OPENAI_REALTIME_TRANSCRIBE_MODEL (default gpt-4o-transcribe), voice
 * OPENAI_REALTIME_VOICE (default marin). Nothing here logs an SDP or a transcript.
 */
import { createHash } from "node:crypto";
import { hasOpenAI } from "@/lib/ai";

const API = "https://api.openai.com/v1/realtime/calls";

export const realtimeModel = () => process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1-mini";
export const realtimeTranscribeModel = () => process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
export const realtimeVoice = () => process.env.OPENAI_REALTIME_VOICE?.trim() || "marin";

/** Stable, privacy-preserving end-user id for OpenAI's abuse monitoring. */
export const safetyIdentifier = (userId: string) => createHash("sha256").update(userId).digest("hex");

export class RealtimeError extends Error {
  constructor(
    message: string,
    /** HTTP status from OpenAI (0 = network / timeout / bad answer). */
    readonly status: number,
  ) {
    super(message);
    this.name = "RealtimeError";
  }
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k || !hasOpenAI()) throw new RealtimeError("OpenAI is not configured.", 0);
  return k;
}

/** The call id from a Location header ("/v1/realtime/calls/rtc_123" or a full URL), or null. */
export function callIdFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const path = location.split(/[?#]/)[0].replace(/\/+$/, "");
  const id = path.split("/").pop() ?? "";
  return /^[A-Za-z0-9_-]{4,200}$/.test(id) ? id : null;
}

export interface CreatedCall {
  callId: string;
  /** SDP answer for the browser's setRemoteDescription. */
  answer: string;
}

/** Create one call. Throws RealtimeError (status = OpenAI's, 0 for network / unusable answer). */
export async function createRealtimeCall(input: {
  sdp: string;
  session: Record<string, unknown>;
  userId: string;
  timeoutMs?: number;
}): Promise<CreatedCall> {
  const form = new FormData();
  form.set("sdp", input.sdp);
  form.set("session", JSON.stringify(input.session));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey()}`, "OpenAI-Safety-Identifier": safetyIdentifier(input.userId) },
      body: form,
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof RealtimeError) throw e;
    throw new RealtimeError(ctrl.signal.aborted ? "Realtime call timed out." : "Realtime call failed (network).", 0);
  }
  try {
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      // OpenAI's error message only — the body never echoes the SDP back.
      let message = "";
      try {
        message = String((JSON.parse(body) as { error?: { message?: unknown } })?.error?.message ?? "").slice(0, 200);
      } catch {
        /* not JSON */
      }
      throw new RealtimeError(`Realtime call refused (${res.status})${message ? `: ${message}` : ""}`, res.status);
    }
    const callId = callIdFromLocation(res.headers.get("location"));
    if (!callId || !body.trim().startsWith("v=")) throw new RealtimeError("Realtime call answer was unusable.", 0);
    return { callId, answer: body };
  } finally {
    clearTimeout(timer);
  }
}

/** End a call. True when OpenAI confirmed it (or the call was already gone: 404). Never throws. */
export async function hangupRealtimeCall(callId: string, timeoutMs = 8_000): Promise<boolean> {
  if (!callIdFromLocation(callId)) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/${encodeURIComponent(callId)}/hangup`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey()}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
