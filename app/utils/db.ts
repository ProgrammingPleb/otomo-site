import { channelsTable, lastCheckedTable, queuedVideosTable, videosTable, webSubTable } from '@/db/schema';
import { and, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseUrl } from '../env';
import { HolodexVideo } from '../model/holodex';
import { OtomoChannelDataInsert, OtomoVideoInsert } from '../model/otomo';
import { HashRefreshResult, VideoQueueEntry, YOUTUBE_VIDEOS_BUFFER_MINUTES } from './fetch';

export const db = drizzle(databaseUrl);

export async function isRefreshPossible(name: string) {
    const currentTime = new Date();

    try {
        const timeCheck = await db.select({ time: lastCheckedTable.time })
            .from(lastCheckedTable).where(eq(lastCheckedTable.name, name));
        if (timeCheck.length > 0 && timeCheck[0].time < currentTime.getTime()) {    // If exists, then check if the time has passed.
            return true;
        }
        if (timeCheck.length < 1) {     // If does not exist, assume no checks for this action yet.
            return true;
        }
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to get last checked date for "${name}"`, e);
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
        console.error(`[${new Date().toISOString()}] DB: Unable to get settings!`, e);
    }
}

export async function queueUnseenHolodexVideos(
    videos: HolodexVideo[]
) {
    try {
        const unqueuedVideos: VideoQueueEntry[] = [];

        const dbChannelIds = new Set(
            (await db.select({ channelId: channelsTable.channel_id }).from(channelsTable))
                .map((channel) => channel.channelId)
        );
        const dbQueuedVideoIds = new Set(
            (await db.select({ videoId: queuedVideosTable.video_id }).from(queuedVideosTable))
                .map((video) => video.videoId)
        );
        for (const video of videos) {
            if (!dbChannelIds.has(video.channel.id)) {
                continue;           // Skip as we don't have accurate data for this channel yet
            }
            if (!dbQueuedVideoIds.has(video.id)) {
                unqueuedVideos.push({
                    id: video.id,
                    isShorts: false
                });
            }
        }

        await modifyVideoQueue(unqueuedVideos, "new");

        return unqueuedVideos.length;
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to queue unseen videos from Holodex!`, e);
    }

    return 0;
}

export async function upsertYouTubeVideos(videos: OtomoVideoInsert[], skipEndedUpdate: boolean) {
    const channelsData = await db.select({
        id: channelsTable.id,
        channelId: channelsTable.channel_id
    }).from(channelsTable);
    const channelsMap: Map<string, number> = new Map();
    channelsData.forEach((value) => channelsMap.set(value.channelId, value.id));

    for (const video of videos) {
        try {
            const channelId = channelsMap.get(video.channel_id);
            if (!channelId) {
                console.log(`Unable to get channel ID from DB with "${video.channel_id}" for video "${video.video_id}"!`);
                continue;   // TODO: Check if we can fallback to a sane backend
            }

            await db.insert(videosTable).values({
                channel_id: channelId,
                title: video.title,
                video_id: video.video_id,
                type: video.type,
                start_scheduled: video.start_scheduled,
                start_actual: video.start_actual,
                end_actual: video.end_actual,
                published_at: video.published_at,
            }).onConflictDoUpdate({
                target: videosTable.video_id,
                set: {
                    title: video.title,
                    start_scheduled: video.start_scheduled,
                    start_actual: video.start_actual,
                    end_actual: skipEndedUpdate ? undefined : video.end_actual,   // undefined skips this write, only null writes updates back
                    published_at: video.published_at,
                }
            });
        } catch (e) {
            console.error(`[${new Date().toISOString()}] DB: Unable to set video data for "${video.video_id}"!`, e);
        }
    }
}

export async function removeYouTubeVideo(videoId: string) {
    try {
        await db.delete(videosTable).where(eq(videosTable.video_id, videoId));
        await db.delete(queuedVideosTable).where(eq(queuedVideosTable.video_id, videoId));
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to remove YouTube video details for "${videoId}"!`, e)
    }
}

export async function getQueuedVideos(): Promise<VideoQueueEntry[] | undefined> {
    const currentTime = new Date().getTime();

    try {
        return await db.select({
            id: queuedVideosTable.video_id,
            isShorts: queuedVideosTable.is_shorts,
        }).from(queuedVideosTable).where(lte(queuedVideosTable.time, currentTime));
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to get queued videos!`, e);
    }
}

