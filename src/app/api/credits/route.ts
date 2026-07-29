import { NextRequest, NextResponse } from "next/server";
import { getPoYoCredits } from "@/lib/providers/poyo";
import { getTempolorCredits } from "@/lib/providers/tempolor";
import { getMinimaxCredits } from "@/lib/providers/minimax";
import { getApiframeCredits } from "@/lib/providers/apiframe";
import { getApimartCredits } from "@/lib/providers/apimart";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [poyoCredits, tempolorCredits, minimaxCredits, apiframeCredits, apimartCredits] = await Promise.all([
    getPoYoCredits(),
    getTempolorCredits(),
    getMinimaxCredits(),
    getApiframeCredits(),
    getApimartCredits(),
  ]);

  return NextResponse.json({
    lyria: "Pay-per-use",
    poyo: poyoCredits,
    tempolor: tempolorCredits,
    minimax: minimaxCredits,
    apiframe: apiframeCredits,
    apimart: apimartCredits,
  });
}
