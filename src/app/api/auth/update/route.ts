import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body: unknown = await request.json();
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name;
  const artistAlias = body.artistAlias;
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = existing[0];
  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (name === null) {
      updates.name = null;
    } else if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed.length > 255) {
        return NextResponse.json({ error: "Name too long (max 255 characters)" }, { status: 400 });
      }
      updates.name = trimmed ? trimmed : null;
    } else {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
  }

  if (artistAlias !== undefined) {
    if (artistAlias === null) {
      updates.artistAlias = null;
    } else if (typeof artistAlias === "string") {
      const trimmed = artistAlias.trim();
      if (trimmed.length > 255) {
        return NextResponse.json({ error: "Artist alias too long (max 255 characters)" }, { status: 400 });
      }
      updates.artistAlias = trimmed ? trimmed : null;
    } else {
      return NextResponse.json({ error: "Invalid artistAlias" }, { status: 400 });
    }
  }

  if (newPassword) {
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (typeof newPassword !== "string") {
      return NextResponse.json({ error: "Invalid new password" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    updates.password = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      artistAlias: users.artistAlias,
      createdAt: users.createdAt,
    });

  return NextResponse.json({ user: updated[0] });
}
