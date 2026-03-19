import { NextRequest, NextResponse } from "next/server";
import { POST as syncCampaigns } from "@/app/api/sync/campaigns/route";
import { POST as syncMeetings } from "@/app/api/sync/meetings/route";

export const maxDuration = 300;

// Prevent concurrent sync runs
let isSyncing = false;

async function runSync(request: NextRequest) {
  if (isSyncing) {
    return NextResponse.json({ message: "Sync already in progress, skipping" }, { status: 200 });
  }

  isSyncing = true;

  try {
    const origin = new URL(request.url).origin;
    const campaignsReq = new NextRequest(`${origin}/api/sync/campaigns`, { method: "POST" });

    const [campaignsSettled, meetingsSettled] = await Promise.allSettled([
      syncCampaigns(campaignsReq).then((r) => r.json()),
      syncMeetings().then((r) => r.json()),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      campaigns: campaignsSettled.status === "fulfilled" ? campaignsSettled.value : { error: String(campaignsSettled.reason) },
      meetings: meetingsSettled.status === "fulfilled" ? meetingsSettled.value : { error: String(meetingsSettled.reason) },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  } finally {
    isSyncing = false;
  }
}

export async function GET(request: NextRequest) {
  return runSync(request);
}

export async function POST(request: NextRequest) {
  return runSync(request);
}
