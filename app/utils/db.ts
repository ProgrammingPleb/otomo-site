import { channelsTable, lastCheckedTable, streamsTable } from '@/db/schema';
import 'dotenv/config';
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { drizzle } from 'drizzle-orm/node-postgres';
import { HolodexVideo } from '../model/holodex';

export const postgresUser = process.env.POSTGRES_USER ?? "otomo";
export const postgresPassword = process.env.POSTGRES_PASSWORD ?? "ChangeMe123!";
export const postgresDB = process.env.POSTGRES_DB ?? "otomo";

export const db = drizzle(`postgres://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDB}`);

export async function isRefreshPossible(name: string) {
    const currentTime = new Date();

    try {
        if (currentTime.getMinutes() < 15) {
            return true;
        }

        const timeCheck = await db.select({ time: lastCheckedTable.time })
            .from(lastCheckedTable).where(eq(lastCheckedTable.name, name));
        if (timeCheck.length > 0 && timeCheck[0].time < currentTime.getTime()) {    // If exists, then check if the time has passed.
            return true;
        }
        if (timeCheck.length < 1) {     // If does not exist, assume no checks for this action yet.
            return true;
        }
    } catch (e) {
        console.error(`DB: Unable to get last checked date for "${name}"`, e);
    }

    return false;
}

export async function updateLastCheckedTime(name: string, timeoutHours: number) {
    const currentTimeMillis = new Date().getTime();
    const timeoutMillis = timeoutHours * 60 * 60 * 1000;

    try {
        await db.insert(lastCheckedTable).values({
            name: name,
            time: currentTimeMillis + timeoutMillis
        }).onConflictDoUpdate({
            target: lastCheckedTable.name,
            set: { time: currentTimeMillis + timeoutMillis }
        });
    } catch (e) {
        console.error("DB: Unable to get settings!", e);
    }
}

export async function refreshStreams(
    videos: HolodexVideo[]
) {
    try {
        // Check for streams not in the current list and assume they have ended
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);
        const dayStreamsRaw = await db.select({
            video_id: streamsTable.video_id
        }).from(streamsTable).where(
            and(
                eq(streamsTable.ended, false),
                or(
                    isNull(streamsTable.start_scheduled),
                    gte(streamsTable.start_scheduled, checkDate.getTime())
                )
            )
        );
        const dayStreams = dayStreamsRaw.map((video) => video.video_id);
        const currentLivestreams = videos.map((video) => video.id);
        for (const video of dayStreams) {
            if (!currentLivestreams.includes(video)) {
                await db.update(streamsTable).set({
                    ended: true
                }).where(eq(streamsTable.video_id, video));
            }
        }

        // Now check and update streams that are live or upcoming
        for (const video of videos) {
            if (video.type == "stream") {
                const channelFetch = await db.select({
                    id: channelsTable.id
                })
                    .from(channelsTable)
                    .where(eq(channelsTable.channel_id, video.channel.id));
                let channelId = channelFetch.length > 0 ? channelFetch[0].id : null;
                if (channelId === null) {
                    continue;       // TODO: Check if we can fallback to a sane backend
                }
                await db.insert(streamsTable).values({
                    channel_id: channelId,
                    title: video.title,
                    video_id: video.id,
                    start_scheduled: video.start_scheduled != null ? new Date(video.start_scheduled).getTime() : null,
                    start_actual: video.start_actual != null ? new Date(video.start_actual).getTime() : null,
                    ended: false
                }).onConflictDoUpdate({
                    target: streamsTable.video_id,
                    set: {
                        title: video.title,
                        start_scheduled: video.start_scheduled != null ? new Date(video.start_scheduled).getTime() : null,
                        start_actual: video.start_actual != null ? new Date(video.start_actual).getTime() : null,
                    }
                });
            }
        }
    } catch (e) {
        console.error("DB: Unable to set streams!", e);
    }
}
