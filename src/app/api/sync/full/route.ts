import { NextRequest, NextResponse } from "next/server";
import { POST as syncCampaigns } from "@/app/api/sync/campaigns/route";
import { POST as syncMeetings } from "@/app/api/sync/meetings/route";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const syncStartedAt = new Date().toISOString();
  const origin = new URL(request.url).origin;
  const queryString = new URL(request.url).search;

  // Create request for campaigns sync (forward query params)
  const campaignsReq = new NextRequest(`${origin}/api/sync/campaigns${queryString}`, { method: "POST" });

  // Call sync handlers directly (no HTTP self-call)
  const [campaignsSettled, meetingsSettled] = await Promise.allSettled([
    syncCampaigns(campaignsReq).then((r) => r.json()),
    syncMeetings().then((r) => r.json()),
  ]);

  const campaignsResult = campaignsSettled.status === "fulfilled"
    ? campaignsSettled.value
    : { error: campaignsSettled.reason instanceof Error ? campaignsSettled.reason.message : "Unknown error" };

  const meetingsResult = meetingsSettled.status === "fulfilled"
    ? meetingsSettled.value
    : { error: meetingsSettled.reason instanceof Error ? meetingsSettled.reason.message : "Unknown error" };

  return NextResponse.json({
    message: "Full sync complete",
    started_at: syncStartedAt,
    finished_at: new Date().toISOString(),
    campaigns: campaignsResult,
    meetings: meetingsResult,
  });
}
