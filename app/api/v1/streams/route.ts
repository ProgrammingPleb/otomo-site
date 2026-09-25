import { db } from "@/app/utils/db";
import { channelsTable, videosTable } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function GET() {
    const data = await db.select().from(videosTable)
        .where(
            and(
                isNull(videosTable.end_actual),
                eq(videosTable.type, "stream")
            )
        )
        .innerJoin(channelsTable, eq(videosTable.channel_id, channelsTable.id));
    
    return Response.json(
        data.map((row) => {
            const { id: removedStreamId, channel_id: removedChannelId, ...stream } = row.videos;
            const { id: removedChannelJoinId, channel_id: id, ...channel } = row.channels;
            return { ...stream, channel: { id: id, ...channel } };
        })
    );
}
