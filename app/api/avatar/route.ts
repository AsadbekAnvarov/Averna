import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_LEN = 500_000; // ~500KB cap for a base64 data URL

/**
 * Role-agnostic avatar update. Accepts a preset character URL or a (resized)
 * base64 data URL and stores it on the current user. Send an empty string to
 * remove the avatar.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { image } = await req.json();

    if (typeof image !== "string") {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
    if (image.length > MAX_LEN) {
      return NextResponse.json({ error: "Image too large — pick a smaller size." }, { status: 413 });
    }
    // Only allow http(s) URLs or image data URLs
    if (image && !/^(https?:\/\/|data:image\/)/.test(image)) {
      return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { image: image || null },
    });

    return NextResponse.json({ success: true, image: image || null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
