import { NextResponse } from "next/server";
import { buildHomeworkLibrary } from "@/lib/homework/library";
import { homeworkStaff } from "@/lib/homework/staff";

export const dynamic = "force-dynamic";

/**
 * GET — everything a teacher can set as exam homework, as summaries for the
 * picker: Reading / Listening papers with their passages / parts, Writing
 * Task 1 / Task 2 prompts and Speaking sets. No passages, scripts, answer keys
 * or model answers ever leave the server.
 */
export async function GET() {
  const staff = await homeworkStaff();
  if (!staff.ok) return staff.response;
  try {
    const library = await buildHomeworkLibrary();
    return NextResponse.json(library, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    console.error("Homework library failed:", e);
    return NextResponse.json({ error: "The test library couldn't be loaded. Please try again." }, { status: 500 });
  }
}
