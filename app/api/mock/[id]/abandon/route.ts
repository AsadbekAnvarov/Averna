import { mockPost } from "@/lib/ielts/mock-api";
export const dynamic = "force-dynamic";
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) { return mockPost("abandon", request, (await props.params).id); }
