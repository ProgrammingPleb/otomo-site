import { refreshStreams } from "./app/utils/db";
import { getLatestVideos } from "./app/utils/fetch";

async function updateStreams(holodexKey: string) {
    const videos = await getLatestVideos(holodexKey);
    if (videos) {
        await refreshStreams(videos);
        console.log("Refreshed streams from holodex!");
    }

    setTimeout(() => {
        updateStreams(holodexKey);
    }, 5 * 60 * 1000);
}

export function register() {
    const holodexKey = process.env.HOLODEX_KEY;

    if (holodexKey) {
        updateStreams(holodexKey);
    } else {
        console.log("No HOLODEX_KEY value was set! Skipping stream updates.");
    }
}
