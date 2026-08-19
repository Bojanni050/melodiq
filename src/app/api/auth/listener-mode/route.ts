import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { generateToken } from "@/lib/auth";
import { ensureListenerUser } from "@/lib/listener-user";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // Verify current authenticated user has admin role
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Ensure bojan_listen@melodiq.nl account exists with listener role
    const listenerUser = await ensureListenerUser();

    // Generate token for listener account
    const token = generateToken(listenerUser.id);

    // Redirect to /discover while setting the session token cookie
    const redirectUrl = new URL("/discover", request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to switch to listener mode" }, { status: 500 });
  }
}
