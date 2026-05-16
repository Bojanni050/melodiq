import { NextRequest, NextResponse } from "next/server";
import { getPoYoCredits } from "@/lib/providers/poyo";
import { getTempolorCredits } from "@/lib/providers/tempolor";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

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
