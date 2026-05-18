import { S3 } from "@aws-sdk/client-s3";
import { getSetting } from "@/lib/settings";

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "audio/mpeg"
) {
  const endpoint = (await getSetting("S3_ENDPOINT")) || process.env.S3_ENDPOINT;
  const region = (await getSetting("AWS_REGION")) || process.env.S3_REGION || "auto";
  const accessKey = (await getSetting("S3_ACCESS_KEY")) || process.env.S3_ACCESS_KEY;
  const secretKey = (await getSetting("S3_SECRET_KEY")) || process.env.S3_SECRET_KEY;
  const bucket = (await getSetting("S3_BUCKET")) || process.env.S3_BUCKET || "sonara-tracks";

  const s3 = new S3({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return key;
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  const endpoint = (await getSetting("S3_ENDPOINT")) || process.env.S3_ENDPOINT;
  const region = (await getSetting("AWS_REGION")) || process.env.S3_REGION || "auto";
  const accessKey = (await getSetting("S3_ACCESS_KEY")) || process.env.S3_ACCESS_KEY;
  const secretKey = (await getSetting("S3_SECRET_KEY")) || process.env.S3_SECRET_KEY;
  const bucket = (await getSetting("S3_BUCKET")) || process.env.S3_BUCKET || "sonara-tracks";

  const s3 = new S3({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}
