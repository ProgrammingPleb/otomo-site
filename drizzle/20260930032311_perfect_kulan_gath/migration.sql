CREATE TYPE "etag_type" AS ENUM('channel', 'video');--> statement-breakpoint
CREATE TYPE "video_type" AS ENUM('stream', 'video', 'short');--> statement-breakpoint
CREATE TABLE "queued" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "queued_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"video_id" varchar(64) NOT NULL UNIQUE,
	"time" bigint NOT NULL,
	"is_shorts" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websub" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "websub_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" integer NOT NULL UNIQUE,
	"time" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "streams" RENAME TO "videos";--> statement-breakpoint
ALTER TABLE "videos" RENAME CONSTRAINT "streams_channel_id_channels_id_fk" TO "videos_channel_id_channels_id_fkey";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "type" "video_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "end_actual" bigint;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "published_at" bigint;--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN "ended";--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "websub" ADD CONSTRAINT "websub_channel_id_channels_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT "videos_channel_id_channels_id_fkey", ADD CONSTRAINT "videos_channel_id_channels_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE;