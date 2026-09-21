import { bigint, boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";

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

export const streamsTable = pgTable("streams", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    channel_id: integer().references(() => channelsTable.id),
    title: varchar({ length: 255 }).notNull(),
    video_id: varchar({ length: 64 }).notNull().unique(),
    start_scheduled: bigint({ mode: "number" }),
    start_actual: bigint({ mode: "number" }),
    ended: boolean(),
});

export const lastCheckedTable = pgTable("last_checked", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull().unique(),
    time: bigint({ mode: "number" }).notNull(),
});
