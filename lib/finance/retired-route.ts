import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trustedMutation } from "@/lib/security/same-origin";
/** Keep old URLs fail-closed. Never read, export, import or mutate financial data. */
export async function retiredFinance(request: Request, mutation = false) {
 const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
 const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
 if (mutation && !trustedMutation(request)) return reply("Untrusted origin", 403);
 const s = await auth(); if (!s?.user) return reply("Unauthorized", 401);
 if (s.user.role !== "ADMIN") return reply("Forbidden", 403);
 return reply("Buxgalteriya Averna oʻquv platformasidan olib tashlangan.", 410);
}
