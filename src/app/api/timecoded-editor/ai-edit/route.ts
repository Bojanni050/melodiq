export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/providers/llm";
import { getSetting } from "@/lib/settings";
import { requireAuth } from "@/lib/require-auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logApi } from "@/lib/logger";

type AIEditAction =
  | "spelling"
  | "grammar"
  | "phonetic"
  | "translate"
  | "readability";

interface LineInput {
  lineId: number;
  text: string;
}

function buildSystemPrompt(action: AIEditAction, language?: string): string {
  const base = `You are a professional lyrics editor. You will receive a JSON array of lyric lines.
Each entry has a "lineId" (integer) and "text" (string).
You must return ONLY a valid JSON array in exactly the same format:
[{ "lineId": <number>, "text": "<corrected text>" }, ...]

CRITICAL RULES:
- Return ONLY the JSON array. No explanation, no markdown, no preamble.
- Every lineId you receive must appear in your response — do not drop any.
- Do not add lineIds that were not in the input.
- Do not modify any lineId values.
- Only modify the "text" field.
- If a line needs no change, return it with its original text unchanged.

Keep the sensibility of an experienced songwriter. Lyrics should feel naturally written, specific to the story and emotionally believable rather than polished for the sake of sounding poetic. Favor fresh observations, concrete situations, human behavior and subtle tension. Use simple language when simple language is right — allow conversational phrasing and unexpected turns without forcing imagery, metaphors, rhyme or symmetry. Keep the writing understated and confident: trust the listener to understand what is happening without explaining every emotion. Choose the less obvious expression when a familiar phrase comes naturally to mind. The result should feel lived-in, distinctive and effortless rather than "written."`;

  const actionInstructions: Record<AIEditAction, string> = {
    spelling:
      "Fix spelling errors in the lyrics. Preserve the original meaning, rhythm, and style. Only correct clearly misspelled words.",
    grammar:
      "Fix grammatical errors in the lyrics. Preserve the original meaning, rhythm, and poetic style. Only correct genuine grammar mistakes.",
    phonetic:
      "Convert phonetically-spelled words back to their correctly-spelled form. For example, 'Ai lav ju' → 'I love you', 'wanna' stays as 'wanna' (intentional style). Focus on unintentional phonetic misspellings.",
    translate: `Translate the lyrics into ${language || "English"}. Preserve the poetic style, rhythm, and emotional intent. Do not transliterate — produce natural, singable lyrics in the target language.`,
    readability:
      "Improve the readability and flow of the lyrics. Fix awkward phrasing, improve word choice, and make the lines more singable — while preserving the original meaning and emotional tone.",
  };

  return `${base}\n\nYour task: ${actionInstructions[action]}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Check that user is not a listener
  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!userRow || userRow.role === "listener") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    action,
    lines,
    language,
  } = body as { action?: unknown; lines?: unknown; language?: unknown };

  // Validate action
  const VALID_ACTIONS: AIEditAction[] = [
    "spelling",
    "grammar",
    "phonetic",
    "translate",
    "readability",
  ];
  if (
    typeof action !== "string" ||
    !VALID_ACTIONS.includes(action as AIEditAction)
  ) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate lines array
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "lines must be a non-empty array" },
      { status: 400 }
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i];
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as Record<string, unknown>).lineId !== "number" ||
      typeof (entry as Record<string, unknown>).text !== "string"
    ) {
      return NextResponse.json(
        { error: `lines[${i}] must have { lineId: number, text: string }` },
        { status: 400 }
      );
    }
  }

  if (action === "translate" && (typeof language !== "string" || !language.trim())) {
    return NextResponse.json(
      { error: "language is required for the translate action" },
      { status: 400 }
    );
  }

  const validatedLines = lines as LineInput[];

  // Resolve model — dedicated timecoded model with fallbacks
  const timecodedModel =
    (await getSetting("OPENROUTER_TIMECODED_MODEL")) ||
    (await getSetting("OPENROUTER_LYRICS_MODEL")) ||
    (await getSetting("OPENROUTER_MODEL")) ||
    process.env.OPENROUTER_MODEL ||
    "google/gemini-2.5-flash";

  const systemPrompt = buildSystemPrompt(action as AIEditAction, typeof language === "string" ? language : undefined);
  const userPrompt = JSON.stringify(validatedLines, null, 2);

  try {
    const rawResult = await callLLM(userPrompt, systemPrompt, {
      purpose: "lyrics",
      openRouterModelOverride: timecodedModel,
      temperature: 0.3, // low temperature for editing tasks
    });

    // Extract JSON from the response (strip any markdown fences)
    const jsonText = rawResult
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    // Basic shape validation before returning to client
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "AI returned unexpected format. Please try again." },
        { status: 502 }
      );
    }

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/timecoded-editor/ai-edit",
      request: JSON.stringify({ action, lineCount: validatedLines.length, language }),
      response: JSON.stringify({ lineCount: (parsed as unknown[]).length }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ patch: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider failed";

    await logApi({
      userId: auth.userId,
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/timecoded-editor/ai-edit",
      request: JSON.stringify({ action, lineCount: validatedLines.length }),
      response: JSON.stringify({ error: message }),
      statusCode: 500,
      duration: Date.now() - startTime,
    });

    console.error("[timecoded-editor/ai-edit]", error);
    return NextResponse.json({ error: "AI provider failed" }, { status: 500 });
  }
}
