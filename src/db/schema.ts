import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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
  playlists: many(playlists),
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
  lyricsTimestamps: text("lyrics_timestamps"),
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
  s3KeyCoverThumb: text("s3_key_cover_thumb"),
  artistName: varchar("artist_name", { length: 255 }),
  rating: varchar("rating", { length: 10 }),
  playCount: integer("play_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tracks_user_id_idx").on(table.userId),
  index("tracks_user_id_status_idx").on(table.userId, table.status),
  index("tracks_status_idx").on(table.status),
  index("tracks_user_id_created_at_idx").on(table.userId, table.createdAt),
  uniqueIndex("tracks_user_provider_audio_id_unique").on(table.userId, table.provider, table.audioId),
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

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("playlists_user_id_idx").on(table.userId),
  uniqueIndex("playlists_user_name_unique").on(table.userId, table.name),
]);

export const playlistTracks = pgTable("playlist_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id").notNull(),
  trackId: uuid("track_id").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("playlist_tracks_playlist_idx").on(table.playlistId),
  index("playlist_tracks_track_idx").on(table.trackId),
  uniqueIndex("playlist_tracks_playlist_position_unique").on(table.playlistId, table.position),
]);

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  playlistTracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.id],
  }),
  track: one(tracks, {
    fields: [playlistTracks.trackId],
    references: [tracks.id],
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
