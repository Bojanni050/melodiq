import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { magicLinkTokens, users } from "@/db/schema";
import { generateMagicLinkToken, MAGIC_LINK_TTL_MS } from "@/lib/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";

// Always responds { success: true } regardless of whether the email is
// known, registered, or registration-closed — no account enumeration.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const recent = await db
      .select({ id: magicLinkTokens.id })
      .from(magicLinkTokens)
      .where(
        and(
          eq(magicLinkTokens.email, normalizedEmail),
          gt(magicLinkTokens.createdAt, new Date(Date.now() - 60_000))
        )
      )
      .limit(1);
    if (recent.length > 0) {
      return NextResponse.json({ error: "Please wait a minute before requesting another link" }, { status: 429 });
    }

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const canSignUp = process.env.REGISTRATION_ENABLED === "true";

    if (existingUser || canSignUp) {
      const { raw, hash } = generateMagicLinkToken();
      await db.insert(magicLinkTokens).values({
        email: normalizedEmail,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const url = `${appUrl}/login/magic?token=${raw}`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[magic-link] dev token for ${normalizedEmail}: ${url}`);
      }

      try {
        await sendMagicLinkEmail(normalizedEmail, url);
      } catch (emailError) {
        // Never leak email-delivery failures to the client — that would
        // reveal whether the address is registered. The dev console.log
        // above still lets local testing proceed without real SMTP.
        console.error("[magic-link/request] email send failed:", emailError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[magic-link/request] error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
