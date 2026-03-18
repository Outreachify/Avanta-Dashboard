import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  console.log("[cron] Starting hourly sync at", new Date().toISOString());

  try {
    // Run campaigns and meetings sync in parallel
    const [campaignsRes, meetingsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/sync/campaigns`, { method: "POST" }).then((r) => r.json()),
      fetch(`${baseUrl}/api/sync/meetings`, { method: "POST" }).then((r) => r.json()),
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      campaigns: campaignsRes.status === "fulfilled" ? campaignsRes.value : { error: String(campaignsRes.reason) },
      meetings: meetingsRes.status === "fulfilled" ? meetingsRes.value : { error: String(meetingsRes.reason) },
    };

    console.log("[cron] Sync complete:", JSON.stringify({
      campaigns: result.campaigns.workspaces_processed ?? "error",
      meetings: result.meetings.workspaces_processed ?? "error",
    }));

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] Sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
