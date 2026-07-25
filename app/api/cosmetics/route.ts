import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tashkentDateKey } from "@/lib/utils";
import { COSMETICS, grantCosmetic } from "@/lib/cosmetics";

export const dynamic = "force-dynamic";

async function getStudent(userId: string) {
  return db.student.findUnique({
    where: { userId },
    select: { id: true, cosmetics: true, featuredCosmetic: true, cosmeticBoxAt: true },
  });
}

function canOpen(cosmeticBoxAt: Date | null): boolean {
  if (!cosmeticBoxAt) return true;
  return tashkentDateKey(cosmeticBoxAt) !== tashkentDateKey();
}

export async function GET() {
  try {
    const user = await requireAuth();
    const student = await getStudent(user.id);
    if (!student) return NextResponse.json({ error: "No student profile" }, { status: 403 });
    return NextResponse.json({
      owned: student.cosmetics ?? [],
      featured: student.featuredCosmetic ?? null,
      canOpen: canOpen(student.cosmeticBoxAt),
    });
  } catch (error: any) {
    console.error("Cosmetics GET error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await getStudent(user.id);
    if (!student) return NextResponse.json({ error: "No student profile" }, { status: 403 });

    const body = await req.json();
    const owned = student.cosmetics ?? [];

    if (body.action === "open") {
      if (!canOpen(student.cosmeticBoxAt)) {
        return NextResponse.json({ error: "Already opened today", canOpen: false, owned, featured: student.featuredCosmetic ?? null }, { status: 409 });
      }
      const { reward, duplicate } = grantCosmetic(owned);
      const nextOwned = duplicate ? owned : [...owned, reward.id];
      await db.student.update({
        where: { id: student.id },
        data: { cosmetics: nextOwned, cosmeticBoxAt: new Date() },
      });
      return NextResponse.json({ reward, duplicate, owned: nextOwned, canOpen: false, featured: student.featuredCosmetic ?? null });
    }

    if (body.action === "feature") {
      const id: string | null = typeof body.id === "string" ? body.id : null;
      if (id && (!COSMETICS.some((c) => c.id === id) || !owned.includes(id))) {
        return NextResponse.json({ error: "You don't own that cosmetic" }, { status: 400 });
      }
      // toggle off if same id already featured
      const featured = id === student.featuredCosmetic ? null : id;
      await db.student.update({ where: { id: student.id }, data: { featuredCosmetic: featured } });
      return NextResponse.json({ featured, owned });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Cosmetics POST error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
