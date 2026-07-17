import { NextResponse } from "next/server";
import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, songs, tracks } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const [
    [{ value: totalUsers }],
    [{ value: totalSongs }],
    [{ value: publishedSongs }],
    [{ value: totalTracks }],
    [{ value: totalPlays }],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(songs),
    db.select({ value: count() }).from(songs).where(eq(songs.releaseStatus, "published")),
    db.select({ value: count() }).from(tracks),
    db.select({ value: sql<number>`coalesce(sum(${tracks.playCount}), 0)` }).from(tracks),
  ]);

  return NextResponse.json({
    totalUsers,
    totalSongs,
    publishedSongs,
    totalTracks,
    totalPlays: Number(totalPlays),
  });
}
