import { NextRequest, NextResponse } from "next/server";
import { getPoYoCredits } from "@/lib/providers/poyo";
import { getTempolorCredits } from "@/lib/providers/tempolor";
import { getMinimaxCredits } from "@/lib/providers/minimax";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [poyoCredits, tempolorCredits, minimaxCredits] = await Promise.all([
    getPoYoCredits(),
    getTempolorCredits(),
    getMinimaxCredits(),
  ]);

  return NextResponse.json({
    lyria: "Pay-per-use",
    poyo: poyoCredits,
    tempolor: tempolorCredits,
    minimax: minimaxCredits,
  });
}
