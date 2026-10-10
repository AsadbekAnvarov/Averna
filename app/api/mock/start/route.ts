import { mockPost } from "@/lib/ielts/mock-api";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return mockPost("start", request); }
