import { migrate } from "drizzle-orm/node-postgres/migrator";
import { postgresUser, postgresPassword, postgresHost, postgresPort, postgresDB } from "./app/env";
import { db, queueUnseenHolodexVideos } from "./app/utils/db";
import { getLatestHolodexVideos, processQueuedVideos } from "./app/utils/fetch";
import { updateChannelSubscriptions } from "./app/utils/subscribe";
import { join } from "path";

async function updateData() {
    try {
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

        const attemptedResubs = await updateChannelSubscriptions();
        if (attemptedResubs > 0) {
            console.log(`[${new Date().toISOString()}] Attempted WebSub resubs on ${attemptedResubs} channel(s)!`);
        }

        try {
            await processQueuedVideos();
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Unable to process queued videos!`, e);
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

    const holodexKey = process.env.HOLODEX_KEY;
    const youtubeSecret = process.env.YOUTUBE_WEBSUB_SECRET;
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (holodexKey && youtubeSecret && youtubeKey) {
        updateData();
    } else {
        console.log("No HOLODEX_KEY, YOUTUBE_API_KEY and/or YOUTUBE_WEBSUB_SECRET value was set! Skipping stream updates.");
    }
}
