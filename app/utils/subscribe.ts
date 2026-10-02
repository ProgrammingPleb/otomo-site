import { getPendingChannelResubs, modifyVideoQueue, removeYouTubeVideo, setChannelSubscription } from "./db";
import { VideoQueueEntry } from "./fetch";

export const YOUTUBE_WEBSUB_SECRET = process.env.YOUTUBE_WEBSUB_SECRET!;

export async function webSubSubscribe(channelId: string) {
    const subscribeRequest = {
        "hub.mode": "subscribe",
        "hub.callback": `https://otomo.pleb.moe/api/v1/webhook/${channelId}`,
        "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
        "hub.verify": "async",
        "hub.secret": YOUTUBE_WEBSUB_SECRET
    };

    const resp = await fetch("https://pubsubhubbub.appspot.com/subscribe", {
        method: "POST",
        body: new URLSearchParams(Object.entries(subscribeRequest)).toString(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    });

    if (resp.ok) {
        await setChannelSubscription(channelId, new Date().getTime() + 15 * 60 * 1000);
    }

    return resp;
}

export async function recordChannelSubscription(channelId: string) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const randomExpiry = Math.floor(1.5 * DAY_MS + Math.random() * (0.5 * DAY_MS));     // Keep to 1.5 - 2 days as a safeguard
    const nextDate = new Date().getTime() + randomExpiry;
    return await setChannelSubscription(channelId, nextDate);
}

export async function updateChannelSubscriptions() {
    const channelIds = (await getPendingChannelResubs()).map((channel) => channel.channel_id);

    let attemptedResubs = 0;
    for (const channelId of channelIds) {
        try {
            const resp = await webSubSubscribe(channelId);

            if (resp.ok) {
                attemptedResubs += 1;
            } else {
                console.log(`[${new Date().toISOString()}] Unable to renew subscription for channel ${channelId}!`);
            }
        } catch (e) {
            console.log(`[${new Date().toISOString()}] Unable to renew subscription for channel ${channelId}!`, e);
        }
    }

    return attemptedResubs;
}

export async function processNewVideos(entries: VideoQueueEntry[], deleted: string[]) {
    await modifyVideoQueue(entries, "new");

    for (const deletedEntry of deleted) {
        await removeYouTubeVideo(deletedEntry);
    }
}
