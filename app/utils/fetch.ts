import { HolodexGeneralQuery, HolodexLiveEndpointOptions, HolodexVideo } from "@/app/model/holodex";
import { youtube, youtube_v3 } from "@googleapis/youtube";
import { OtomoVideoInsert } from "../model/otomo";
import { getQueuedVideos, isRefreshPossible, modifyVideoQueue, removeVideosFromQueue, updateLastCheckedTime, upsertYouTubeVideos } from "./db";

const HOLODEX_BUFFER_NAME = "holodex";
const HOLODEX_BUFFER_HOURS = 0.5;
const HOLODEX_API_KEY = process.env.HOLODEX_KEY;
export const YOUTUBE_VIDEOS_BUFFER_MINUTES = {
    "new": 2,       // New, live and streams within 30 minutes of starting
    "upcoming": 16,     // Streams within 4 hours of starting
    "scheduled": 30     // Streams are outside of the above conditions
}
const YouTube = youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY
});

export interface QueueEntry {
    id: string;
    isShorts: boolean;
}

/**
 * Fetches data from the Holodex endpoint.  
 * Returns `T` if data is received, `undefined` if it has errored out or no data was received.
 * @param endpoint The V2 API endpoint, starting with `/`.
 * @returns Returned data from the endpoint.
 */
async function fetchData<T = unknown>(apiKey: string, endpoint: string, options?: HolodexGeneralQuery) {
    if (apiKey == "") {
        return;
    }

    const fetchOptions = Object.entries(options ?? {
        org: "Nijisanji"
    } as HolodexGeneralQuery);
    const urlOptions = [];
    for (const option of fetchOptions) {
        if (Array.isArray(option[1])) {
            urlOptions.push(`${option[0]}=${option[1].join(",")}`);
        } else if (option[0] === "limit") {
            urlOptions.push(`${option[0]}=${option[1] as number > 50 ? 50 : option[1]}`);
        } else {
            urlOptions.push(`${option[0]}=${option[1]}`);
        }
    }

    const resp = await fetch(`https://holodex.net/api/v2${endpoint}${urlOptions.length > 0 ? `?${urlOptions.join("&")}` : ""}`, {
        headers: {
            "X-APIKEY": apiKey
        }
    });

    if (resp.ok) {
        return await resp.json() as T;
    } else {
        return;
    }
}

/**
 * Fetches all upcoming and current live streams. Does not contain streams that have already ended.
 * @returns All upcoming and current live streams. `undefined` if checked too recently (within 30 minutes) or when fetches fail.
 */
export async function getLatestHolodexVideos() {
    if (!HOLODEX_API_KEY || !await isRefreshPossible(HOLODEX_BUFFER_NAME)) {
        return;
    }

    const data = await fetchData<HolodexVideo[]>(HOLODEX_API_KEY, "/live", {
        org: "Nijisanji",
        status: ["live", "upcoming"]
    } as HolodexLiveEndpointOptions);

    if (data) {
        await updateLastCheckedTime(HOLODEX_BUFFER_NAME, HOLODEX_BUFFER_HOURS);
        return data;
    }
}

export async function processQueuedVideos() {
    const currentTime = new Date().getTime();
    const updatedVideos: Map<keyof typeof YOUTUBE_VIDEOS_BUFFER_MINUTES, OtomoVideoInsert[]> = new Map();
    const dequeuedVideos: string[] = [];
    const queuedVideos = await getQueuedVideos();

    if (!queuedVideos) {
        return;
    }
    const fetchedVideos = [];
    for (const batch of batchVideos(queuedVideos)) {
        const videoData = await getYouTubeVideos(batch);
        if (videoData) {
            fetchedVideos.push(...videoData);
        }
    }
    await upsertYouTubeVideos(fetchedVideos, false);

    for (const video of fetchedVideos) {
        let key: keyof typeof YOUTUBE_VIDEOS_BUFFER_MINUTES = "new";
        if (video.type != "stream" || video.end_actual) {
            dequeuedVideos.push(video.video_id);
            continue;
        }
        if (video.start_scheduled && !video.start_actual) {
            if (video.start_scheduled > currentTime + 30 * 60 * 1000) {
                if (video.start_scheduled < currentTime + 4 * 60 * 60 * 1000) {
                    key = "upcoming";
                } else {
                    key = "scheduled";
                }
            }
            if (video.start_scheduled + 4 * 60 * 60 * 1000 < currentTime) {         // Push really late streams to the back of the queue
                key = "scheduled";
            }
        }

        const categoryArray = updatedVideos.get(key);
        if (!categoryArray) {
            updatedVideos.set(key, [video]);
        } else {
            categoryArray.push(video);
        }
    }

    for (const [key, videos] of updatedVideos.entries()) {
        await modifyVideoQueue(
            videos.map((video) => ({ id: video.video_id, isShorts: false })),
            key
        );
    }
    const fetchedVideoIds = new Set(fetchedVideos.map((video) => video.video_id));
    const nonReturnedVideos = queuedVideos.filter((video) => !fetchedVideoIds.has(video.id)).map((video) => video.id);
    dequeuedVideos.push(...nonReturnedVideos);
    await removeVideosFromQueue(dequeuedVideos);
}

export async function getYouTubeVideos(videoIds: QueueEntry[]) {
    const videoTypeMap: Map<string, boolean> = new Map();
    videoIds.forEach((video) => videoTypeMap.set(video.id, video.isShorts));
    const apiData = (await YouTube.videos.list({
        id: videoTypeMap.keys().toArray(),
        part: ["snippet", "liveStreamingDetails"],
    })).data;

    if (!apiData.items) {
        return;
    }
    const otomoVideo = apiData.items.map((video) => convertToOtomoFormat(video, videoTypeMap.get(video.id!) ?? false));

    return otomoVideo.filter((video) => video !== undefined);
}

function convertToOtomoFormat(video: youtube_v3.Schema$Video, isShort: boolean): OtomoVideoInsert | undefined {
    const snippet = video.snippet;
    if (!snippet) {
        return;
    }

    return {
        channel_id: snippet.channelId!,
        title: snippet.title!,
        video_id: video.id!,
        type: classifyVideo(video.liveStreamingDetails, isShort),
        start_scheduled: video.liveStreamingDetails?.scheduledStartTime ? new Date(video.liveStreamingDetails.scheduledStartTime).getTime() : undefined,
        start_actual: video.liveStreamingDetails?.actualStartTime ? new Date(video.liveStreamingDetails.actualStartTime).getTime() : undefined,
        end_actual: video.liveStreamingDetails?.actualEndTime ? new Date(video.liveStreamingDetails.actualEndTime).getTime() : undefined,
        published_at: new Date(snippet.publishedAt!).getTime(),
    }
}

function classifyVideo(liveStreamDetails: youtube_v3.Schema$VideoLiveStreamingDetails | undefined, isShort: boolean) {
    if (isShort) {
        return "short";
    }
    if (liveStreamDetails) {
        return "stream";
    }
    return "video";
}

function batchVideos(videos: QueueEntry[]): QueueEntry[][] {
    const videoBatches: QueueEntry[][] = [];
    const batchSize = 50;

    for (let i = 0; i < videos.length; i += batchSize) {
        videoBatches.push(videos.slice(i, i + batchSize));
    }

    return videoBatches;
}
