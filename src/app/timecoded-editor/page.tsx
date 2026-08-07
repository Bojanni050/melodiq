import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TimecodedLyricsEditor from "@/components/timecoded-editor/TimecodedLyricsEditor";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
export const metadata: Metadata = {
  title: "Timecoded Lyrics Editor — MelodIQ",
  description: "Edit synchronized timecoded lyrics safely. Timestamps are always preserved.",
};

export default async function TimecodedEditorPage() {
  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");
  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  // Fetch user role
  const [userRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!userRow || userRow.role === "listener") {
    redirect("/discover");
  }

  return <TimecodedLyricsEditor />;
}
