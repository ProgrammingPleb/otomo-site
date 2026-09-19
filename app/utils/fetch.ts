import { HolodexChannel, HolodexChannelsEndpointOptions, HolodexGeneralQuery, HolodexLiveEndpointOptions, HolodexVideo } from "@/app/model/holodex";
import { isRefreshPossible, updateLastCheckedTime } from "./db";

const STREAMS_BUFFER_NAME = "streams";
const STREAMS_BUFFER_HOURS = 0.25;

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
 * @returns All upcoming and current live streams. `undefined` if checked too recently (within 15 minutes).
 */
export async function getLatestVideos(apiKey: string) {
    if (!await isRefreshPossible(STREAMS_BUFFER_NAME)) {
        return;
    }

    const data = await fetchData<HolodexVideo[]>(apiKey, "/live", {
        org: "Nijisanji",
        status: ["live", "upcoming"]
    } as HolodexLiveEndpointOptions);

    await updateLastCheckedTime(STREAMS_BUFFER_NAME, STREAMS_BUFFER_HOURS);
    return data ?? [];
}
