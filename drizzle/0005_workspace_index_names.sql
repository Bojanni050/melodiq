-- Converge the workspaces indexes on the names ensureWorkspaceSchema() creates
-- at runtime. Databases built from migrations had workspaces_user_id_idx while
-- the runtime path created workspaces_user_idx, so one that had been through
-- both carried two identical indexes on user_id.
--
-- Idempotent: the rename is skipped when the old name is gone, and the creates
-- are skipped when the index already exists.
ALTER INDEX IF EXISTS "workspaces_user_id_idx" RENAME TO "workspaces_user_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_user_idx" ON "workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_parent_idx" ON "workspaces" USING btree ("parent_workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_single_default_per_user_idx" ON "workspaces" ("user_id") WHERE "is_default" = true;
