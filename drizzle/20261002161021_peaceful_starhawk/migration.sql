ALTER TABLE "channels" ADD COLUMN "profile_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner" varchar(255);--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "thumbhash" varchar(64);