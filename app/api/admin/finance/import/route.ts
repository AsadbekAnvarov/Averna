import { retiredFinance } from "@/lib/finance/retired-route";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return retiredFinance(request, true); }
