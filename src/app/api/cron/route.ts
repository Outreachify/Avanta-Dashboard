import { NextRequest, NextResponse } from "next/server";
import { POST as syncCampaigns } from "@/app/api/sync/campaigns/route";
import { POST as syncMeetings } from "@/app/api/sync/meetings/route";

export const maxDuration = 300;

async function runSync(request: NextRequest) {
  console.log("[cron] Starting sync at", new Date().toISOString());

  try {
    // Create mock requests for the sync handlers
    const origin = new URL(request.url).origin;
    const campaignsReq = new NextRequest(`${origin}/api/sync/campaigns`, { method: "POST" });
    const meetingsReq = new NextRequest(`${origin}/api/sync/meetings`, { method: "POST" });

    // Call sync handlers directly (no HTTP self-call)
    const [campaignsSettled, meetingsSettled] = await Promise.allSettled([
      syncCampaigns(campaignsReq).then((r) => r.json()),
      syncMeetings().then((r) => r.json()),
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      campaigns: campaignsSettled.status === "fulfilled" ? campaignsSettled.value : { error: String(campaignsSettled.reason) },
      meetings: meetingsSettled.status === "fulfilled" ? meetingsSettled.value : { error: String(meetingsSettled.reason) },
    };

    console.log("[cron] Sync complete");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] Sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runSync(request);
}

export async function POST(request: NextRequest) {
  return runSync(request);
}
