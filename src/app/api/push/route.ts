import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await db
    .insert(pushSubscriptions)
    .values({ userId: auth.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoNothing();

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await db.delete(pushSubscriptions).where(
    and(eq(pushSubscriptions.userId, auth.userId), eq(pushSubscriptions.endpoint, endpoint)),
  );

  return NextResponse.json({ success: true });
}
