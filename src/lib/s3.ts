import { S3 } from "@aws-sdk/client-s3";

const s3 = new S3({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "audio/mpeg"
) {
  await s3.putObject({
    Bucket: process.env.S3_BUCKET || "sonara-tracks",
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return key;
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET || "sonara-tracks",
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export default s3;
