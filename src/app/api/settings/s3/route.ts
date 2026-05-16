import { NextResponse } from "next/server";
import { S3, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSetting } from "@/lib/settings";
import { requireAuth } from "@/lib/require-auth";

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT || "";
  const region = process.env.S3_REGION || "auto";
  const accessKey = process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.S3_SECRET_KEY || "";
  const bucket = process.env.S3_BUCKET || "sonara-tracks";
  return { endpoint, region, accessKey, secretKey, bucket };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { endpoint, region, bucket } = getS3Client();
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

  const { endpoint, region, accessKey, secretKey, bucket } = getS3Client();

  if (!accessKey || !secretKey || !bucket) {
    return NextResponse.json({
      connected: false,
      message: "Missing S3 credentials",
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
