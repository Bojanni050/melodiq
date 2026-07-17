import { NextResponse } from "next/server";

import { getPublishedTracksFeed } from "@/lib/songs";

export const dynamic = "force-dynamic";

// Public, no auth: browsable catalog of published tracks. Never returns
// lyrics/prompt/trackDna — see getPublishedTracksFeed for what's exposed.
export async function GET() {
  const published = await getPublishedTracksFeed(50);
  const trending = [...published].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 10);

  return NextResponse.json({ published, trending });
}
