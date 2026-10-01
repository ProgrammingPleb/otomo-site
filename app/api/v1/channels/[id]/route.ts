import { eq } from "drizzle-orm";
import { channelsTable } from "@/db/schema";
import { db } from "@/app/utils/db";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: channelId } = await params;

    const data = await db.select({
        id: channelsTable.channel_id,
        name: channelsTable.name,
        romaji: channelsTable.romaji,
        profile_picture: channelsTable.profile_picture,
        group: channelsTable.group,
        major_group: channelsTable.major_group,
        is_inactive: channelsTable.is_inactive,
        is_group_channel: channelsTable.is_group_channel,
        organization: channelsTable.organization,
    }).from(channelsTable).where(eq(channelsTable.channel_id, channelId));

    if (data.length > 0) {
        return Response.json(data.map((channel) => {
            channel.romaji = channel.romaji != "" ? channel.romaji : null;
            return channel;
        })[0]);
    }

    return Response.json({}, { status: 404 });
}