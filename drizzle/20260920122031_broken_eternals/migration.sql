ALTER TABLE "last_checked" ALTER COLUMN "time" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "start_scheduled" bigint;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "start_actual" bigint;--> statement-breakpoint
ALTER TABLE "streams" DROP COLUMN "time";--> statement-breakpoint
ALTER TABLE "last_checked" ADD CONSTRAINT "last_checked_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_video_id_unique" UNIQUE("video_id");