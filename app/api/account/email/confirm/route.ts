import { NextRequest } from "next/server";
import { confirmAccountLink } from "@/lib/account/link-route";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  return confirmAccountLink(req, "verify");
}
