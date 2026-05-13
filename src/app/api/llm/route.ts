import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logApi } from "@/lib/logger";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-5";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const EMERGENT_KEY = process.env.EMERGENT_API_KEY || "";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, idea, provider, language, instrumental } = await request.json();

  let result: string;

  try {
    if (type === "optimize") {
      const systemPrompt = `You are an expert music prompt engineer. Rewrite the user's rough song idea into a detailed, provider-optimized prompt for AI music generation.

Rules:
- Remove any artist/band names (copyright scrubbing)
- Expand vague descriptions with specific musical terms
- Include mood, tempo, instrumentation, genre cues
- Format specifically for ${provider || "general AI music generation"}
- Keep under 500 characters`;

      result = await callLLM(idea, systemPrompt);
    } else if (type === "lyrics") {
      if (instrumental) {
        return NextResponse.json({ lyrics: "" });
      }

      const systemPrompt = `You are a professional songwriter. Write original lyrics based on the user's idea.

Rules:
- Use section tags: [Verse], [Chorus], [Verse], [Chorus], [Bridge], [Chorus], [Outro]
- Write original content (no copying existing songs)
- Language: ${language || "English"}
- Make it emotionally resonant and musically structured
- Keep it 2-4 minutes when sung`;

      result = await callLLM(idea, systemPrompt);
    } else {
      return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    await logApi({
      userId: decoded.userId,
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/llm",
      request: JSON.stringify({ type, idea, provider, language }),
      response: JSON.stringify({ result: result?.substring(0, 200) }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    await logApi({
      userId: decoded.userId,
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/llm",
      request: JSON.stringify({ type, idea }),
      response: JSON.stringify({ error: error.message }),
      statusCode: error.statusCode || 500,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: error.message || "AI provider failed" },
      { status: 500 }
    );
  }
}

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  if (OPENROUTER_KEY) {
    const axios = await import("axios");
    const res = await axios.default.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        },
      }
    );
    return res.data.choices[0].message.content;
  }

  if (OPENAI_KEY) {
    const axios = await import("axios");
    const res = await axios.default.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.choices[0].message.content;
  }

  if (EMERGENT_KEY) {
    const axios = await import("axios");
    const res = await axios.default.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${EMERGENT_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.choices[0].message.content;
  }

  throw new Error("No AI provider configured. Add OPENROUTER_API_KEY, OPENAI_API_KEY, or EMERGENT_API_KEY to .env");
}
