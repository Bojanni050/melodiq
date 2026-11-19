export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/providers/llm";
import { buildStyleSuggestionSystemPrompt, buildStyleSuggestionUserPrompt, sanitizeStyleSuggestionResponse } from "@/lib/lyrics-style-suggestion";
import { requireAuth } from "@/lib/require-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: {
    topic?: unknown;
    mood?: unknown;
    lyrics?: unknown;
    language?: unknown;
    styleHint?: unknown;
    temperature?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic, mood, lyrics, language, styleHint, temperature } = body;

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

  const systemPrompt = buildStyleSuggestionSystemPrompt();
  const userPrompt = buildStyleSuggestionUserPrompt({
    topic: topic.trim(),
    mood: mood.trim(),
    language: language.trim(),
    lyrics: typeof lyrics === "string" ? lyrics : "",
    styleHint: typeof styleHint === "string" ? styleHint : undefined,
  });

  try {
    const result = await callLLM(userPrompt, systemPrompt, {
      purpose: "prompt",
      temperature: typeof temperature === "number" && temperature > 0 ? temperature : undefined,
      userId: auth.userId,
    });
    const suggestion = sanitizeStyleSuggestionResponse(result);

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}