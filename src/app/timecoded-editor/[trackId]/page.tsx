import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TimecodedLyricsEditor from "@/components/timecoded-editor/TimecodedLyricsEditor";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Timecoded Lyrics Editor — MelodIQ",
  description: "Edit synchronized timecoded lyrics safely. Timestamps are always preserved.",
};

interface Props {
  params: Promise<{ trackId: string }>;
}

export default async function TimecodedEditorTrackPage({ params }: Props) {
  const { trackId } = await params;

  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");
  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  // Fetch user role
  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!userRow || userRow.role === "listener") {
    redirect("/discover");
  }

  const isAdmin = userRow.role === "admin";

  // Fetch track
  const [track] = await db
    .select({
      userId: tracks.userId,
      lyricsTimestamps: tracks.lyricsTimestamps,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track) redirect("/timecoded-editor");

  // Ownership check: regular users can only edit their own tracks
  if (!isAdmin && track.userId !== payload.userId) {
    redirect("/timecoded-editor");
  }

  return (
    <TimecodedLyricsEditor
      trackId={trackId}
      initialRaw={track.lyricsTimestamps ?? undefined}
    />
  );
}
