import { NextResponse } from "next/server";
import { S3, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSetting } from "@/lib/settings";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const endpoint = (await getSetting("S3_ENDPOINT")) || process.env.S3_ENDPOINT || "";
  const region = (await getSetting("AWS_REGION")) || process.env.S3_REGION || "auto";
  const bucket = (await getSetting("S3_BUCKET")) || process.env.S3_BUCKET || "musiq-tracks";

  return NextResponse.json({
    endpoint: endpoint || "Not configured",
    region: region || "Not configured",
    bucket: bucket || "Not configured",
    forcePathStyle: true,
  });
}

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const endpoint = (await getSetting("S3_ENDPOINT")) || process.env.S3_ENDPOINT || "";
  const region = (await getSetting("AWS_REGION")) || process.env.S3_REGION || "auto";
  const accessKey = (await getSetting("S3_ACCESS_KEY")) || process.env.S3_ACCESS_KEY || "";
  const secretKey = (await getSetting("S3_SECRET_KEY")) || process.env.S3_SECRET_KEY || "";
  const bucket = (await getSetting("S3_BUCKET")) || process.env.S3_BUCKET || "musiq-tracks";

  if (!endpoint || !accessKey || !secretKey) {
    return NextResponse.json({
      connected: false,
      message: "Missing S3 configuration (endpoint, access key, or secret key)",
    });
  }

  try {
    const s3 = new S3({
      endpoint: endpoint || undefined,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return NextResponse.json({ connected: true, message: `Connected to ${bucket}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, message });
  }
}
