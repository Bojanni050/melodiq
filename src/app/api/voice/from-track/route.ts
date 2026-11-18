import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices, tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { uploadToS3, getPresignedUrl, downloadFromS3 } from "@/lib/s3";
import { createApimartVoice, createApimartPersona } from "@/lib/providers/apimart";
import { resolveDnaAudioSource } from "@/lib/dna-audio-source";
import { logApi } from "@/lib/logger";
import { apimartAudioIndexForJobId } from "@/lib/apimart-lyrics";

// APIMart only accepts MP3/WAV sample URLs, so whatever source the track has
// is resolved to MP3 first and parked on S3 under a stable key. The presigned
// URL has to outlive APIMart's own fetch, which can sit in a queue.
const PUBLIC_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

// The persona endpoint takes the voice clip from a bounded window of the
// source track. A full song contains long instrumental stretches that APIMart
// has to analyse for nothing; a slice around the vocals is both faster and
// more likely to be accepted.
const PERSONA_CLIP_MAX_SECONDS = 120;

/**
 * Creates a cloned voice out of a finished track, instead of the manual audio
 * upload in the Studio. The voice itself is APIMart's; this route only turns
 * the track's audio into something APIMart can fetch and records a pending
 * `cloned_voices` row that `/api/voice/status/[id]` keeps filling in.
 *
 * Two routes lead to APIMart:
 * - a track that APIMart generated itself is referenced by its generation
 *   `task_id`, which the documented persona endpoint turns into a persona id;
 * - anything else (an upload, a track from another provider) has to be sent as
 *   an audio URL, which is what the createVoice endpoint is for.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json().catch(() => null);
  const trackId: unknown = body?.trackId;
  if (typeof trackId !== "string" || !trackId) {
    return NextResponse.json({ error: "No track provided" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const track = rows[0];
  if (track.status !== "done") {
    return NextResponse.json({ error: "Only finished tracks can be used" }, { status: 400 });
  }
  // An instrumental has no voice to extract; APIMart would clone nothing.
  if (track.instrumental) {
    return NextResponse.json({ error: "Instrumental tracks have no voice to clone" }, { status: 400 });
  }

  try {
    // The persona route is the documented one and returns a stable persona id,
    // so it wins whenever APIMart still knows the generation that made this
    // track. `job_id` holds the generation task id, optionally suffixed with
    // the variant that produced this particular track.
    const generationTaskId = track.jobId?.split(":")[0] ?? null;
    if (generationTaskId && generationTaskId.startsWith("task_")) {
      const audioIndex = apimartAudioIndexForJobId(track.jobId!);
      const duration = track.duration ?? 0;

      const genResult = await createApimartPersona({
        taskId: generationTaskId,
        audioIndex,
        name: track.title || "Cloned voice",
        ...(duration > 0
          ? { vocalStartS: 0, vocalEndS: Math.min(duration, PERSONA_CLIP_MAX_SECONDS) }
          : {}),
      });

      const [voice] = await db
        .insert(clonedVoices)
        .values({
          userId,
          apimartTaskId: genResult.taskId,
          status: "pending",
          // The persona route needs no audio URL; the generation task id is
          // what APIMart will read the voice from.
          sourceAudioUrl: `apimart-persona:${generationTaskId}#${audioIndex}`,
        })
        .returning();

      await logApi({
        userId,
        type: "generation",
        provider: "apimart",
        endpoint: "/api/voice/from-track",
        request: JSON.stringify({
          trackId: track.id,
          title: track.title,
          route: "persona",
          generationTaskId,
          audioIndex,
        }),
        response: JSON.stringify({ status: "pending", taskId: genResult.taskId }),
        statusCode: 200,
        duration: Date.now() - startTime,
      });

      return NextResponse.json({ voice });
    }

    // A track that already has an MP3 is the cheapest sample: no transcode, and
    // the copy APIMart fetches is exactly what the user hears. Only tracks
    // without one go through the general "best source → MP3" resolver.
    let audioBuffer: Buffer | null = track.s3KeyMp3
      ? await downloadFromS3(track.s3KeyMp3)
      : null;

    if (!audioBuffer?.length) {
      const source = await resolveDnaAudioSource(track);
      audioBuffer = source?.audioBuffer ?? null;
    }

    if (!audioBuffer?.length) {
      return NextResponse.json(
        { error: "This track has no audio available for voice cloning" },
        { status: 400 }
      );
    }

    const s3Key = `voices/${userId}/track-${track.id}-${Date.now()}.mp3`;
    await uploadToS3(s3Key, audioBuffer, "audio/mpeg");
    const publicAudioUrl = await getPresignedUrl(s3Key, PUBLIC_URL_TTL_SECONDS);

    const genResult = await createApimartVoice(publicAudioUrl);

    const [voice] = await db
      .insert(clonedVoices)
      .values({
        userId,
        apimartTaskId: genResult.taskId,
        status: "pending",
        sourceAudioUrl: publicAudioUrl,
      })
      .returning();

    await logApi({
      userId,
      type: "generation",
      provider: "apimart",
      endpoint: "/api/voice/from-track",
      request: JSON.stringify({ trackId: track.id, title: track.title, route: "createVoice" }),
      response: JSON.stringify({ status: "pending", taskId: genResult.taskId }),
      statusCode: 200,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ voice });
  } catch (error: any) {
    const errorMessage = error.message || "Voice cloning failed";

    await logApi({
      userId,
      type: "generation",
      provider: "apimart",
      endpoint: "/api/voice/from-track",
      request: JSON.stringify({ trackId: track.id, title: track.title }),
      response: JSON.stringify({ error: errorMessage }),
      statusCode: error.statusCode || 500,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ error: errorMessage }, { status: error.statusCode || 500 });
  }
}
