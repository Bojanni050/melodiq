import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (process.env.REGISTRATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Registration is closed" }, { status: 403 });
  }

  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db
      .insert(users)
      .values({ email, password: hashedPassword, name: name || null })
      .returning();

    const user = result[0];
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    setSessionCookie(response, user.id!);

    return response;
  } catch (error) {
    console.error("[register] error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
