import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TimecodedLyricsEditor from "@/components/timecoded-editor/TimecodedLyricsEditor";
import GenerateTclButton from "@/components/timecoded-editor/GenerateTclButton";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks, users, trackAlignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { TclDocument } from "@/lib/tcl/types";

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
      lyrics: tracks.lyrics,
      status: tracks.status,
      s3Key: tracks.s3Key,
      s3KeyHd: tracks.s3KeyHd,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!track) redirect("/timecoded-editor");

  // Ownership check: regular users can only edit their own tracks
  if (!isAdmin && track.userId !== payload.userId) {
    redirect("/timecoded-editor");
  }

  const [alignment] = await db
    .select({ status: trackAlignments.status, tcl: trackAlignments.tcl })
    .from(trackAlignments)
    .where(eq(trackAlignments.trackId, trackId))
    .limit(1);

  const hasAlignment = alignment?.status === "done" && !!alignment.tcl;

  if (!hasAlignment) {
    const audioKey = track.s3Key || track.s3KeyHd;
    const canGenerate = !!track.lyrics?.trim() && track.status === "done" && !!audioKey;

    return (
      <div className="tce-root">
        <div className="tce-generate-shell">
          <h1 className="tce-title">
            <span className="tce-title__icon">🎵</span>
            Timecoded Lyrics Editor
          </h1>
          {canGenerate ? (
            <>
              <p>No time-coded lyrics have been generated for this track yet.</p>
              <GenerateTclButton trackId={trackId} />
            </>
          ) : (
            <p>
              This track needs both finished audio and lyrics before time-coded
              lyrics can be generated.
            </p>
          )}
        </div>
      </div>
    );
  }

  let tclDocument: TclDocument | undefined;
  try {
    tclDocument = JSON.parse(alignment!.tcl!) as TclDocument;
  } catch {
    tclDocument = undefined;
  }

  // Proxied through our own origin (not a direct presigned S3 URL) — the
  // WaveformPanel's WaveSurfer instance fetches+decodes the audio itself to
  // render the waveform, which requires CORS headers the S3-compatible
  // bucket doesn't send for cross-origin requests. Same-origin sidesteps that.
  const audioKey = track.s3Key || track.s3KeyHd;
  const audioUrl = audioKey
    ? `/api/tracks/${trackId}/download${!track.s3Key && track.s3KeyHd ? "?hd=true" : ""}`
    : undefined;

  return (
    <TimecodedLyricsEditor
      trackId={trackId}
      tclDocument={tclDocument}
      audioUrl={audioUrl}
    />
  );
}
