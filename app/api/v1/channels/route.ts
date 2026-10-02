import { db } from "@/app/utils/db";
import { updateYouTubeChannels } from "@/app/utils/fetch";
import { channelsTable } from "@/db/schema";
import { after } from "next/server";

export async function GET() {
    const data = await db.select().from(channelsTable);

    return Response.json(data.map((channel) => {
        const { id: dbId, channel_id: id, group, ...respChannel } = channel;
        channel.romaji = channel.romaji != "" ? channel.romaji : null;
        return {
            id: id,
            group: group != "" ? group : null,
            ...respChannel
        };
    }));
}

export async function POST(request: Request) {
    const uploadKey = process.env.UPLOAD_KEY;
    const headerKey = request.headers.get("X-API-KEY");

    if (!uploadKey) {
        return Response.json({
            success: false,
            message: "Uploading data is disabled!"
        }, { status: 501 });
    }

    if (headerKey !== uploadKey) {
        return Response.json({
            success: false,
            message: "Not allowed."
        }, { status: 403 });
    }

    try {
        const data = await request.text();

        if (data == "") {
            return Response.json({
                success: false,
                message: "No data was given!"
            }, { status: 400 });
        }

        const rows = data.split("\n").map((row) => row.replace("\r", ""));
        if (rows[0] != "Youtube ID,Name,Romaji Name,Profile Picture,Group,Major Group,Is Inactive,Is Group Channel,Organization") {
            return Response.json({
                success: false,
                message: "The data given was invalid!"
            }, { status: 400 });
        }

        const erroredChannels: string[] = [];
        for (const row of rows.slice(1)) {
            const rowData = row.split(",");

            try {
                await db.insert(channelsTable).values({
                    channel_id: rowData[0],
                    name: rowData[1],
                    romaji: rowData[2] ? rowData[2] : null,
                    profile_picture: rowData[3],
                    group: rowData[4],
                    major_group: rowData[5] ? rowData[5] : null,
                    is_inactive: rowData[6] == "1",
                    is_group_channel: rowData[7] == "1",
                    organization: rowData[8] ? rowData[8] : null
                }).onConflictDoUpdate({
                    target: channelsTable.channel_id,
                    set: {
                        name: rowData[1],
                        romaji: rowData[2] ? rowData[2] : null,
                        group: rowData[4],
                        major_group: rowData[5] ? rowData[5] : null,
                        is_inactive: rowData[6] == "1",
                        is_group_channel: rowData[7] == "1",
                        organization: rowData[8] ? rowData[8] : null
                    }
                });
            } catch {
                erroredChannels.push(rowData[0]);
            }
        }
        console.log(`[${new Date().toISOString()}] Imported ${rows.length - 1} channels! (Errored: ${erroredChannels.length})`);
        after(async () => {
            try {
                await updateYouTubeChannels(true);        // Refresh the channels data with actual data from YouTube
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Unable to get the latest info for YouTube channels (post-upload)!`, e);
            }
        });
        if (erroredChannels.length > 0) {
            console.log(`Invalid Channel IDs: ${erroredChannels.join(", ")}`);
        }

        return Response.json({
            success: true,
            failedChannels: {
                count: erroredChannels.length,
                channels: erroredChannels
            }
        });
    } catch {
        return Response.json({
            success: false,
            message: "An unexpected error has occurred."
        }, { status: 500 });
    }
}
