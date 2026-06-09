import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  // Fetch all tracks with workspace info
  const userTracks = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      provider: tracks.provider,
      providerModel: tracks.providerModel,
      prompt: tracks.prompt,
      lyrics: tracks.lyrics,
      language: tracks.language,
      instrumental: tracks.instrumental,
      status: tracks.status,
      format: tracks.format,
      formatHd: tracks.formatHd,
      duration: tracks.duration,
      rating: tracks.rating,
      playCount: tracks.playCount,
      audioUrl: tracks.audioUrl,
      audioUrlHd: tracks.audioUrlHd,
      s3Key: tracks.s3Key,
      s3KeyHd: tracks.s3KeyHd,
      coverUrl: tracks.coverUrl,
      workspaceId: tracks.workspaceId,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .where(eq(tracks.userId, userId))
    .orderBy(desc(tracks.createdAt));

  // Fetch workspaces for name lookup
  const userWorkspaces = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.userId, userId));

  const wsMap = new Map(userWorkspaces.map((w) => [w.id, w.name]));

  const now = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const rows = userTracks.map((t) => ({
      ...t,
      workspace: t.workspaceId ? (wsMap.get(t.workspaceId) ?? null) : null,
      duration: formatDuration(t.duration) || null,
      createdAt: t.createdAt.toISOString(),
    }));
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="melodiq-tracks-${now}.json"`,
      },
    });
  }

  // CSV
  const headers = [
    "id", "title", "provider", "model", "language", "instrumental",
    "duration", "format", "format_hd", "status", "rating", "play_count",
    "workspace", "prompt", "lyrics", "audio_url", "audio_url_hd",
    "s3_key", "s3_key_hd", "cover_url", "created_at",
  ];

  const rows = userTracks.map((t) => [
    t.id,
    t.title,
    t.provider,
    t.providerModel,
    t.language,
    t.instrumental ? "yes" : "no",
    formatDuration(t.duration),
    t.format,
    t.formatHd,
    t.status,
    t.rating,
    t.playCount,
    t.workspaceId ? (wsMap.get(t.workspaceId) ?? "") : "",
    t.prompt,
    t.lyrics,
    t.audioUrl,
    t.audioUrlHd,
    t.s3Key,
    t.s3KeyHd,
    t.coverUrl,
    t.createdAt.toISOString(),
  ].map(escapeCsv).join(","));

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="melodiq-tracks-${now}.csv"`,
    },
  });
}
