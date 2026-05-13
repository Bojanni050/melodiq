import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generateTitle } from "@/lib/providers/llm";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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