import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { ensureWorkspaceSchema } from "@/lib/workspaces";

// POST — verberg een track: hij verdwijnt uit alle lijsten en is alleen nog
// zichtbaar in het Archief-tabblad van de Library.
//
// Anders dan /api/tracks/[id]/archive wordt hier NIETS verwijderd. De mp3,
// HD/WAV, stems en masters blijven ongemoeid in S3, zodat herstellen (DELETE)
// een volledig herstel is in plaats van een gedeeltelijk.
//
// Er zijn geen guards (published / master track / in playlist) omdat verbergen
// niets kapotmaakt: een verborgen track blijft gewoon geldig staan waar hij
// stond, je ziet hem alleen niet meer.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // id + userId in dezelfde query: een client-supplied id alleen is nooit
  // voldoende (zelfde IDOR-patroom als de rest van de API).
  const owned = await db
    .select({ id: tracks.id, deletedAt: tracks.deletedAt })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
    .limit(1);

  if (!owned[0]) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // In de prullenbak staat al; verbergen zou de track daar onvindbaar maken
  // zonder de enige uitweg (definitief verwijderen) te bieden.
  if (owned[0].deletedAt) {
    return NextResponse.json(
      { error: "Track staat in de prullenbak. Herstel hem eerst." },
      { status: 409 }
    );
  }

  try {
    await db.update(tracks).set({ hiddenAt: new Date() }).where(eq(tracks.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[hide] failed to hide track ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to hide track" }, { status: 500 });
  }
}

// DELETE — maak een verborgen track weer zichtbaar. Alleen hiddenAt wordt
// geleegd; archivedAt blijft ongemoeid, zodat een track die ook gearchiveerd is
// na herstellen nog steeds geblokkeerd blijft voor releases en niet-afspeelbaar
// is. Dat is de enige manier om beide toestanden onafhankelijk terug te draaien.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureWorkspaceSchema();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const owned = await db
    .select({ id: tracks.id, hiddenAt: tracks.hiddenAt })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
    .limit(1);

  if (!owned[0]) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (!owned[0].hiddenAt) {
    return NextResponse.json({ error: "Track is not hidden" }, { status: 409 });
  }

  try {
    await db.update(tracks).set({ hiddenAt: null }).where(eq(tracks.id, id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[hide] failed to unhide track ${id}:`, error?.message ?? error);
    return NextResponse.json({ error: "Failed to restore track" }, { status: 500 });
  }
}
