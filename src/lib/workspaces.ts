import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tracks, workspaces } from "@/db/schema";

const DEFAULT_WORKSPACE_NAME = "Default Workspace";

export type WorkspaceWithTrackIds = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  folderGradient?: string;
  isDefault?: boolean;
  parentWorkspaceId?: string | null;
};

let workspaceSchemaEnsured: Promise<void> | null = null;

export async function ensureWorkspaceSchema(): Promise<void> {
  if (workspaceSchemaEnsured) {
    await workspaceSchemaEnsured;
    return;
  }

  workspaceSchemaEnsured = (async () => {
    try {
      await db.execute(sql`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS workspace_id uuid`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS workspaces (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name varchar(255) NOT NULL,
          parent_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
          folder_gradient text,
          is_default boolean NOT NULL DEFAULT false,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await db.execute(sql`CREATE INDEX IF NOT EXISTS workspaces_user_idx ON workspaces(user_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS workspaces_parent_idx ON workspaces(parent_workspace_id)`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS workspaces_single_default_per_user_idx ON workspaces(user_id) WHERE is_default = true`);
    } catch {
      // If schema updates are blocked by DB permissions, we keep read-path fallbacks active.
    }
  })();

  await workspaceSchemaEnsured;
}

export async function ensureDefaultWorkspaceForUser(userId: string) {
  await ensureWorkspaceSchema();

  const existing = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await db
    .insert(workspaces)
    .values({
      id: randomUUID(),
      userId,
      name: DEFAULT_WORKSPACE_NAME,
      isDefault: true,
      parentWorkspaceId: null,
    })
    .returning();

  return inserted[0];
}

export async function getUserWorkspacesWithTrackIds(
  userId: string,
  knownTracks?: Array<{ id: string; workspaceId: string | null }>
): Promise<WorkspaceWithTrackIds[]> {
  await ensureWorkspaceSchema();

  const fallbackTracks = knownTracks || [];

  try {
    const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);

    const workspaceRows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId))
      .orderBy(asc(workspaces.createdAt));

    const normalizedWorkspaces = workspaceRows.length > 0 ? workspaceRows : [defaultWorkspace];
    const workspaceIds = new Set(normalizedWorkspaces.map((workspace) => workspace.id));

    const trackRows =
      knownTracks ||
      (await db
        .select({ id: tracks.id, workspaceId: tracks.workspaceId })
        .from(tracks)
        .where(eq(tracks.userId, userId)));

    const trackIdsByWorkspace = new Map<string, string[]>();

    normalizedWorkspaces.forEach((workspace) => {
      trackIdsByWorkspace.set(workspace.id, []);
    });

    trackRows.forEach((track) => {
      const targetWorkspaceId =
        track.workspaceId && workspaceIds.has(track.workspaceId)
          ? track.workspaceId
          : defaultWorkspace.id;

      const workspaceTrackIds = trackIdsByWorkspace.get(targetWorkspaceId);
      if (workspaceTrackIds) {
        workspaceTrackIds.push(track.id);
      } else {
        trackIdsByWorkspace.set(targetWorkspaceId, [track.id]);
      }
    });

    return normalizedWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      trackIds: trackIdsByWorkspace.get(workspace.id) || [],
      createdAt: workspace.createdAt.toISOString(),
      folderGradient: workspace.folderGradient || undefined,
      isDefault: workspace.isDefault,
      parentWorkspaceId: workspace.parentWorkspaceId,
    }));
  } catch {
    // Hard fallback so track listing keeps working even before DB migration catches up.
    return [
      {
        id: "workspace-default",
        name: DEFAULT_WORKSPACE_NAME,
        trackIds: fallbackTracks.map((track) => track.id),
        createdAt: new Date().toISOString(),
        isDefault: true,
        parentWorkspaceId: null,
      },
    ];
  }
}
