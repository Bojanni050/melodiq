import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  real,
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
  // Additional artist aliases beyond the primary one above, stored as a JSON
  // array of strings (fixed at 5 slots for now — see account settings UI).
  // artistAlias always mirrors the first entry so existing "unknown artist"
  // fallback logic across the app keeps working unchanged.
  artistAliases: text("artist_aliases"),
  composerAlias: varchar("composer_alias", { length: 255 }),
  writerAlias: varchar("writer_alias", { length: 255 }),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  heroImageUrl: text("hero_image_url"),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  // UI language ("en" | "nl") — also passed to LLM analysis prompts (Advanced
  // Track DNA etc.) so generated text matches the interface language.
  language: varchar("language", { length: 5 }).default("en").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tracks: many(tracks),
  playlists: many(playlists),
  releases: many(releases),
  apiLogs: many(apiLogs),
  clonedVoices: many(clonedVoices),
}));

export const clonedVoices = pgTable("cloned_voices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  apimartTaskId: varchar("apimart_task_id", { length: 255 }).notNull(),
  personaId: varchar("persona_id", { length: 255 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  sourceAudioUrl: text("source_audio_url").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("cloned_voices_user_id_idx").on(table.userId),
]);

export const clonedVoicesRelations = relations(clonedVoices, ({ one }) => ({
  user: one(users, {
    fields: [clonedVoices.userId],
    references: [users.id],
  }),
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
  translatedLyrics: text("translated_lyrics"),
  translatedLanguage: varchar("translated_language", { length: 50 }),
  instrumental: boolean("instrumental").default(false).notNull(),
  isCollaboration: boolean("is_collaboration").default(false).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  audioUrl: text("audio_url"),
  audioUrlHd: text("audio_url_hd"),
  s3Key: text("s3_key"),
  s3KeyHd: text("s3_key_hd"),
  s3KeyMp3: text("s3_key_mp3"),
  format: varchar("format", { length: 10 }).default("mp3"),
  formatHd: varchar("format_hd", { length: 10 }),
  duration: integer("duration"),
  jobId: varchar("job_id", { length: 255 }),
  conversionId: varchar("conversion_id", { length: 255 }),
  audioId: varchar("audio_id", { length: 255 }),
  wavJobId: varchar("wav_job_id", { length: 255 }),
  wavRetryAt: timestamp("wav_retry_at"),
  wavRetryCount: integer("wav_retry_count").default(0).notNull(),
  // True only when the user explicitly clicked "Convert to WAV" on this
  // track. Distinguishes genuine requests from wavJobId values left over
  // from the old auto-conversion behavior, so bulk/passive polling never
  // surfaces tracks nobody asked to convert.
  wavUserRequested: boolean("wav_user_requested").default(false).notNull(),
  creditsUsed: integer("credits_used").default(0).notNull(),
  error: text("error"),
  coverUrl: text("cover_url"),
  s3KeyCover: text("s3_key_cover"),
  s3KeyCoverThumb: text("s3_key_cover_thumb"),
  artistName: varchar("artist_name", { length: 255 }),
  composerName: varchar("composer_name", { length: 255 }),
  writerName: varchar("writer_name", { length: 255 }),
  sunoStyleInfluence: integer("suno_style_influence"),
  sunoWeirdness: integer("suno_weirdness"),
  s3KeyLicense: text("s3_key_license"),
  rating: varchar("rating", { length: 10 }),
  playCount: integer("play_count").default(0).notNull(),
  // Plays via the public Discover feed (anyone browsing /discover), tracked
  // separately from playCount (plays via the owner's own Library/Studio/
  // Workspaces views) — see mediaBase() in Player.tsx for the routing split.
  othersPlayCount: integer("others_play_count").default(0).notNull(),
  votedAt: timestamp("voted_at"),
  releaseStatus: varchar("release_status", { length: 20 }).default("concept").notNull(),
  publishDate: timestamp("publish_date"),
  trackDna: text("track_dna"),
  // Auto-computed Track DNA (tempo/key/energy/loudness from audio-features.ts,
  // atmosphere tags + lyrics score from LLM) — JSON, replaces track_dna_votes.
  audioDna: text("audio_dna"),
  // On-demand Advanced DNA analysis (LLM deep-dive into lyrics + composition),
  // stored as JSON so it survives page reloads. Written by the analyze-advanced
  // API route the first time the user requests the analysis.
  advancedDna: text("advanced_dna"),
  pollsOpenAt: timestamp("polls_open_at"),
  pollsCloseAt: timestamp("polls_close_at"),
  // Archiveren bewaart alleen de originele mp3 (s3Key) en verwijdert de
  // HD/WAV-versie, stems en masters. Gearchiveerde tracks zijn niet
  // afspeelbaar en niet bruikbaar in releases. Zie src/lib/archive-guards.ts.
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  // Stamped by a DB trigger (see init.ts) the moment status first transitions
  // into "done"/"failed" — createdAt to completedAt is the generation time.
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tracks_user_id_idx").on(table.userId),
  index("tracks_user_id_status_idx").on(table.userId, table.status),
  index("tracks_status_idx").on(table.status),
  index("tracks_user_id_created_at_idx").on(table.userId, table.createdAt),
  index("tracks_archived_at_idx").on(table.archivedAt),
  uniqueIndex("tracks_user_provider_audio_id_unique").on(table.userId, table.provider, table.audioId),
]);

export const trackStems = pgTable("track_stems", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackId: uuid("track_id").notNull(),
  userId: uuid("user_id").notNull(),
  stemType: varchar("stem_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  jobId: varchar("job_id", { length: 255 }),
  audioUrl: text("audio_url"),
  s3Key: text("s3_key"),
  format: varchar("format", { length: 10 }).default("mp3"),
  error: text("error"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("track_stems_track_id_idx").on(table.trackId),
  uniqueIndex("track_stems_track_id_stem_type_unique").on(table.trackId, table.stemType),
]);

export const trackStemsRelations = relations(trackStems, ({ one }) => ({
  track: one(tracks, {
    fields: [trackStems.trackId],
    references: [tracks.id],
  }),
  user: one(users, {
    fields: [trackStems.userId],
    references: [users.id],
  }),
}));

export const trackMasters = pgTable("track_masters", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackId: uuid("track_id").notNull(),
  userId: uuid("user_id").notNull(),
  variationCategory: varchar("variation_category", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  jobId: varchar("job_id", { length: 255 }),
  audioUrl: text("audio_url"),
  s3Key: text("s3_key"),
  format: varchar("format", { length: 10 }).default("mp3"),
  error: text("error"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("track_masters_track_id_idx").on(table.trackId),
  uniqueIndex("track_masters_track_id_variation_unique").on(table.trackId, table.variationCategory),
]);

export const trackMastersRelations = relations(trackMasters, ({ one }) => ({
  track: one(tracks, {
    fields: [trackMasters.trackId],
    references: [tracks.id],
  }),
  user: one(users, {
    fields: [trackMasters.userId],
    references: [users.id],
  }),
}));

// Time Coded Lyrics — forced-alignment result, generated separately from
// tracks.lyrics/lyricsTimestamps so the source lyrics stay untouched. One
// row per track (upsert on regenerate). `tcl` holds the canonical generic
// TclDocument JSON (see src/lib/tcl/types.ts); `engine` records which
// alignment engine produced it, kept swappable per src/lib/tcl/engine.ts.
export const trackAlignments = pgTable("track_alignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackId: uuid("track_id").notNull(),
  userId: uuid("user_id").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending|processing|done|failed
  engine: varchar("engine", { length: 30 }).default("quicklrc").notNull(),
  confidence: real("confidence"),
  tcl: text("tcl"),
  error: text("error"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("track_alignments_track_id_unique").on(table.trackId),
  index("track_alignments_user_id_idx").on(table.userId),
]);

export const trackAlignmentsRelations = relations(trackAlignments, ({ one }) => ({
  track: one(tracks, {
    fields: [trackAlignments.trackId],
    references: [tracks.id],
  }),
  user: one(users, {
    fields: [trackAlignments.userId],
    references: [users.id],
  }),
}));

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
  s3KeyCover: varchar("s3_key_cover", { length: 512 }),
  s3KeyCoverThumb: varchar("s3_key_cover_thumb", { length: 512 }),
  // System-managed playlists (e.g. "Master Tracks"): can't be deleted,
  // renamed, or have tracks manually added/removed — only reordered. See
  // ensureMasterTracksPlaylist in lib/playlists.ts.
  isSystem: boolean("is_system").default(false).notNull(),
  // Published playlists appear on the public /discover page. Toggled by
  // admins via the playlist panel; playlists are always private by default.
  isPublic: boolean("is_public").default(false).notNull(),
  publishedAt: timestamp("published_at"),
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

// A release is a formal, publishable grouping of tracks (single, EP, album),
// distinct from playlists (free-form curation) and workspaces (working
// folders). A track can appear on multiple releases (e.g. a remix that's
// both on its own remix single and on a later compilation) via releaseTracks.
export const releases = pgTable("releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // single | ep | album
  // Free-form descriptive tag, not validated against `type`: remix, compilation,
  // soundtrack, solo, live, etc. Used for display/filtering only.
  kind: varchar("kind", { length: 30 }),
  artistName: varchar("artist_name", { length: 255 }),
  // Free-form credits text (producer, writer, mixed by, etc.) — display only.
  credits: text("credits"),
  description: text("description"),
  coverUrl: text("cover_url"),
  s3KeyCover: text("s3_key_cover"),
  s3KeyCoverThumb: text("s3_key_cover_thumb"),
  releaseDate: timestamp("release_date"),
  isPublic: boolean("is_public").default(false).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("releases_user_id_idx").on(table.userId),
]);

export const releaseTracks = pgTable("release_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull(),
  trackId: uuid("track_id").notNull(),
  position: integer("position").notNull(),
  side: varchar("side", { length: 10 }), // "A" / "B" / null
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("release_tracks_release_idx").on(table.releaseId),
  index("release_tracks_track_idx").on(table.trackId),
  uniqueIndex("release_tracks_release_position_unique").on(table.releaseId, table.position),
]);

export const releasesRelations = relations(releases, ({ one, many }) => ({
  user: one(users, {
    fields: [releases.userId],
    references: [users.id],
  }),
  releaseTracks: many(releaseTracks),
}));

export const releaseTracksRelations = relations(releaseTracks, ({ one }) => ({
  release: one(releases, {
    fields: [releaseTracks.releaseId],
    references: [releases.id],
  }),
  track: one(tracks, {
    fields: [releaseTracks.trackId],
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

export const savedLyrics = pgTable("saved_lyrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  lyrics: text("lyrics").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("saved_lyrics_user_id_idx").on(table.userId),
]);

export const savedLyricsRelations = relations(savedLyrics, ({ one }) => ({
  user: one(users, {
    fields: [savedLyrics.userId],
    references: [users.id],
  }),
}));

export const stylePresets = pgTable("style_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("style_presets_user_id_idx").on(table.userId),
]);

export const stylePresetsRelations = relations(stylePresets, ({ one }) => ({
  user: one(users, {
    fields: [stylePresets.userId],
    references: [users.id],
  }),
}));

// Single source of truth for a song's definitive lyrics + prompt, independent
// of where it was actually generated (MelodIQ or directly in Suno). Optionally
// links back to a MelodIQ track for reference.
export const songArchive = pgTable("song_archive", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Self-reference: a translation is just another entry pointing back at the
  // original song, with its own lyrics/prompt/track and a language label.
  parentId: uuid("parent_id").references((): any => songArchive.id, { onDelete: "cascade" }),
  language: varchar("language", { length: 50 }),
  title: varchar("title", { length: 255 }).notNull(),
  lyrics: text("lyrics").default("").notNull(),
  prompt: text("prompt").default("").notNull(),
  notes: text("notes").default("").notNull(),
  trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("song_archive_user_id_idx").on(table.userId),
  index("song_archive_track_id_idx").on(table.trackId),
  index("song_archive_parent_id_idx").on(table.parentId),
]);

export const songArchiveRelations = relations(songArchive, ({ one, many }) => ({
  user: one(users, {
    fields: [songArchive.userId],
    references: [users.id],
  }),
  track: one(tracks, {
    fields: [songArchive.trackId],
    references: [tracks.id],
  }),
  parent: one(songArchive, {
    fields: [songArchive.parentId],
    references: [songArchive.id],
    relationName: "songArchiveTranslations",
  }),
  translations: many(songArchive, {
    relationName: "songArchiveTranslations",
  }),
}));

export const trackDnaVotes = pgTable("track_dna_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackId: uuid("track_id").notNull(),
  userId: uuid("user_id").notNull(),
  vocal: real("vocal").notNull(),
  instrumental: real("instrumental").notNull(),
  atmosphere: real("atmosphere").notNull(),
  lyrics: real("lyrics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("track_dna_votes_track_user_unique").on(table.trackId, table.userId),
  index("track_dna_votes_track_id_idx").on(table.trackId),
]);

export const trackDnaVotesRelations = relations(trackDnaVotes, ({ one }) => ({
  track: one(tracks, {
    fields: [trackDnaVotes.trackId],
    references: [tracks.id],
  }),
  user: one(users, {
    fields: [trackDnaVotes.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
]);

// ─── Cover Images ──────────────────────────────────────────────────────────────
// Tracks and releases can have up to 5 cover images each. The first image
// (position 0, isMain = true) is used as the default cover everywhere.
export const coverImages = pgTable("cover_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(), // "track" | "release"
  entityId: uuid("entity_id").notNull(),
  s3Key: text("s3_key").notNull(),
  s3KeyThumb: text("s3_key_thumb"),
  position: integer("position").notNull().default(0),
  isMain: boolean("is_main").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cover_images_entity_idx").on(table.entityType, table.entityId),
  index("cover_images_user_idx").on(table.userId),
]);

export const coverImagesRelations = relations(coverImages, ({ one }) => ({
  user: one(users, {
    fields: [coverImages.userId],
    references: [users.id],
  }),
}));
