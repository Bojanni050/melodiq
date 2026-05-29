export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tracks, users, workspaces } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { ensureDefaultWorkspaceForUser } from "@/lib/workspaces";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDatabaseUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) return null;
  if (trimmed.length > 2000) return null;
  return trimmed;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 255) return null;
  return trimmed;
}

function toFileSafeNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function makeUniqueWorkspaceName(base: string, existingLower: Set<string>) {
  const safeBase = toFileSafeNamePart(base) || "Imported Workspace";
  const baseLower = safeBase.toLowerCase();
  if (!existingLower.has(baseLower)) return safeBase;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${safeBase} (${i})`;
    if (!existingLower.has(candidate.toLowerCase())) return candidate;
  }
  return `${safeBase} (${randomUUID().slice(0, 8)})`;
}

type SourceWorkspaceRow = {
  id: string;
  name: string;
  parent_workspace_id: string | null;
  folder_gradient: string | null;
  is_default: boolean;
  created_at: Date | string | null;
};

type SourceTrackRow = {
  id: string;
  workspace_id: string | null;
  title: string | null;
  provider: string;
  provider_model: string;
  prompt: string;
  lyrics: string | null;
  language: string | null;
  instrumental: boolean | null;
  status: string | null;
  s3_key: string | null;
  s3_key_hd: string | null;
  format: string | null;
  format_hd: string | null;
  duration: number | null;
  job_id: string | null;
  conversion_id: string | null;
  audio_id: string | null;
  wav_job_id: string | null;
  credits_used: number | null;
  error: string | null;
  cover_url: string | null;
  s3_key_cover: string | null;
  rating: string | null;
  play_count: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return String(value);
  return value;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "t" || v === "true" || v === "1") return true;
  if (v === "f" || v === "false" || v === "0") return false;
  return null;
}

function unquoteSqlIdentifier(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function normalizeTableName(value: string) {
  const raw = unquoteSqlIdentifier(value);
  const noSchema = raw.includes(".") ? raw.split(".").at(-1) || raw : raw;
  return noSchema.replace(/^"+|"+$/g, "").toLowerCase();
}

function decodePgCopyField(value: string) {
  if (value === "\\N") return null;
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    if (next === undefined) {
      out += "\\";
      continue;
    }
    if (next === "t") {
      out += "\t";
      i += 1;
      continue;
    }
    if (next === "n") {
      out += "\n";
      i += 1;
      continue;
    }
    if (next === "r") {
      out += "\r";
      i += 1;
      continue;
    }
    if (next === "\\") {
      out += "\\";
      i += 1;
      continue;
    }
    out += next;
    i += 1;
  }
  return out;
}

type SqlDumpCopyTable = {
  table: string;
  columns: string[];
  rows: Array<Record<string, string | null>>;
};

function parseSqlDumpCopyTables(sql: string, wantedTables: Set<string>): Map<string, SqlDumpCopyTable> {
  const tables = new Map<string, SqlDumpCopyTable>();
  const lines = sql.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = /^COPY\s+([^\s(]+)\s*\(([^)]+)\)\s+FROM\s+stdin;\s*$/i.exec(line);
    if (!match) continue;
    const tableName = normalizeTableName(match[1]);
    const columns = match[2].split(",").map((c) => normalizeTableName(c));
    const isWanted = wantedTables.has(tableName);
    const rows: Array<Record<string, string | null>> = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const dataLine = lines[j];
      if (dataLine === "\\.") {
        i = j;
        break;
      }
      if (!isWanted) continue;
      const parts = dataLine.split("\t").map((p) => decodePgCopyField(p));
      const row: Record<string, string | null> = {};
      for (let c = 0; c < columns.length; c += 1) {
        row[columns[c]] = parts[c] ?? null;
      }
      rows.push(row);
    }
    if (!isWanted) continue;
    tables.set(tableName, { table: tableName, columns, rows });
  }
  return tables;
}

async function getCurrentUserEmailLower(userId: string) {
  const currentUser = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return currentUser[0]?.email?.toLowerCase() || null;
}

async function importFromSourceRows(params: {
  userId: string;
  sourceWorkspaces: SourceWorkspaceRow[];
  sourceTracks: SourceTrackRow[];
}) {
  const { userId, sourceWorkspaces, sourceTracks } = params;

  if (!Array.isArray(sourceTracks) || sourceTracks.length === 0) {
    return { importedWorkspaces: 0, importedTracks: 0 };
  }

  const MAX_IMPORT_TRACKS = 2500;
  if (sourceTracks.length > MAX_IMPORT_TRACKS) {
    return { error: `Too many tracks to import (max ${MAX_IMPORT_TRACKS})` as const };
  }

  const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);

  const existingWorkspaces = await db
    .select({ id: workspaces.id, name: workspaces.name, isDefault: workspaces.isDefault })
    .from(workspaces)
    .where(eq(workspaces.userId, userId));

  const existingNameLower = new Set(existingWorkspaces.map((w) => w.name.trim().toLowerCase()));

  const sourceWorkspaceById = new Map(sourceWorkspaces.map((w) => [w.id, w]));
  const workspaceIdMap = new Map<string, string>();

  const sourceNonDefault = sourceWorkspaces.filter((w) => !w.is_default);

  const sortedNonDefault = [...sourceNonDefault].sort((a, b) => {
    const aTime = Number(new Date(a.created_at || 0));
    const bTime = Number(new Date(b.created_at || 0));
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return aTime - bTime;
  });

  const insertedWorkspaces: Array<{
    sourceId: string;
    newId: string;
    name: string;
    folderGradient: string | null;
    createdAt: Date;
    parentSourceId: string | null;
  }> = [];

  for (const ws of sortedNonDefault) {
    const newId = randomUUID();
    const uniqueName = makeUniqueWorkspaceName(ws.name || "Imported Workspace", existingNameLower);
    existingNameLower.add(uniqueName.toLowerCase());
    workspaceIdMap.set(ws.id, newId);
    insertedWorkspaces.push({
      sourceId: ws.id,
      newId,
      name: uniqueName,
      folderGradient: ws.folder_gradient,
      createdAt: ws.created_at ? new Date(ws.created_at) : new Date(),
      parentSourceId: ws.parent_workspace_id,
    });
  }

  await db.transaction(async (tx) => {
    if (insertedWorkspaces.length > 0) {
      await tx.insert(workspaces).values(
        insertedWorkspaces.map((ws) => ({
          id: ws.newId,
          userId,
          name: ws.name,
          parentWorkspaceId: null,
          folderGradient: ws.folderGradient,
          isDefault: false,
          createdAt: ws.createdAt,
          updatedAt: new Date(),
        }))
      );
    }

    const parentUpdates: Array<{ id: string; parentWorkspaceId: string | null }> = [];
    for (const ws of insertedWorkspaces) {
      const sourceParentId = ws.parentSourceId;
      if (!sourceParentId) continue;
      const sourceParent = sourceWorkspaceById.get(sourceParentId);
      if (sourceParent?.is_default) {
        parentUpdates.push({ id: ws.newId, parentWorkspaceId: defaultWorkspace.id });
        continue;
      }
      const mappedParent = workspaceIdMap.get(sourceParentId) || null;
      if (mappedParent) {
        parentUpdates.push({ id: ws.newId, parentWorkspaceId: mappedParent });
      }
    }

    for (const update of parentUpdates) {
      await tx
        .update(workspaces)
        .set({ parentWorkspaceId: update.parentWorkspaceId })
        .where(and(eq(workspaces.id, update.id), eq(workspaces.userId, userId)));
    }

    const trackRowsToInsert = sourceTracks.map((t) => {
      const newTrackId = randomUUID();
      const mappedWorkspace = t.workspace_id ? workspaceIdMap.get(t.workspace_id) : null;
      const workspaceId = mappedWorkspace || defaultWorkspace.id;

      const audioUrl = t.s3_key ? `/api/tracks/${newTrackId}/download` : null;
      const audioUrlHd = t.s3_key_hd ? `/api/tracks/${newTrackId}/download?hd=true` : null;
      const status = typeof t.status === "string" && t.status.trim() ? t.status.trim() : "done";

      return {
        id: newTrackId,
        userId,
        workspaceId,
        title: t.title,
        provider: t.provider,
        providerModel: t.provider_model,
        prompt: t.prompt,
        lyrics: t.lyrics,
        language: t.language,
        instrumental: Boolean(t.instrumental),
        status,
        audioUrl,
        audioUrlHd,
        s3Key: t.s3_key,
        s3KeyHd: t.s3_key_hd,
        format: t.format || "mp3",
        formatHd: t.format_hd,
        duration: t.duration,
        jobId: t.job_id,
        conversionId: t.conversion_id,
        audioId: t.audio_id,
        wavJobId: t.wav_job_id,
        creditsUsed: typeof t.credits_used === "number" ? t.credits_used : 0,
        error: t.error,
        coverUrl: t.cover_url,
        s3KeyCover: t.s3_key_cover,
        rating: t.rating,
        playCount: typeof t.play_count === "number" ? t.play_count : 0,
        createdAt: t.created_at ? new Date(t.created_at) : new Date(),
        updatedAt: t.updated_at ? new Date(t.updated_at) : new Date(),
      };
    });

    const CHUNK = 200;
    for (let i = 0; i < trackRowsToInsert.length; i += CHUNK) {
      await tx.insert(tracks).values(trackRowsToInsert.slice(i, i + CHUNK));
    }
  });

  return {
    importedWorkspaces: insertedWorkspaces.length,
    importedTracks: sourceTracks.length,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("sqlFile");
      const explicitSourceEmail = normalizeEmail(form.get("sourceEmail"));

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing sqlFile" }, { status: 400 });
      }

      const currentEmailLower = await getCurrentUserEmailLower(userId);
      if (!currentEmailLower) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const sourceEmail = explicitSourceEmail || currentEmailLower;

      const MAX_BYTES = 25_000_000;
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "SQL file too large" }, { status: 413 });
      }

      const sqlText = new TextDecoder("utf-8").decode(await file.arrayBuffer());
      const wanted = new Set(["users", "workspaces", "tracks"]);
      const tables = parseSqlDumpCopyTables(sqlText, wanted);
      const usersTable = tables.get("users");
      const workspacesTable = tables.get("workspaces");
      const tracksTable = tables.get("tracks");

      if (!usersTable || !workspacesTable || !tracksTable) {
        return NextResponse.json(
          { error: "Unsupported SQL format. Expected a pg_dump plain SQL file with COPY blocks for users/workspaces/tracks." },
          { status: 400 }
        );
      }

      const sourceUserRow = usersTable.rows.find((r) => {
        const email = r.email || r["user_email"] || r.mail;
        return typeof email === "string" && email.trim().toLowerCase() === sourceEmail;
      });

      const sourceUserId = sourceUserRow?.id;
      if (!sourceUserId) {
        return NextResponse.json(
          { error: "User not found in SQL file for the given email" },
          { status: 404 }
        );
      }

      const sourceWorkspaces: SourceWorkspaceRow[] = workspacesTable.rows
        .filter((r) => r.user_id === sourceUserId)
        .map((r) => ({
          id: String(r.id),
          name: toNullableString(r.name) || "Imported Workspace",
          parent_workspace_id: toNullableString(r.parent_workspace_id ?? r.parentworkspaceid),
          folder_gradient: toNullableString(r.folder_gradient),
          is_default: Boolean(toNullableBoolean(r.is_default)),
          created_at: toNullableString(r.created_at),
        }));

      const sourceTracks: SourceTrackRow[] = tracksTable.rows
        .filter((r) => r.user_id === sourceUserId)
        .map((r) => ({
          id: String(r.id),
          workspace_id: toNullableString(r.workspace_id),
          title: toNullableString(r.title),
          provider: String(r.provider || ""),
          provider_model: String(r.provider_model || ""),
          prompt: String(r.prompt || ""),
          lyrics: toNullableString(r.lyrics),
          language: toNullableString(r.language),
          instrumental: toNullableBoolean(r.instrumental),
          status: toNullableString(r.status),
          s3_key: toNullableString(r.s3_key),
          s3_key_hd: toNullableString(r.s3_key_hd),
          format: toNullableString(r.format),
          format_hd: toNullableString(r.format_hd),
          duration: toNullableNumber(r.duration),
          job_id: toNullableString(r.job_id),
          conversion_id: toNullableString(r.conversion_id),
          audio_id: toNullableString(r.audio_id),
          wav_job_id: toNullableString(r.wav_job_id),
          credits_used: toNullableNumber(r.credits_used),
          error: toNullableString(r.error),
          cover_url: toNullableString(r.cover_url),
          s3_key_cover: toNullableString(r.s3_key_cover),
          rating: toNullableString(r.rating),
          play_count: toNullableNumber(r.play_count),
          created_at: toNullableString(r.created_at),
          updated_at: toNullableString(r.updated_at),
        }));

      if (sourceTracks.some((t) => !t.provider || !t.provider_model || !t.prompt)) {
        return NextResponse.json(
          { error: "SQL file is missing required track columns (provider/provider_model/prompt) or has unsupported schema." },
          { status: 400 }
        );
      }

      const result = await importFromSourceRows({ userId, sourceWorkspaces, sourceTracks });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const body: unknown = await request.json();
    if (!isJsonObject(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const sourceDatabaseUrl = normalizeDatabaseUrl(body.sourceDatabaseUrl);
    if (!sourceDatabaseUrl) {
      return NextResponse.json({ error: "Invalid sourceDatabaseUrl" }, { status: 400 });
    }

    const explicitSourceEmail = normalizeEmail(body.sourceEmail);

    const currentEmailLower = await getCurrentUserEmailLower(userId);
    if (!currentEmailLower) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sourceEmail = explicitSourceEmail || currentEmailLower;

    const sourceSql = postgres(sourceDatabaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      prepare: false,
    });

    try {
      const sourceUserRows = await sourceSql<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE lower(email) = ${sourceEmail}
        LIMIT 1
      `;

      if (!Array.isArray(sourceUserRows) || sourceUserRows.length === 0) {
        return NextResponse.json(
          { error: "User not found in source database for the given email" },
          { status: 404 }
        );
      }

      const sourceUserId = sourceUserRows[0].id;

      const sourceWorkspaces = await sourceSql<SourceWorkspaceRow[]>`
        SELECT id, name, parent_workspace_id, folder_gradient, is_default, created_at
        FROM workspaces
        WHERE user_id = ${sourceUserId}
      `.catch((error) => {
        console.error("Import: failed to read source workspaces:", error);
        return [];
      });

      const sourceTracks = await sourceSql<SourceTrackRow[]>`
        SELECT
          id,
          workspace_id,
          title,
          provider,
          provider_model,
          prompt,
          lyrics,
          language,
          instrumental,
          status,
          s3_key,
          s3_key_hd,
          format,
          format_hd,
          duration,
          job_id,
          conversion_id,
          audio_id,
          wav_job_id,
          credits_used,
          error,
          cover_url,
          s3_key_cover,
          rating,
          play_count,
          created_at,
          updated_at
        FROM tracks
        WHERE user_id = ${sourceUserId}
      `;

      const result = await importFromSourceRows({ userId, sourceWorkspaces, sourceTracks });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    } finally {
      await sourceSql.end({ timeout: 5 });
    }
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
