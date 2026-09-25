import { videosTable } from "@/db/schema";

export interface OtomoVideoInsert extends Omit<typeof videosTable.$inferInsert, "channel_id"> {
    channel_id: string;
}
