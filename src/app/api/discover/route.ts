import { NextResponse } from "next/server";

import { getPublishedSongsFeed } from "@/lib/songs";

export const dynamic = "force-dynamic";

// Public, no auth: browsable catalog of published songs. Never returns
// lyrics/prompt/notes/songDna — see getPublishedSongsFeed for what's exposed.
export async function GET() {
  const published = await getPublishedSongsFeed(50);
  const trending = [...published].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 10);

  return NextResponse.json({ published, trending });
}