export async function getMissingHashVideos() {
    // Filter out videos published older than 1 day
    return await db.select({ video_id: videosTable.video_id }).from(videosTable)
        .where(
            and(
                gte(videosTable.published_at, Date.now() - (24 * 60 * 60 * 1000)),
                isNull(videosTable.thumbhash)
            )
        );
}

export async function modifyVideoQueue(videos: VideoQueueEntry[], type: keyof typeof YOUTUBE_VIDEOS_BUFFER_MINUTES) {
    const minTime = new Date().getTime() + (YOUTUBE_VIDEOS_BUFFER_MINUTES[type] - 0.5) * 60 * 1000;     // Remove 30 seconds so that they are fetched on the upcoming 2 minute fetches

    for (const video of videos) {
        try {
            await db.insert(queuedVideosTable).values({
                video_id: video.id,
                time: minTime,
                is_shorts: video.isShorts,
            }).onConflictDoUpdate({
                target: queuedVideosTable.video_id,
                set: {
                    time: minTime,
                    is_shorts: video.isShorts,
                }
            });
        } catch (e) {
            console.error(`[${new Date().toISOString()}] DB: Unable to set video queue time for "${video.id}"!`, e);
        }
    }
}

export async function removeVideosFromQueue(videoIds: string[]) {
    try {
        await db.delete(queuedVideosTable).where(inArray(queuedVideosTable.video_id, videoIds));
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to remove YouTube video queue items!`, e)
    }
}

export async function getPendingChannelResubs() {
    const channels = await db.select({ channel_id: channelsTable.channel_id }).from(channelsTable)
        .leftJoin(webSubTable, eq(channelsTable.id, webSubTable.channel_id))
        .where(
            or(
                isNull(webSubTable.time),
                lte(webSubTable.time, new Date().getTime())
            )
        );
    return channels;
}

export async function setChannelSubscription(channelId: string, time: number) {
    const channel = await db.select({ id: channelsTable.id })
        .from(channelsTable).where(eq(channelsTable.channel_id, channelId));

    if (channel.length < 1) {
        console.error(`[${new Date().toISOString()}] DB: Unable to set channel subscription end time for "${channelId}"!`);
        return false;
    }
    try {
        await db.insert(webSubTable).values({ channel_id: channel[0].id, time: time })
            .onConflictDoUpdate({
                target: webSubTable.channel_id,
                set: { time: time }
            });
        return true;
    } catch (e) {
        console.error(`[${new Date().toISOString()}] DB: Unable to set channel subscription end time for "${channelId}"!`, e);
    }

    return false;
}

export async function getAllChannels() {
    return await db.select().from(channelsTable);
}

export async function getMissingHashChannels() {
    return await db.select().from(channelsTable)
        .where(or(
            isNull(channelsTable.profile_hash),
            and(
                isNotNull(channelsTable.banner),
                isNull(channelsTable.banner_hash)
            )
        ));
}

export async function updateChannelsData(channelsData: OtomoChannelDataInsert[]) {
    await db.transaction(async (tx) => {
        for (const channel of channelsData) {
            const banner = channel.banner ?? null;
            await tx.update(channelsTable).set({
                profile_picture: channel.profile_picture,
                profile_hash:
                    sql`CASE WHEN ${channelsTable.profile_picture} IS DISTINCT FROM ${channel.profile_picture}
                            THEN NULL ELSE ${channelsTable.profile_hash} END`,
                banner: banner,
                banner_hash:
                    sql`CASE WHEN ${channelsTable.banner} IS DISTINCT FROM ${banner}
                            THEN NULL ELSE ${channelsTable.banner_hash} END`,
            }).where(eq(channelsTable.channel_id, channel.channel_id));
        }
    });
}

export async function updateHashes(hashes: HashRefreshResult[]) {
    await db.transaction(async (tx) => {
        for (const hash of hashes) {
            switch (hash.type) {
                case "profile_picture":
                    await tx.update(channelsTable).set({ profile_hash: hash.data })
                        .where(eq(channelsTable.channel_id, hash.id));
                    break;
                case "banner":
                    await tx.update(channelsTable).set({ banner_hash: hash.data })
                        .where(eq(channelsTable.channel_id, hash.id));
                    break;
                case "thumbnail":
                    await tx.update(videosTable).set({ thumbhash: hash.data })
                        .where(eq(videosTable.video_id, hash.id));
                    break;
            }
        }
    });
}
