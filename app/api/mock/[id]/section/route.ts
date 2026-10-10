import { mockPost } from "@/lib/ielts/mock-api";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) { return mockPost("section", request, (await props.params).id); }
