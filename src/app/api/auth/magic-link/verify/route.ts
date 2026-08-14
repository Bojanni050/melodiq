import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { db } from "@/db";
import { magicLinkTokens, users } from "@/db/schema";
import { hashMagicLinkToken } from "@/lib/magic-link";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    const tokenHash = hashMagicLinkToken(token);
    const [record] = await db.select().from(magicLinkTokens).where(eq(magicLinkTokens.tokenHash, tokenHash)).limit(1);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    }

    await db.update(magicLinkTokens).set({ usedAt: new Date() }).where(eq(magicLinkTokens.id, record.id));

    let [user] = await db.select().from(users).where(eq(users.email, record.email)).limit(1);
    if (!user) {
      // Passwordless account: users.password is NOT NULL, so fill it with a
      // random hash that's never shared and can't be used to log in via the
      // password form.
      const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      const [created] = await db.insert(users).values({ email: record.email, password: placeholderPassword }).returning();
      user = created;
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    setSessionCookie(response, user.id!);
    return response;
  } catch (error) {
    console.error("[magic-link/verify] error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
