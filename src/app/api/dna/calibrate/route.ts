import { NextResponse } from "next/server";

import {
  CALIBRATION_TOTAL,
  calibrationCardText,
  calibrationPairKey,
  feedbackKindForChoice,
  pickCalibrationPair,
  sortPairIds,
  type CalibrationCandidate,
  type CalibrationChoice,
  type CalibrationPair,
} from "@/lib/dna/calibration";
import {
  getDnaProfile,
  loadCalibrationAnswers,
  loadCalibrationCandidates,
  recordCalibrationAnswer,
} from "@/lib/dna/repository";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit } from "@/lib/services/rateLimitService";

// A duel is a click plus a 10 second listen, so 40 of them in one sitting stays
// well under this; the cap only stops a runaway loop.
const CALIBRATE_LIMIT = 60;

type CardPayload = {
  id: string;
  text: string;
  audioUrl: string;
  duration: number | null;
  value: number;
};

function card(candidate: CalibrationCandidate, value: number): CardPayload {
  return {
    id: candidate.id,
    text: calibrationCardText(candidate),
    audioUrl: candidate.audioUrl,
    duration: candidate.duration,
    value,
  };
}

function presentPair(pair: CalibrationPair | null) {
  if (!pair) return null;
  return {
    traitKey: pair.traitKey,
    left: card(pair.left, pair.leftValue),
    right: card(pair.right, pair.rightValue),
  };
}

/** Next duel plus progress. Shared by GET and by the POST response. */
async function nextState(userId: string) {
  const [stored, candidates, answered] = await Promise.all([
    getDnaProfile(userId),
    loadCalibrationCandidates(userId),
    loadCalibrationAnswers(userId),
  ]);

  const done = answered.length >= CALIBRATION_TOTAL;
  const availableTraitKeys = new Set(stored?.traits.map((trait) => trait.traitKey) ?? []);
  const pair = done || !stored ? null : pickCalibrationPair({ candidates, availableTraitKeys, answered });

  return {
    pair: presentPair(pair),
    answered: Math.min(answered.length, CALIBRATION_TOTAL),
    total: CALIBRATION_TOTAL,
    // Tells the UI why there is no duel, so it can say something useful.
    reason: pair ? null : done ? "done" : !stored ? "no_profile" : "no_pairs",
  };
}

/** Returns the next calibration duel and how far the user is. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await nextState(auth.userId));
  } catch (error) {
    console.error("Failed to load calibration duel:", error);
    return NextResponse.json({ error: "Failed to load calibration" }, { status: 500 });
  }
}

/**
 * Records one answer ("left", "right" or "neither") and returns the next duel.
 * The client only names the two tracks; the values are re-read on the server so
 * a tampered request cannot turn a "less" into a "more".
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(`dna-calibrate-${userId}`, CALIBRATE_LIMIT)) {
    return NextResponse.json({ error: "Too many answers. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    traitKey?: unknown;
    leftId?: unknown;
    rightId?: unknown;
    choice?: unknown;
  };
  const traitKey = typeof payload.traitKey === "string" ? payload.traitKey.trim() : "";
  const leftId = typeof payload.leftId === "string" ? payload.leftId : "";
  const rightId = typeof payload.rightId === "string" ? payload.rightId : "";
  const choice = payload.choice;

  if (!traitKey || traitKey.length > 60 || !leftId || !rightId || leftId === rightId) {
    return NextResponse.json({ error: "A valid duel is required" }, { status: 400 });
  }
  if (choice !== "left" && choice !== "right" && choice !== "neither") {
    return NextResponse.json({ error: "Unknown choice" }, { status: 400 });
  }

  try {
    const candidates = await loadCalibrationCandidates(userId);
    const left = candidates.find((candidate) => candidate.id === leftId);
    const right = candidates.find((candidate) => candidate.id === rightId);
    const leftValue = left ? (traitKey === "tempo" ? left.tempo : traitKey === "energy" ? left.energy : null) : null;
    const rightValue = right ? (traitKey === "tempo" ? right.tempo : traitKey === "energy" ? right.energy : null) : null;

    if (!left || !right || !leftValue || !rightValue) {
      return NextResponse.json({ error: "Unknown duel" }, { status: 404 });
    }

    const answered = await loadCalibrationAnswers(userId);
    const key = calibrationPairKey(traitKey, leftId, rightId);
    const alreadyAnswered = answered.some(
      (entry) => calibrationPairKey(entry.traitKey, entry.trackAId, entry.trackBId) === key,
    );

    if (!alreadyAnswered && answered.length < CALIBRATION_TOTAL) {
      const pair: CalibrationPair = { traitKey, left, right, leftValue, rightValue };
      const [trackAId, trackBId] = sortPairIds(leftId, rightId);
      const stored = await recordCalibrationAnswer(userId, {
        traitKey,
        trackAId,
        trackBId,
        choice: choice === "neither" ? "neither" : (choice === "left" ? leftId : rightId) === trackAId ? "a" : "b",
        kind: feedbackKindForChoice(pair, choice as CalibrationChoice),
      });
      if (!stored) {
        return NextResponse.json({ error: "Unknown trait" }, { status: 404 });
      }
    }

    return NextResponse.json(await nextState(userId));
  } catch (error) {
    console.error("Failed to record calibration answer:", error);
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
  }
}
