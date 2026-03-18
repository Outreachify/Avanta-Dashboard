import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const syncStartedAt = new Date().toISOString();

  // Forward any query params (workspace_id, start_date, end_date) to campaigns sync
  const queryString = new URL(request.url).search;

  const campaignsUrl = `${baseUrl}/api/sync/campaigns${queryString}`;
  const meetingsUrl = `${baseUrl}/api/sync/meetings`;

  // Run campaigns and meetings sync in parallel (they are independent)
  const [campaignsSettled, meetingsSettled] = await Promise.allSettled([
    fetch(campaignsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || `Campaigns sync failed with status ${res.status}`
        );
      }
      return json;
    }),
    fetch(meetingsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || `Meetings sync failed with status ${res.status}`
        );
      }
      return json;
    }),
  ]);

  const campaignsResult =
    campaignsSettled.status === "fulfilled"
      ? campaignsSettled.value
      : {
          error:
            campaignsSettled.reason instanceof Error
              ? campaignsSettled.reason.message
              : "Unknown error in campaigns sync",
        };

  const meetingsResult =
    meetingsSettled.status === "fulfilled"
      ? meetingsSettled.value
      : {
          error:
            meetingsSettled.reason instanceof Error
              ? meetingsSettled.reason.message
              : "Unknown error in meetings sync",
        };

  const syncFinishedAt = new Date().toISOString();

  return NextResponse.json({
    message: "Full sync complete",
    started_at: syncStartedAt,
    finished_at: syncFinishedAt,
    campaigns: campaignsResult,
    meetings: meetingsResult,
  });
}
