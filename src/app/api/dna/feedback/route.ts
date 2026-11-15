import { NextResponse } from "next/server";

import { isDnaFeedbackKind } from "@/lib/dna/feedback";
import { serialiseDnaProfile } from "@/lib/dna/present";
import { getDnaProfile, recordDnaFeedback } from "@/lib/dna/repository";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit } from "@/lib/services/rateLimitService";

// Correcting a profile is a real click, not a batch job, but calibrating all
// 17 traits in one sitting is legitimate — hence roomy but not unlimited.
const FEEDBACK_LIMIT = 30;

/**
 * Records one correction ("this is right", "this isn't me", "more of this",
 * "less of this", "forget it") and returns the refreshed profile.
 *
 * The response carries the same payload as GET /api/dna so the page can replace
 * its state in one round-trip instead of guessing what the correction did.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  if (!checkRateLimit(`dna-feedback-${userId}`, FEEDBACK_LIMIT)) {
    return NextResponse.json({ error: "Too many corrections. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as { traitKey?: unknown; kind?: unknown };
  const traitKey = typeof payload.traitKey === "string" ? payload.traitKey.trim() : "";

  if (!traitKey || traitKey.length > 60) {
    return NextResponse.json({ error: "A valid traitKey is required" }, { status: 400 });
  }
  if (!isDnaFeedbackKind(payload.kind)) {
    return NextResponse.json({ error: "Unknown feedback kind" }, { status: 400 });
  }

  try {
    const accepted = await recordDnaFeedback(userId, traitKey, payload.kind);
    if (!accepted) {
      return NextResponse.json({ error: "Unknown trait" }, { status: 404 });
    }

    const stored = await getDnaProfile(userId);
    return NextResponse.json(serialiseDnaProfile(stored));
  } catch (error) {
    console.error("Failed to record DNA feedback:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
