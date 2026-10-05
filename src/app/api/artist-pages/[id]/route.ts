import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { artistPages } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import {
  normalizeArtistPageBio,
  validateArtistPageSlug,
} from "@/lib/artist-pages";

type Params = { params: Promise<{ id: string }> };

/**
 * Loads a page by id and asserts it belongs to the caller. Every mutating
 * handler starts here: a route that only checked the id would let any logged-in
 * user rewrite someone else's artist page.
 */
async function findOwnPage(pageId: string, userId: string) {
  const [row] = await db
    .select()
    .from(artistPages)
    .where(and(eq(artistPages.id, pageId), eq(artistPages.userId, userId)))
    .limit(1);
  return row ?? null;
}

// PATCH edits the page's own copy: bio, public slug and artwork. The alias is
// intentionally immutable — it is what tracks are matched against, so renaming
// would silently empty the page.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const { id } = await params;
  const page = await findOwnPage(id, userId);
  if (!page) {
    return NextResponse.json({ error: "Artist page not found" }, { status: 404 });
  }

  let body: { bio?: unknown; bioNl?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Partial<typeof artistPages.$inferInsert> = { updatedAt: new Date() };

  if (body.bio !== undefined) {
    const bio = normalizeArtistPageBio(body.bio);
    if (!bio.ok) return NextResponse.json({ error: bio.error }, { status: 400 });
    updates.bio = bio.bio;
  }

  if (body.bioNl !== undefined) {
    const bioNl = normalizeArtistPageBio(body.bioNl);
    if (!bioNl.ok) return NextResponse.json({ error: bioNl.error }, { status: 400 });
    updates.bioNl = bioNl.bio;
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== "string") {
      return NextResponse.json({ error: "Slug must be text" }, { status: 400 });
    }
    const validated = validateArtistPageSlug(body.slug);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    if (validated.slug !== page.slug) {
      const [clash] = await db
        .select({ id: artistPages.id })
        .from(artistPages)
        .where(and(eq(artistPages.slug, validated.slug), ne(artistPages.id, page.id)))
        .limit(1);
      if (clash) {
        return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
      }
    }
    updates.slug = validated.slug;
  }

  const [updated] = await db
    .update(artistPages)
    .set(updates)
    .where(and(eq(artistPages.id, page.id), eq(artistPages.userId, userId)))
    .returning();

  return NextResponse.json({ page: updated });
}

// Deleting a page never touches tracks: they keep their artist_name and simply
// stop appearing on any page, which is the owner's call to make either way.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const { id } = await params;
  const page = await findOwnPage(id, userId);
  if (!page) {
    return NextResponse.json({ error: "Artist page not found" }, { status: 404 });
  }

  await db
    .delete(artistPages)
    .where(and(eq(artistPages.id, page.id), eq(artistPages.userId, userId)));

  return NextResponse.json({ ok: true });
}
