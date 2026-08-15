import { NextResponse } from "next/server";
import { getCdnUrl } from "@/lib/cdn-server";

export const dynamic = "force-dynamic";

// Public, no auth: a small set of non-sensitive config values client
// components need at runtime but can't read from process.env directly
// (Settings-page values live in the DB, not in the client bundle). Anonymous
// Discover visitors need this too, so it deliberately doesn't gate on auth —
// only ever add values here that are safe to hand to anyone.
export async function GET() {
  const cdnUrl = await getCdnUrl();
  return NextResponse.json({ cdnUrl });
}
