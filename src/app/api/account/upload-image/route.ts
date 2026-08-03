import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { uploadToS3 } from "@/lib/s3";

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

  const ext = file.name.split(".").pop() || "jpg";
  const key = `users/${userId}/${type}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";

  await uploadToS3(key, buffer, contentType);

  const imageUrl = `/api/account/${key}`;

  if (type === "profile") {
    await db.update(users).set({ profileImageUrl: imageUrl }).where(eq(users.id, userId));
  } else {
    await db.update(users).set({ heroImageUrl: imageUrl }).where(eq(users.id, userId));
  }

  return NextResponse.json({ url: imageUrl });
}