import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { trustedMutation } from "@/lib/security/same-origin";
import { reserveLimits } from "@/lib/security/rate-limit";
import { ToolError } from "./rules";
export const toolJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export function toolFailure(e: unknown) { if (e instanceof ToolError) return toolJson({ error: e.message }, e.status); console.error("Teacher tools request failed", e instanceof Error ? e.name : "unknown"); return toolJson({ error: "The request could not be completed. Keep your input and retry." }, 503); }
export async function toolActor() { try { return await requireAuth(); } catch { throw new ToolError("Sign in again to continue.", 401); } }
export async function toolCommand(req: Request, key: string, actorId: string) {
  if (!trustedMutation(req)) throw new ToolError("Open Averna directly before saving.", 403);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new ToolError("Send JSON input.", 415);
  if (Number(req.headers.get("content-length")) > 90000) throw new ToolError("This input is too large.", 413);
  if (!req.body) throw new ToolError("Input is missing."); const reader = req.body.getReader(); const decoder = new TextDecoder(); let size = 0, body = "";
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 90000) { await reader.cancel(); throw new ToolError("This input is too large.", 413); } body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { reader.releaseLock(); }
  let input: unknown; try { input = JSON.parse(body); } catch { throw new ToolError("Input could not be read."); }
  const limit = await reserveLimits([{ key: `${key}:${actorId}`, limit: 60, seconds: 60 }]); if (!limit.ok) throw new ToolError(limit.unavailable ? "Saving is temporarily unavailable. Keep your input." : "Wait a minute before trying again.", limit.unavailable ? 503 : 429);
  return input;
}
