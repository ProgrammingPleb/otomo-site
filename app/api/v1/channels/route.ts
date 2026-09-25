import { db } from "@/app/utils/db";
import { channelsTable } from "@/db/schema";

export async function GET() {
    const data = await db.select({
        id: channelsTable.channel_id,
        name: channelsTable.name,
        romaji: channelsTable.romaji,
        profile_picture: channelsTable.profile_picture,
        group: channelsTable.group,
        is_inactive: channelsTable.is_inactive,
        is_group_channel: channelsTable.is_group_channel,
        organization: channelsTable.organization,
    }).from(channelsTable);

    return Response.json(data.map((channel) => {
        channel.romaji = channel.romaji != "" ? channel.romaji : null;
        return channel;
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
        if (rows[0] != "Youtube ID,Name,Romaji Name,Profile Picture,Group,Is Inactive,Is Group Channel,Organization") {
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
                    romaji: rowData[2],
                    profile_picture: rowData[3],
                    group: rowData[4],
                    is_inactive: rowData[5] == "1",
                    is_group_channel: rowData[6] == "1",
                    organization: rowData[7]
                }).onConflictDoUpdate({
                    target: channelsTable.channel_id,
                    set: {
                        name: rowData[1],
                        romaji: rowData[2],
                        profile_picture: rowData[3],
                        group: rowData[4],
                        is_inactive: rowData[5] == "1",
                        is_group_channel: rowData[6] == "1",
                        organization: rowData[7]
                    }
                });
            } catch {
                erroredChannels.push(rowData[0]);
            }
        }
        console.log(`[${new Date().toISOString()}] Imported ${rows.length - 1} channels! (Errored: ${erroredChannels.length})`);
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
        });
    }
}
