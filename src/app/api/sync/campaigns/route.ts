import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import {
  wsListCampaigns,
  wsGetCampaignEventStats,
  wsGetCampaignChartStats,
  wsGetMeetingRequestTagId,
  wsGetCampaignMeetingCount,
  pivotChartData,
} from "@/lib/emailbison";

export const maxDuration = 300;

const BATCH_SIZE = 10;

interface WorkspaceRow {
  id: number;
  name: string;
  api_token: string;
}

interface WorkspaceResult {
  workspace_id: number;
  workspace_name: string;
  campaigns_synced: number;
  daily_stats_rows: number;
  campaign_daily_stats_rows: number;
  meeting_counts_synced: number;
  skipped?: string;
  error?: string;
}

async function syncWorkspace(
  ws: WorkspaceRow,
  startDate: string,
  endDate: string
): Promise<WorkspaceResult> {
  const supabase = getServiceSupabase();
  const result: WorkspaceResult = {
    workspace_id: ws.id,
    workspace_name: ws.name,
    campaigns_synced: 0,
    daily_stats_rows: 0,
    campaign_daily_stats_rows: 0,
    meeting_counts_synced: 0,
  };

  // 1. List campaigns using workspace token
  const campaigns = await wsListCampaigns(ws.api_token);

  if (!campaigns || campaigns.length === 0) {
    return result;
  }

  // 2. Upsert campaigns into campaigns table (batch of 500)
  const campaignRows = campaigns.map(
    (c: { id: number; name: string; status: string; created_at: string }) => ({
      id: c.id,
      workspace_id: ws.id,
      name: c.name,
      status: c.status,
      created_at: c.created_at,
    })
  );

  for (let i = 0; i < campaignRows.length; i += 500) {
    const batch = campaignRows.slice(i, i + 500);
    const { error: campaignError } = await supabase
      .from("campaigns")
      .upsert(batch, { onConflict: "id" });

    if (campaignError) {
      throw new Error(`Failed to upsert campaigns: ${campaignError.message}`);
    }
  }

  result.campaigns_synced = campaignRows.length;

  // 3. Workspace-level daily stats via campaign-events/stats
  const campaignIds = campaigns.map((c: { id: number }) => c.id);
  const chartData = await wsGetCampaignEventStats(
    ws.api_token,
    startDate,
    endDate,
    campaignIds
  );

  if (chartData && chartData.length > 0) {
    const pivoted = pivotChartData(chartData);

    const dailyRows = Object.entries(pivoted).map(([date, metrics]) => ({
      workspace_id: ws.id,
      date,
      emails_sent: metrics.emails_sent || 0,
      replied: metrics.replied || 0,
      total_opens: metrics.total_opens || 0,
      unique_opens: metrics.unique_opens || 0,
      bounced: metrics.bounced || 0,
      unsubscribed: metrics.unsubscribed || 0,
      interested: metrics.interested || 0,
    }));

    if (dailyRows.length > 0) {
      for (let i = 0; i < dailyRows.length; i += 500) {
        const batch = dailyRows.slice(i, i + 500);
        const { error: wsStatsError } = await supabase
          .from("workspace_daily_stats")
          .upsert(batch, { onConflict: "workspace_id,date" });

        if (wsStatsError) {
          throw new Error(
            `Failed to upsert workspace daily stats: ${wsStatsError.message}`
          );
        }
      }
      result.daily_stats_rows = dailyRows.length;
    }
  }

  // 4. Per-campaign daily stats via line-area-chart-stats
  const allCampaignDailyRows: {
    campaign_id: number;
    workspace_id: number;
    date: string;
    emails_sent: number;
    replied: number;
    total_opens: number;
    unique_opens: number;
    bounced: number;
    unsubscribed: number;
    interested: number;
  }[] = [];

  // Fetch per-campaign stats in parallel batches of 10
  for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
    const campaignBatch = campaignIds.slice(i, i + BATCH_SIZE);
    const campaignResults = await Promise.allSettled(
      campaignBatch.map(async (campaignId: number) => {
        const campChart = await wsGetCampaignChartStats(
          ws.api_token,
          campaignId,
          startDate,
          endDate
        );
        return { campaignId, campChart };
      })
    );

    for (const settledResult of campaignResults) {
      if (settledResult.status === "fulfilled") {
        const { campaignId, campChart } = settledResult.value;
        if (campChart && campChart.length > 0) {
          const pivoted = pivotChartData(campChart);
          for (const [date, metrics] of Object.entries(pivoted)) {
            allCampaignDailyRows.push({
              campaign_id: campaignId,
              workspace_id: ws.id,
              date,
              emails_sent: metrics.emails_sent || 0,
              replied: metrics.replied || 0,
              total_opens: metrics.total_opens || 0,
              unique_opens: metrics.unique_opens || 0,
              bounced: metrics.bounced || 0,
              unsubscribed: metrics.unsubscribed || 0,
              interested: metrics.interested || 0,
            });
          }
        }
      } else {
        // campaign chart stats fetch failed silently
      }
    }
  }

  // Upsert campaign_daily_stats in batches of 500
  if (allCampaignDailyRows.length > 0) {
    for (let i = 0; i < allCampaignDailyRows.length; i += 500) {
      const batch = allCampaignDailyRows.slice(i, i + 500);
      const { error: campStatsError } = await supabase
        .from("campaign_daily_stats")
        .upsert(batch, { onConflict: "campaign_id,date" });

      if (campStatsError) {
        throw new Error(
          `Failed to upsert campaign daily stats: ${campStatsError.message}`
        );
      }
    }
    result.campaign_daily_stats_rows = allCampaignDailyRows.length;
  }

  // 5. Fetch meeting request counts per campaign via tags + replies
  try {
    const meetingTagId = await wsGetMeetingRequestTagId(ws.api_token);
    if (meetingTagId) {
      // Fetch meeting counts for all campaigns in parallel batches
      for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
        const batch = campaignIds.slice(i, i + BATCH_SIZE);
        const meetingResults = await Promise.allSettled(
          batch.map(async (cId: number) => {
            const count = await wsGetCampaignMeetingCount(ws.api_token, cId, meetingTagId);
            return { campaignId: cId, count };
          })
        );

        for (const settled of meetingResults) {
          if (settled.status === "fulfilled" && settled.value.count > 0) {
            await supabase
              .from("campaigns")
              .update({ meeting_requests: settled.value.count })
              .eq("id", settled.value.campaignId);
            result.meeting_counts_synced++;
          }
        }
      }
    }
  } catch {
    // meeting count sync failed silently
  }

  return result;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);

  const workspaceIdParam = searchParams.get("workspace_id");
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  // Default date range: last 90 days
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const startDate =
    startDateParam || ninetyDaysAgo.toISOString().split("T")[0];
  const endDate = endDateParam || now.toISOString().split("T")[0];

  // Fetch workspaces with api_tokens from Supabase
  let query = supabase
    .from("workspaces")
    .select("id, name, api_token")
    .not("api_token", "is", null)
    .range(0, 999);

  if (workspaceIdParam) {
    query = query.eq("id", parseInt(workspaceIdParam, 10));
  }

  const { data: workspaces, error: wsError } = await query;

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to fetch workspaces: ${wsError.message}` },
      { status: 500 }
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json(
      {
        error: workspaceIdParam
          ? `Workspace ${workspaceIdParam} not found or has no api_token`
          : "No workspaces with api_tokens found",
      },
      { status: 404 }
    );
  }

  const results: WorkspaceResult[] = [];
  const syncStartedAt = new Date().toISOString();

  // Process workspaces in parallel batches of BATCH_SIZE
  for (let i = 0; i < workspaces.length; i += BATCH_SIZE) {
    const batch = workspaces.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (ws) => {
        if (!ws.api_token) {
          return {
            workspace_id: ws.id,
            workspace_name: ws.name,
            campaigns_synced: 0,
            daily_stats_rows: 0,
            campaign_daily_stats_rows: 0,
            meeting_counts_synced: 0,
            skipped: "No api_token configured",
          } as WorkspaceResult;
        }
        return syncWorkspace(
          ws as WorkspaceRow,
          startDate,
          endDate
        );
      })
    );

    for (const settledResult of batchResults) {
      if (settledResult.status === "fulfilled") {
        results.push(settledResult.value);
      } else {
        // Find the workspace that failed from the batch
        const idx = batchResults.indexOf(settledResult);
        const failedWs = batch[idx];
        results.push({
          workspace_id: failedWs.id,
          workspace_name: failedWs.name,
          campaigns_synced: 0,
          daily_stats_rows: 0,
          campaign_daily_stats_rows: 0,
          meeting_counts_synced: 0,
          error:
            settledResult.reason instanceof Error
              ? settledResult.reason.message
              : "Unknown error occurred",
        });
      }
    }
  }

  // Log to sync_log
  const syncFinishedAt = new Date().toISOString();
  const totalCampaigns = results.reduce((s, r) => s + r.campaigns_synced, 0);
  const totalDailyRows = results.reduce((s, r) => s + r.daily_stats_rows, 0);
  const totalCampaignDailyRows = results.reduce(
    (s, r) => s + r.campaign_daily_stats_rows,
    0
  );
  const failedWorkspaces = results.filter((r) => r.error).length;
  const skippedWorkspaces = results.filter((r) => r.skipped).length;

  await supabase.from("sync_log").insert({
    sync_type: "campaigns",
    status:
      failedWorkspaces === results.length
        ? "failed"
        : failedWorkspaces > 0
          ? "partial"
          : "completed",
    records_synced: totalCampaigns + totalDailyRows + totalCampaignDailyRows,
    error_message:
      failedWorkspaces > 0
        ? `${failedWorkspaces} workspaces failed`
        : null,
    started_at: syncStartedAt,
    completed_at: syncFinishedAt,
  });

  return NextResponse.json({
    message: "Campaign sync complete",
    start_date: startDate,
    end_date: endDate,
    workspaces_processed: results.length,
    workspaces_failed: failedWorkspaces,
    workspaces_skipped: skippedWorkspaces,
    total_campaigns: totalCampaigns,
    total_daily_stat_rows: totalDailyRows,
    total_campaign_daily_stat_rows: totalCampaignDailyRows,
    results,
  });
}
