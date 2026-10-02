import { videosTable } from "@/db/schema";

export interface OtomoVideoInsert extends Omit<typeof videosTable.$inferInsert, "channel_id"> {
    channel_id: string;
}

export interface OtomoChannelDataInsert {
    channel_id: string;
    name: string;
    profile_picture: string;
    banner: string | undefined;
}
