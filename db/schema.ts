import { bigint, boolean, integer, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";

export const eTagType = pgEnum("etag_type", ["channel", "video"]);
export const videoType = pgEnum("video_type", ["stream", "video", "short"]);

export const channelsTable = pgTable("channels", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    channel_id: varchar({ length: 32 }).notNull().unique(),
    name: varchar({ length: 255 }).notNull(),
    romaji: varchar({ length: 255 }),
    group: varchar({ length: 100 }).notNull(),
    profile_picture: varchar({ length: 255 }).notNull(),
    is_inactive: boolean().notNull(),
    is_group_channel: boolean().notNull(),
    organization: varchar({ length: 100 }),
});

export const videosTable = pgTable("videos", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    channel_id: integer().references(() => channelsTable.id, { onDelete: "cascade" }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    video_id: varchar({ length: 64 }).notNull().unique(),
    type: videoType().notNull(),
    start_scheduled: bigint({ mode: "number" }),
    start_actual: bigint({ mode: "number" }),
    end_actual: bigint({ mode: "number" }),
    published_at: bigint({ mode: "number" }),
});

export const lastCheckedTable = pgTable("last_checked", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull().unique(),
    time: bigint({ mode: "number" }).notNull(),
});

export const webSubTable = pgTable("websub", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    channel_id: integer().references(() => channelsTable.id, { onDelete: "cascade" }).notNull().unique(),
    time: bigint({ mode: "number" }).notNull(),
});

export const queuedVideosTable = pgTable("queued", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    video_id: varchar({ length: 64 }).notNull().unique(),
    time: bigint({ mode: "number" }).notNull(),
    is_shorts: boolean().notNull(),
});
