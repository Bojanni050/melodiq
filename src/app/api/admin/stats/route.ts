import { NextResponse } from "next/server";
import { count, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, tracks } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const [
    [{ value: totalUsers }],
    [{ value: totalTracks }],
    [{ value: totalPlays }],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(tracks),
    db.select({ value: sql<number>`coalesce(sum(${tracks.playCount} + ${tracks.othersPlayCount}), 0)` }).from(tracks),
  ]);

  return NextResponse.json({
    totalUsers,
    totalTracks,
    totalPlays: Number(totalPlays),
  });
}
