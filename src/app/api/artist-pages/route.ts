import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { artistPages, users } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";
import { parseArtistAliases } from "@/lib/artist-aliases";
import { buildUniqueArtistPageSlug, isOwnArtistAlias } from "@/lib/artist-pages";

// Own artist pages plus the alias slots that still have no page, so the
// management page can render "create page for this alias" without a second
// round trip. Auth required, always scoped to the caller's own rows.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  const [pages, owner] = await Promise.all([
    db
      .select({
        id: artistPages.id,
        alias: artistPages.alias,
        slug: artistPages.slug,
        bio: artistPages.bio,
        imageS3Key: artistPages.imageS3Key,
        heroS3Key: artistPages.heroS3Key,
        createdAt: artistPages.createdAt,
        updatedAt: artistPages.updatedAt,
      })
      .from(artistPages)
      .where(eq(artistPages.userId, userId))
      .orderBy(asc(artistPages.createdAt)),
    db
      .select({ artistAlias: users.artistAlias, artistAliases: users.artistAliases })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  // Mirror the account page's fallback: a user who only ever filled the single
  // legacy artistAlias column still has one usable artist name here.
  const aliases = parseArtistAliases(owner[0]?.artistAliases);
  if (aliases.length === 0 && owner[0]?.artistAlias) aliases.push(owner[0].artistAlias);

  const takenAliases = new Set(pages.map((page) => page.alias.trim().toLowerCase()));

  return NextResponse.json({
    pages,
    availableAliases: aliases.filter((alias) => !takenAliases.has(alias.trim().toLowerCase())),
  });
}

// Creates the page for one of the caller's own artist aliases. The alias must
// already exist in the account profile — a page presents an artist name that
// tracks can be credited to, so inventing a name here would create a page that
// no track could ever join.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await ensureWorkspaceSchema();

  let body: { alias?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const alias = typeof body.alias === "string" ? body.alias.trim() : "";
  if (!alias) {
    return NextResponse.json({ error: "Alias is required" }, { status: 400 });
  }
  if (alias.length > 255) {
    return NextResponse.json({ error: "Alias too long (max 255 characters)" }, { status: 400 });
  }

  const [owner] = await db
    .select({ artistAlias: users.artistAlias, artistAliases: users.artistAliases })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!owner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const aliases = parseArtistAliases(owner.artistAliases);
  if (aliases.length === 0 && owner.artistAlias) aliases.push(owner.artistAlias);

  if (!isOwnArtistAlias(aliases, alias)) {
    return NextResponse.json(
      { error: "Add this name as an artist alias on your account profile first" },
      { status: 400 }
    );
  }

  // Use the casing from the account profile so the page name matches exactly
  // what tracks get credited with (artist_name is matched against it later).
  const canonicalAlias = aliases.find((entry) => entry.trim().toLowerCase() === alias.toLowerCase())!.trim();

  const [already] = await db
    .select({ id: artistPages.id, slug: artistPages.slug })
    .from(artistPages)
    .where(and(eq(artistPages.userId, userId), eq(artistPages.alias, canonicalAlias)))
    .limit(1);

  if (already) {
    return NextResponse.json(
      { error: "This alias already has an artist page", page: already },
      { status: 409 }
    );
  }

  const takenSlugs = new Set((await db.select({ slug: artistPages.slug }).from(artistPages)).map((row) => row.slug));
  const slug = buildUniqueArtistPageSlug(canonicalAlias, takenSlugs);

  let created;
  try {
    [created] = await db.insert(artistPages).values({ userId, alias: canonicalAlias, slug }).returning();
  } catch (error: unknown) {
    // buildUniqueArtistPageSlug can still race with a concurrent creation of
    // the same alias; the unique index is the real arbiter.
    console.error("[artist-pages] create failed:", error);
    return NextResponse.json({ error: "Could not create the artist page" }, { status: 409 });
  }

  return NextResponse.json({ page: created }, { status: 201 });
}
