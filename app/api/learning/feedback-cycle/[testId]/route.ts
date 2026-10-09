import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { trustedMutation } from "@/lib/security/same-origin";
import { reserveLimits } from "@/lib/security/rate-limit";
import { CycleError, learningCycleEnabled } from "@/lib/learning-cycle/rules";
import { getCycle, mutateCycle } from "@/lib/learning-cycle/service";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "private, no-store", "vary": "Cookie" } });
async function viewer() { try { return await requireAuth(); } catch { throw new CycleError("Sign in again to continue. Your draft stays in this tab.", 401); } }
function failure(e: unknown) { if (e instanceof CycleError) return json({ error: e.message }, e.status); console.error("Learning cycle request failed", e instanceof Error ? e.name : "unknown"); return json({ error: "This request could not be completed. Keep your draft and try again." }, 503); }
export async function GET(_req: Request, props: { params: Promise<{ testId: string }> }) {
  if (!learningCycleEnabled()) return json({ error: "Practice cycles are not enabled." }, 404);
  try { return json({ cycle: await getCycle(await viewer(), (await props.params).testId) }); } catch (e) { return failure(e); }
}
async function boundedJson(req: Request): Promise<unknown> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new CycleError("Send the response as JSON.", 415);
  if (Number(req.headers.get("content-length")) > 90000) throw new CycleError("The response is too large.", 413);
  if (!req.body) throw new CycleError("The response is missing.");
  const reader = req.body.getReader(); const decoder = new TextDecoder(); let size = 0, text = "";
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 90000) { await reader.cancel(); throw new CycleError("The response is too large.", 413); } text += decoder.decode(value, { stream: true }); } text += decoder.decode(); }
  finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { throw new CycleError("The response could not be read."); }
}
export async function POST(req: Request, props: { params: Promise<{ testId: string }> }) {
  if (!learningCycleEnabled()) return json({ error: "Practice cycles are not enabled." }, 404);
  if (!trustedMutation(req)) return json({ error: "Open Averna directly before saving." }, 403);
  try {
    const user = await viewer(); const body = await boundedJson(req); const { testId } = await props.params;
    const limit = await reserveLimits([{ key: `learning-cycle-write:${user.id}`, limit: 60, seconds: 60 }]);
    if (!limit.ok) return json({ error: limit.unavailable ? "Saving is temporarily unavailable. Keep your draft and retry." : "Please wait a minute before saving again." }, limit.unavailable ? 503 : 429);
    await mutateCycle(user, testId, body); return json({ ok: true, cycle: await getCycle(user, testId) });
  } catch (e) { return failure(e); }
}
