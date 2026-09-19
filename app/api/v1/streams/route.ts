import { db } from "@/app/utils/db";
import { channelsTable, streamsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
    const data = await db.select().from(streamsTable)
        .where(eq(streamsTable.ended, false))
        .leftJoin(channelsTable, eq(streamsTable.channel_id, channelsTable.id));
    
    return Response.json(
        data.map((row) => {
            const { id: removedStreamId, channel_id: removedChannelId, ...stream } = row.streams;
            const { id: removedChannelJoinId, channel_id: id, ...channel } = row.channels!;
            return { ...stream, channel: { id: id, ...channel } };
        })
    );
}
