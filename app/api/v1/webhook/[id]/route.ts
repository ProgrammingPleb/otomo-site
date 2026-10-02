import { VideoQueueEntry } from "@/app/utils/fetch";
import { processNewVideos, recordChannelSubscription, YOUTUBE_WEBSUB_SECRET } from "@/app/utils/subscribe";
import { createHmac, timingSafeEqual } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { after, NextRequest, NextResponse } from "next/server";

const parser = new XMLParser({
    isArray: (tagName, _) => tagName == "entry" || tagName == "at:deleted-entry" || tagName == "link",
    ignoreAttributes: false,
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const url = request.nextUrl.searchParams;
    const { id } = await params;

    if (
        url.get("hub.mode") === "subscribe" &&
        url.get("hub.topic") === `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${id}` &&
        await recordChannelSubscription(id)
    ) {
        return new NextResponse(url.get("hub.challenge"));
    }

    return new NextResponse(null, { status: 404 });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: channelId } = await params;

    const hmacHeader = request.headers.get("X-Hub-Signature");
    const body = await request.text();
    if (!hmacHeader || !verifySignature(body, hmacHeader)) {
        return new Response("Invalid data!");
    }

    const data = parser.parse(body);
    let valid = data.feed.link === undefined;
    if (data.feed.link) {
        for (const link of data.feed.link) {
            if (
                link["@_rel"] === "self" &&
                link["@_href"] === `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`
            ) {
                valid = true;
            }
        }
    }
    if (!valid) {
        return new Response();
    }

    const entries = data.feed.entry;
    const videoIds: VideoQueueEntry[] = [];
    if (entries) {
        for (const entry of entries) {
            const videoId = entry["yt:videoId"] as string | undefined;
            const videoLink = entry.link[0]["@_href"] as string | undefined;
            if (videoId && videoLink) {
                videoIds.push({ id: videoId, isShorts: videoLink.includes("/shorts/") });
            }
        }
    }
    const deletedEntries = data.feed["at:deleted-entry"];
    const deletedIds: string[] = [];
    if (deletedEntries) {
        for (const entry of deletedEntries) {
            const videoId = entry["@_ref"] as string | undefined;
            if (videoId) {
                deletedIds.push(videoId.replace("yt:video:", ""));
            }
        }
    }

    after(async () => {
        try {
            await processNewVideos(videoIds, deletedIds);
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Webhook - ${channelId}: Unable to process new data!`, e);
        }
    });

    return new Response();
}

function verifySignature(body: string, header: string) {
    const [algorithm, receivedHash] = header.split("=");
    if (algorithm != "sha1" || !receivedHash) {
        return false;
    }

    const expected = createHmac("sha1", YOUTUBE_WEBSUB_SECRET).update(body).digest();
    const actual = Buffer.from(receivedHash, "hex");

    return expected.length === actual.length && timingSafeEqual(expected, actual);
}