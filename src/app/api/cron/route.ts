import { NextRequest, NextResponse } from "next/server";
import { POST as syncCampaigns } from "@/app/api/sync/campaigns/route";
import { POST as syncMeetings } from "@/app/api/sync/meetings/route";

export const maxDuration = 300;

let isSyncing = false;

async function runSync(request: NextRequest) {
  if (isSyncing) {
    return NextResponse.json({ message: "Sync already in progress, skipping" }, { status: 200 });
  }

  isSyncing = true;
  const startTime = Date.now();
  console.log(`[sync] Started at ${new Date().toISOString()}`);

  try {
    const origin = new URL(request.url).origin;
    const campaignsReq = new NextRequest(`${origin}/api/sync/campaigns`, { method: "POST" });

    const [campaignsSettled, meetingsSettled] = await Promise.allSettled([
      syncCampaigns(campaignsReq).then((r) => r.json()),
      syncMeetings().then((r) => r.json()),
    ]);

    const c = campaignsSettled.status === "fulfilled" ? campaignsSettled.value : { error: String(campaignsSettled.reason) };
    const m = meetingsSettled.status === "fulfilled" ? meetingsSettled.value : { error: String(meetingsSettled.reason) };

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[sync] Done in ${duration}s — Campaigns: ${c.workspaces_processed ?? "err"}/${c.total_campaigns ?? 0} campaigns, ${c.workspaces_failed ?? "?"} failed — Meetings: ${m.workspaces_succeeded ?? "err"}/${m.workspaces_processed ?? 0} sheets, ${m.workspaces_failed ?? "?"} failed, ${m.total_dates_synced ?? 0} dates`);

    return NextResponse.json({ timestamp: new Date().toISOString(), duration_seconds: duration, campaigns: c, meetings: m });
  } catch (err) {
    console.log(`[sync] Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
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
