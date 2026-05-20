import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }),
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
  audioId: varchar("audio_id", { length: 255 }),
  wavJobId: varchar("wav_job_id", { length: 255 }),
  creditsUsed: integer("credits_used").default(0).notNull(),
  error: text("error"),
  coverUrl: text("cover_url"),
  s3KeyCover: text("s3_key_cover"),
  rating: varchar("rating", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tracksRelations = relations(tracks, ({ one }) => ({
  user: one(users, {
    fields: [tracks.userId],
    references: [users.id],
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
