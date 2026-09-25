import { refreshStreams } from "./app/utils/db";
import { getLatestHolodexVideos, processQueuedVideos } from "./app/utils/fetch";
import { updateChannelSubscriptions } from "./app/utils/subscribe";

async function updateData(holodexKey: string) {
    try {
        try {
            const videos = await getLatestHolodexVideos(holodexKey);
            if (videos) {
                await refreshStreams(videos);
                console.log(`[${new Date().toISOString()}] Refreshed streams from Holodex!`);
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
            updateData(holodexKey);
        }, 2 * 60 * 1000);
    }
}

export function register() {
    const holodexKey = process.env.HOLODEX_KEY;
    const youtubeSecret = process.env.YOUTUBE_WEBSUB_SECRET;
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (holodexKey && youtubeSecret && youtubeKey) {
        updateData(holodexKey);
    } else {
        console.log("No HOLODEX_KEY, YOUTUBE_API_KEY and/or YOUTUBE_WEBSUB_SECRET value was set! Skipping stream updates.");
    }
}
