import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { Readable } from "stream";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Complete PostgreSQL dump of the whole database (all users), admin only.
// Streams pg_dump's plain-SQL output (gzipped) straight to the client, so
// nothing is buffered in memory. Requires the pg_dump binary (postgresql-client).
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 500 });
  }

  const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", "--dbname", databaseUrl], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Surface a missing binary / immediate failure as a clean error instead of an empty download.
  const started = await new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
    let stderr = "";
    dump.stderr.on("data", (c) => { stderr += c.toString(); });
    dump.once("error", (err) => resolve({ ok: false, error: err.message }));
    dump.once("close", (code) => resolve({ ok: false, error: stderr.trim() || `pg_dump exited with ${code}` }));
    dump.stdout.once("readable", () => resolve({ ok: true }));
  });

  if (!started.ok) {
    console.error("[admin-export] pg_dump failed:", started.error);
    return NextResponse.json({ error: "pg_dump failed", detail: started.error }, { status: 500 });
  }

  const { createGzip } = await import("zlib");
  const gz = dump.stdout.pipe(createGzip());
  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(Readable.toWeb(gz) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="melodiq-full-dump-${now}.sql.gz"`,
    },
  });
}
