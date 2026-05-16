import { NextResponse } from "next/server";
import { generateTitle } from "@/lib/providers/llm";
import { requireAuth } from "@/lib/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { lyrics } = body;

  if (!lyrics || typeof lyrics !== "string" || lyrics.length < 20) {
    return NextResponse.json({ error: "Lyrics are required and must be at least 20 characters" }, { status: 400 });
  }

  try {
    const title = await generateTitle(lyrics);
    return NextResponse.json({ title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate title" }, { status: 500 });
  }
}