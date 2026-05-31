import { NextRequest, NextResponse } from "next/server";
import { S3 } from "@aws-sdk/client-s3";
import { getSetting } from "@/lib/settings";

export async function GET(request: NextRequest) {
  try {
    const endpoint = (await getSetting("S3_ENDPOINT")) || process.env.S3_ENDPOINT || "";
    const region = (await getSetting("AWS_REGION")) || process.env.S3_REGION || "auto";
    const accessKey = (await getSetting("S3_ACCESS_KEY")) || process.env.S3_ACCESS_KEY || "";
    const secretKey = (await getSetting("S3_SECRET_KEY")) || process.env.S3_SECRET_KEY || "";
    const bucket = (await getSetting("S3_BUCKET")) || process.env.S3_BUCKET || "musiq-tracks";

    if (!endpoint || !accessKey || !secretKey) {
      return NextResponse.json({
        error: "S3 not configured",
      }, { status: 400 });
    }

    const s3 = new S3({
      endpoint: endpoint || undefined,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");

    let totalSize = 0;
    let objectCount = 0;
    let continuationToken: string | undefined;

    // Paginate through all objects
    do {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        response.Contents.forEach((obj) => {
          totalSize += obj.Size || 0;
          objectCount += 1;
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({
      totalSize,
      objectCount,
      formattedSize: formatBytes(totalSize),
    });
  } catch (error) {
    console.error("Error fetching S3 stats:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch storage stats",
    }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
