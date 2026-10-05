import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { parseArtistAliases, parseAliasList, MAX_COMPOSER_ALIASES, MAX_WRITER_ALIASES } from "@/lib/artist-aliases";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      artistAlias: users.artistAlias,
      artistAliases: users.artistAliases,
      composerAlias: users.composerAlias,
      writerAlias: users.writerAlias,
      composerAliases: users.composerAliases,
      writerAliases: users.writerAliases,
            bio: users.bio,
            profileImageUrl: users.profileImageUrl,
            heroImageUrl: users.heroImageUrl,
            role: users.role,
      language: users.language,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!result.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = result[0];
  return NextResponse.json({
    user: {
      ...row,
      artistAliases: parseArtistAliases(row.artistAliases),
      composerAliases: parseAliasList(row.composerAliases, MAX_COMPOSER_ALIASES),
      writerAliases: parseAliasList(row.writerAliases, MAX_WRITER_ALIASES),
    },
  });
}
