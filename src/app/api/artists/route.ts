import { NextResponse } from "next/server";

import { db } from "@/db";
import { artistPages } from "@/db/schema";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

// Public, no auth: every artist page's public handle (name + slug) so any
// artist name rendered in the UI can link to /artist/[slug] when a page
// exists. Only alias + slug are exposed — both are already public via the
// page itself. No bios, no user ids.
export async function GET() {
  await ensureWorkspaceSchema();

  const rows = await db
    .select({ alias: artistPages.alias, slug: artistPages.slug })
    .from(artistPages);

  return NextResponse.json({ artists: rows });
}
