import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPoYoCredits } from "@/lib/providers/poyo";
import { getTempolorCredits } from "@/lib/providers/tempolor";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [poyoCredits, tempolorCredits] = await Promise.all([
    getPoYoCredits(),
    getTempolorCredits(),
  ]);

  return NextResponse.json({
    lyria: "Pay-per-use",
    poyo: poyoCredits,
    tempolor: tempolorCredits,
  });
}
