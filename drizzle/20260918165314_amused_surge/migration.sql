CREATE TABLE "channels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" varchar(32) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"romaji" varchar(255),
	"group" varchar(100) NOT NULL,
	"is_inactive" boolean NOT NULL,
	"is_group_channel" boolean NOT NULL,
	"organization" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "last_checked" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "last_checked_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"time" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "streams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" integer,
	"title" varchar(255) NOT NULL,
	"video_id" varchar(64) NOT NULL,
	"time" integer NOT NULL,
	"ended" boolean
);
--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_channel_id_channels_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id");