import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;

  console.log("[cron] Starting sync at", new Date().toISOString());

  try {
    const [campaignsRes, meetingsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/sync/campaigns`, { method: "POST" }).then((r) => r.json()),
      fetch(`${baseUrl}/api/sync/meetings`, { method: "POST" }).then((r) => r.json()),
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      campaigns: campaignsRes.status === "fulfilled" ? campaignsRes.value : { error: String(campaignsRes.reason) },
      meetings: meetingsRes.status === "fulfilled" ? meetingsRes.value : { error: String(meetingsRes.reason) },
    };

    console.log("[cron] Sync complete");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] Sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also support POST for n8n
export async function POST(request: NextRequest) {
  return GET(request);
}
