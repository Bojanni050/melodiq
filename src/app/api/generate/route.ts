export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { validateProviderApiKeys } from "@/lib/settings";
import { users } from "@/db/schema";
import { checkRateLimit } from "@/lib/services/rateLimitService";
import { resolveTrackTitle } from "@/lib/services/titleService";
import { insertPendingTrack, markTrackFailed } from "@/lib/services/trackService";
import { logApi } from "@/lib/logger";
import {
  dispatchMinimaxViaPoYo,
  dispatchPoYo,
  dispatchLyria,
  dispatchMinimax,
  dispatchTempolor,
  dispatchMusicGpt,
  dispatchMureka,
  dispatchHeartMula,
  dispatchApiframe,
  dispatchApimart,
  type GenerationContext,
} from "@/lib/services/generationService";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const [ownerForArtistName] = await db
    .select({ artistAlias: users.artistAlias, name: users.name, writerAlias: users.writerAlias })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const defaultArtistName = ownerForArtistName?.artistAlias?.trim() || ownerForArtistName?.name?.trim() || null;
  const defaultWriterName = ownerForArtistName?.writerAlias?.trim() || defaultArtistName;

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json();
  const {
    provider, providerModel, prompt, lyrics, instrumental, title,
    vocalGender, weirdness, styleInfluence, audioWeight, negativeTags,
    personaId, artistName, writerName,
  } = body;

  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const resolvedArtistName = (typeof artistName === "string" ? artistName.trim() : "") || defaultArtistName;
  const resolvedWriterName = (typeof writerName === "string" ? writerName.trim() : "") || defaultWriterName;

  const allowedProviders = ["lyria", "poyo", "tempolor", "musicgpt", "minimax", "mureka", "heartmula", "apiframe", "apimart"];
  const poyoValidModels = ["V4", "V4_5", "V4_SALL", "V4_SPLUS", "V5", "V5_5"];
  const isMinimaxViaPoYo = provider === "poyo" && providerModel === "minimax-music-2.6";
  const normalizedPoYoModel = providerModel?.toUpperCase().replace(/\./g, "_") || "V5_5";

  // Input validation
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "prompt must be 2000 characters or fewer" }, { status: 400 });
  }
  if (lyrics !== undefined && lyrics !== null && (typeof lyrics !== "string" || lyrics.length > 10000)) {
    return NextResponse.json({ error: "lyrics must be 10000 characters or fewer" }, { status: 400 });
  }
  if (provider === "musicgpt" && typeof lyrics === "string" && lyrics.length > 3000) {
    return NextResponse.json({ error: "MusicGPT lyrics must be 3000 characters or fewer" }, { status: 400 });
  }
  if (provider === "minimax" && typeof lyrics === "string" && lyrics.length > 3000) {
    return NextResponse.json({ error: "Minimax lyrics must be 3000 characters or fewer" }, { status: 400 });
  }
  if (isMinimaxViaPoYo && typeof lyrics === "string" && lyrics.length > 3500) {
    return NextResponse.json({ error: "Minimax via PoYo lyrics must be 3500 characters or fewer" }, { status: 400 });
  }
  if (provider === "mureka" && !instrumental && !lyrics?.trim()) {
    return NextResponse.json({ error: "Mureka requires lyrics" }, { status: 400 });
  }
  if (provider === "heartmula" && !lyrics?.trim()) {
    return NextResponse.json({ error: "HeartMuLa requires lyrics with structure tags (e.g. [Verse], [Chorus], [intro-short])" }, { status: 400 });
  }
  if (provider === "apimart" && personaId && !lyrics?.trim()) {
    return NextResponse.json({ error: "Using a cloned voice requires lyrics (custom mode)" }, { status: 400 });
  }
  if (title !== undefined && title !== null && (typeof title !== "string" || title.length > 255)) {
    return NextResponse.json({ error: "title must be 255 characters or fewer" }, { status: 400 });
  }
  if (!allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (provider === "poyo" && !isMinimaxViaPoYo && !poyoValidModels.includes(normalizedPoYoModel)) {
    return NextResponse.json({ error: `Invalid PoYo model. Supported: ${poyoValidModels.join(", ")}` }, { status: 400 });
  }

  // Validate API keys
  const validation = await validateProviderApiKeys(provider);
  if (!validation.valid) {
    return NextResponse.json({ error: `Missing API configuration: ${validation.missing.join(", ")}. Please configure these in Settings.` }, { status: 400 });
  }

  // Resolve title (AI + fallbacks)
  const resolvedTitle = await resolveTrackTitle({ userTitle: normalizedTitle, instrumental: instrumental || false, prompt: normalizedPrompt, provider });

  const ctx: GenerationContext = {
    userId, startTime, provider, providerModel, prompt, lyrics, instrumental: instrumental || false,
    resolvedTitle, resolvedArtistName, resolvedWriterName,
    vocalGender, weirdness, styleInfluence, audioWeight, negativeTags, personaId,
    normalizedPoYoModel, isMinimaxViaPoYo,
  };

  // Providers that manage their own track insertion
  if (isMinimaxViaPoYo) return dispatchMinimaxViaPoYo(ctx);
  if (provider === "poyo") return dispatchPoYo(ctx);

  // All remaining providers share a single upfront pending track insert
  const track = await insertPendingTrack({
    userId, provider, providerModel, prompt, lyrics: lyrics || null,
    instrumental: instrumental || false, title: resolvedTitle,
    artistName: resolvedArtistName, writerName: resolvedWriterName,
  });

  try {
    if (provider === "lyria") return await dispatchLyria(ctx, track);
    if (provider === "minimax") return await dispatchMinimax(ctx, track);
    if (provider === "tempolor") return await dispatchTempolor(ctx, track);
    if (provider === "musicgpt") return await dispatchMusicGpt(ctx, track);
    if (provider === "mureka") return await dispatchMureka(ctx, track);
    if (provider === "heartmula") return await dispatchHeartMula(ctx, track);
    if (provider === "apiframe") return await dispatchApiframe(ctx, track);
    if (provider === "apimart") return await dispatchApimart(ctx, track);

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error: any) {
    const isCopyright = error.message === "COPYRIGHT";
    const errorMessage = isCopyright
      ? "Copyright detected -> click Optimize in Studio to rewrite safely"
      : error.message || "Generation failed";

    await markTrackFailed(track.id!, errorMessage);

    await logApi({
      userId, type: "generation", provider, endpoint: "/api/generate",
      request: JSON.stringify({ provider, providerModel, prompt }),
      response: JSON.stringify({ error: error.message }),
      statusCode: error.statusCode || 500,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ error: errorMessage }, { status: isCopyright ? 400 : 500 });
  }
}
