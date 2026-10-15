import { retiredFinance } from "@/lib/finance/retired-route";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return retiredFinance(request); }
export async function POST(request: Request) { return retiredFinance(request, true); }
