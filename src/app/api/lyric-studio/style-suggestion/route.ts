export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { logApi } from "@/lib/logger";
import { callLLM, getLLMProviderForPurpose } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider failed";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: {
    topic?: unknown;
    mood?: unknown;
    lyrics?: unknown;
    language?: unknown;
    styleHint?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, mood, lyrics, language, styleHint } = body;

  if (typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (typeof mood !== "string" || !mood.trim()) {
    return NextResponse.json({ error: "mood is required" }, { status: 400 });
  }
  if (typeof lyrics !== "string" || !lyrics.trim()) {
    return NextResponse.json({ error: "lyrics is required" }, { status: 400 });
  }
  if (typeof language !== "string" || !language.trim()) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }
  if (styleHint !== undefined && typeof styleHint !== "string") {
    return NextResponse.json({ error: "styleHint must be a string" }, { status: 400 });
  }

  const trimmedLyrics = lyrics.trim().slice(0, 6000);
  const trimmedHint = typeof styleHint === "string" ? styleHint.trim().slice(0, 500) : "";

  const systemPrompt = `You are a professional music prompt engineer.

Generate one concise style suggestion for AI music generation based on topic, mood, and existing lyrics.

Output rules:
- Return one single line only.
- Use comma-separated tags and short phrases.
- Include genre/subgenre, instrumentation, production texture, vocal tone, and energy.
- Keep it 12-28 words.
- Do not include artist names, song titles, quotes, or section labels.
- Do not include any explanation before or after the suggestion.`;

  const userPrompt = `Topic: ${topic.trim()}
Mood: ${mood.trim()}
Language: ${language.trim()}
${trimmedHint ? `Current style hint: ${trimmedHint}` : ""}

Lyrics context:
${trimmedLyrics}`;

  try {
    const llmProvider = await getLLMProviderForPurpose("prompt");
    const result = await callLLM(userPrompt, systemPrompt, { purpose: "prompt" });
    const suggestion = result.trim().replace(/\s+/g, " ");

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/style-suggestion",
      request: JSON.stringify({ topic, mood, language }),
      response: JSON.stringify({ suggestion: suggestion.slice(0, 200) }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ suggestion });
  } catch (error) {
    const message = getErrorMessage(error);
    const llmProvider = await getLLMProviderForPurpose("prompt");

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: llmProvider,
      endpoint: "/api/lyric-studio/style-suggestion",
      request: JSON.stringify({ topic, mood, language }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}