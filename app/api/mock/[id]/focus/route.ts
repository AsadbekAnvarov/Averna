import { mockFocusPost } from "@/lib/ielts/mock-focus-api";
export const dynamic = "force-dynamic";
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) { return mockFocusPost(request, (await props.params).id); }
