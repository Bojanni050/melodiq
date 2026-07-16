import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/require-auth";
import { getUserSongsWithTrackVersions } from "@/lib/songs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || undefined;

  const songsList = await getUserSongsWithTrackVersions(auth.userId, { workspaceId });
  return NextResponse.json({ songs: songsList });
}
