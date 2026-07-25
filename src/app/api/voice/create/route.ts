import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { uploadToS3, getPresignedUrl } from "@/lib/s3";
import { createApimartVoice } from "@/lib/providers/apimart";
import { logApi } from "@/lib/logger";

const ALLOWED_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function detectExtension(file: File): "mp3" | "wav" | null {
  const type = file.type.toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("mp3") || type.includes("mpeg")) return "mp3";
  const name = file.name.toLowerCase();
  if (name.endsWith(".wav")) return "wav";
  if (name.endsWith(".mp3")) return "mp3";
  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Audio file must be 20MB or smaller" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) && !detectExtension(file)) {
    return NextResponse.json({ error: "Only mp3 or wav audio is accepted" }, { status: 400 });
  }

  const extension = detectExtension(file) || "mp3";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key = `voices/${userId}/${Date.now()}.${extension}`;
    await uploadToS3(s3Key, buffer, extension === "wav" ? "audio/wav" : "audio/mpeg");

    // 7-day presigned URL — long enough for APIMart to fetch and process the sample.
    const publicAudioUrl = await getPresignedUrl(s3Key, 7 * 24 * 60 * 60);

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
      endpoint: "/api/voice/create",
      request: JSON.stringify({ fileName: file.name, size: file.size }),
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
      endpoint: "/api/voice/create",
      request: JSON.stringify({ fileName: file.name, size: file.size }),
      response: JSON.stringify({ error: errorMessage }),
      statusCode: error.statusCode || 500,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ error: errorMessage }, { status: error.statusCode || 500 });
  }
}
