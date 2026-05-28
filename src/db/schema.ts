import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }),
  artistAlias: varchar("artist_alias", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tracks: many(tracks),
  apiLogs: many(apiLogs),
}));

export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  workspaceId: uuid("workspace_id"),
  title: varchar("title", { length: 255 }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerModel: varchar("provider_model", { length: 50 }).notNull(),
  prompt: text("prompt").notNull(),
  lyrics: text("lyrics"),
  language: varchar("language", { length: 50 }),
  instrumental: boolean("instrumental").default(false).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  audioUrl: text("audio_url"),
  audioUrlHd: text("audio_url_hd"),
  s3Key: text("s3_key"),
  s3KeyHd: text("s3_key_hd"),
  format: varchar("format", { length: 10 }).default("mp3"),
  formatHd: varchar("format_hd", { length: 10 }),
  duration: integer("duration"),
  jobId: varchar("job_id", { length: 255 }),
  conversionId: varchar("conversion_id", { length: 255 }),
  audioId: varchar("audio_id", { length: 255 }),
  wavJobId: varchar("wav_job_id", { length: 255 }),
  creditsUsed: integer("credits_used").default(0).notNull(),
  error: text("error"),
  coverUrl: text("cover_url"),
  s3KeyCover: text("s3_key_cover"),
  rating: varchar("rating", { length: 10 }),
  playCount: integer("play_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tracks_user_id_idx").on(table.userId),
  index("tracks_user_id_status_idx").on(table.userId, table.status),
  index("tracks_status_idx").on(table.status),
  index("tracks_user_id_created_at_idx").on(table.userId, sql`${table.createdAt} DESC`),
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  parentWorkspaceId: uuid("parent_workspace_id"),
  folderGradient: text("folder_gradient"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("workspaces_user_id_idx").on(table.userId),
]);

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  user: one(users, {
    fields: [workspaces.userId],
    references: [users.id],
  }),
  parentWorkspace: one(workspaces, {
    fields: [workspaces.parentWorkspaceId],
    references: [workspaces.id],
  }),
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  user: one(users, {
    fields: [tracks.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [tracks.workspaceId],
    references: [workspaces.id],
  }),
}));

export const apiLogs = pgTable("api_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  type: varchar("type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  request: text("request").notNull(),
  response: text("response"),
  statusCode: integer("status_code"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiLogsRelations = relations(apiLogs, ({ one }) => ({
  user: one(users, {
    fields: [apiLogs.userId],
    references: [users.id],
  }),
}));

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
});
