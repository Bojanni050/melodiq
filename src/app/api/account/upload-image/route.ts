import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { uploadToS3 } from "@/lib/s3";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");

  if (type !== "profile" && type !== "hero") {
    return NextResponse.json({ error: "type must be 'profile' or 'hero'" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  let uploadBuffer: Buffer;
  let ext: string;
  let contentType: string;

  try {
    const metadata = await sharp(rawBuffer).metadata();
    const format = metadata.format;

    if (format === "avif" || format === "webp") {
      uploadBuffer = rawBuffer;
      ext = format;
      contentType = format === "avif" ? "image/avif" : "image/webp";
    } else {
      uploadBuffer = await sharp(rawBuffer).avif({ quality: 80 }).toBuffer();
      ext = "avif";
      contentType = "image/avif";
    }
  } catch {
    uploadBuffer = rawBuffer;
    ext = file.name.split(".").pop() || "jpg";
    contentType = file.type || "image/jpeg";
  }

  const key = `users/${userId}/${type}.${ext}`;
  await uploadToS3(key, uploadBuffer, contentType);

  const imageUrl = `/api/account/${key}`;

  if (type === "profile") {
    await db.update(users).set({ profileImageUrl: imageUrl }).where(eq(users.id, userId));
  } else {
    await db.update(users).set({ heroImageUrl: imageUrl }).where(eq(users.id, userId));
  }

  return NextResponse.json({ url: imageUrl });
}