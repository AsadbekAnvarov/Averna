import { NextRequest } from "next/server";
import { requestAccountLink } from "@/lib/account/link-route";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  return requestAccountLink(req, "reset");
}
