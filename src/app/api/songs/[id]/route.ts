import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/require-auth";
import { getUserSongWithTrackVersions } from "@/lib/songs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const song = await getUserSongWithTrackVersions(auth.userId, id);
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  return NextResponse.json({ song });
}
