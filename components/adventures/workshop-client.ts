"use client";
import { z } from "zod";
import { workshopSchema } from "@/lib/adventures/rules";
export const itemSchema = z.object({ id: z.string(), title: z.string(), status: z.enum(["SUBMITTED", "APPROVED", "REJECTED"]), version: z.number().int().positive(), feedback: z.string().nullable(), createdAt: z.string(), authorName: z.string().nullable().optional(), groupName: z.string().optional(), payload: workshopSchema }).passthrough();
export type WorkshopItem = z.infer<typeof itemSchema>;
export async function workshopRequest(url: string, init: RequestInit = {}, signal?: AbortSignal) {
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  const timer = setTimeout(abort, 15_000);
  try {
    let response: Response;
    try { response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } }); }
    catch (error) { if (controller.signal.aborted) throw error; throw new Error("Class sharing request failed. Your device draft is unchanged."); }
    let body;
    try { body = await response.json(); } catch { throw new Error("The server response could not be read. Your device draft is unchanged."); }
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "This change was not saved.");
    return body;
  } catch (error) { if (controller.signal.aborted) throw new Error("The request was interrupted or took too long. Your device draft is unchanged."); throw error; }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export function downloadWorkshop(payload: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "averna-practice-workshop-v1", payload }, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
