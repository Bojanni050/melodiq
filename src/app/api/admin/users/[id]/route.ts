import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { VALID_ROLES } from "../route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body?.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      const emailTaken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, id)))
        .limit(1);
      if (emailTaken[0]) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
      }
      updates.email = email;
    }

    if (typeof body?.password === "string" && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      updates.password = await bcrypt.hash(body.password, 12);
    }

    if (typeof body?.name === "string") {
      updates.name = body.name.trim() || null;
    }

    if (typeof body?.role === "string") {
      if (!VALID_ROLES.has(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (body.role !== "admin" && id === admin.userId) {
        return NextResponse.json({ error: "You can't remove your own admin role" }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[admin/users/[id]/PATCH] error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;

  if (id === admin.userId) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await db.delete(users).where(eq(users.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users/[id]/DELETE] error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
