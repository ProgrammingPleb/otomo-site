import { migrate } from "drizzle-orm/node-postgres/migrator";
import { postgresUser, postgresPassword, postgresHost, postgresPort, postgresDB } from "./app/env";
import { db, queueUnseenHolodexVideos } from "./app/utils/db";
import { getLatestHolodexVideos, processQueuedVideos, updateImageHashes, updateYouTubeChannels } from "./app/utils/fetch";
import { updateChannelSubscriptions } from "./app/utils/subscribe";
import { join } from "path";

const holodexKey = process.env.HOLODEX_KEY;
const youtubeSecret = process.env.YOUTUBE_WEBSUB_SECRET;
const youtubeKey = process.env.YOUTUBE_API_KEY;

async function updateData() {
    try {
        if (holodexKey) {
            try {
                const videos = await getLatestHolodexVideos();
                if (videos) {
                    const queuedVideos = await queueUnseenHolodexVideos(videos);
                    if (queuedVideos > 0) {
                        console.log(`[${new Date().toISOString()}] Added ${queuedVideos} video ID(s) to the fetch queue!`);
                    }
                }
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Unable to fetch latest data from Holodex!`, e);
            }
        }

        if (youtubeSecret) {
            const attemptedResubs = await updateChannelSubscriptions();
            if (attemptedResubs > 0) {
                console.log(`[${new Date().toISOString()}] Attempted WebSub resubs on ${attemptedResubs} channel(s)!`);
            }
        }

        if (youtubeKey) {
            try {
                await processQueuedVideos();
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Unable to process queued videos!`, e);
            }

            try {
                const refreshedChannels = await updateYouTubeChannels();
                if (refreshedChannels) {
                    console.log(`[${new Date().toISOString()}] Got the latest info for ${refreshedChannels} channels!`);
                }
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Unable to get the latest info for YouTube channels!`, e);
            }

            try {
                const processedHashes = await updateImageHashes();
                if (processedHashes > 0) {
                    console.log(`[${new Date().toISOString()}] Processed thumbhash for ${processedHashes} items!`);
                }
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Unable to process thumbhash for non-hashed items!`, e);
            }
        }
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Data update attempt has failed!`, e);
    } finally {
        setTimeout(() => {
            updateData();
        }, 2 * 60 * 1000);
    }
}

export async function register() {
    if (!postgresUser || !postgresPassword || !postgresHost || !postgresPort || !postgresDB) {
        console.error("DB: Details were not set!");
        process.exit(1);
    }

    try {
        await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
        console.log(`[${new Date().toISOString()}] Completed database migrations.`);
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Unable to perform database migrations!`, e);
        process.exit(1);
    }

    if (holodexKey || youtubeSecret || youtubeKey) {
        updateData();
        if (!holodexKey) {
            console.log("No HOLODEX_KEY value was set! Skipping holodex update loop.");
        }
        if (!youtubeSecret) {
            console.log("No YOUTUBE_WEBSUB_SECRET value was set! Skipping holodex update loop.");
        }
        if (!youtubeKey) {
            console.log("No YOUTUBE_API_KEY value was set! Skipping holodex update loop.");
        }
    } else {
        console.log("No HOLODEX_KEY, YOUTUBE_API_KEY and YOUTUBE_WEBSUB_SECRET value was set! Skipping update loop.");
    }
}
