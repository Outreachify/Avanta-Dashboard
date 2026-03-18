import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { readMeetingsFromSheet } from "@/lib/google-sheets";

export const maxDuration = 300;

const BATCH_SIZE = 10;

interface WorkspaceRow {
  id: number;
  name: string;
  google_sheet_url: string;
}

interface WorkspaceResult {
  workspace_id: number;
  workspace_name: string;
  sheet_url: string | null;
  dates_synced: number;
  error?: string;
}

async function syncMeetings(ws: WorkspaceRow): Promise<WorkspaceResult> {
  const supabase = getServiceSupabase();
  const result: WorkspaceResult = {
    workspace_id: ws.id,
    workspace_name: ws.name,
    sheet_url: ws.google_sheet_url,
    dates_synced: 0,
  };

  const meetingsByDate = await readMeetingsFromSheet(ws.google_sheet_url);

  const rows = Object.entries(meetingsByDate).map(([date, count]) => ({
    workspace_id: ws.id,
    date,
    count,
  }));

  if (rows.length > 0) {
    // Upsert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error: upsertError } = await supabase
        .from("meetings_booked")
        .upsert(batch, {
          onConflict: "workspace_id,date",
        });

      if (upsertError) {
        throw new Error(
          `Failed to upsert meetings batch (rows ${i}-${i + batch.length}): ${upsertError.message}`
        );
      }
    }
    result.dates_synced = rows.length;
  }

  return result;
}

export async function POST() {
  const supabase = getServiceSupabase();
  const results: WorkspaceResult[] = [];
  const syncStartedAt = new Date().toISOString();

  // Fetch workspaces with google_sheet_url from Supabase
  const { data: workspacesWithSheets, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name, google_sheet_url")
    .not("google_sheet_url", "is", null)
    .range(0, 999);

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to fetch workspaces: ${wsError.message}` },
      { status: 500 }
    );
  }

  if (!workspacesWithSheets || workspacesWithSheets.length === 0) {
    return NextResponse.json({
      message: "Meetings sync complete",
      summary: "No workspaces with Google Sheet URLs found",
      workspaces_processed: 0,
      workspaces_succeeded: 0,
      workspaces_failed: 0,
      total_dates_synced: 0,
      results: [],
    });
  }

  // Process workspaces in parallel batches of BATCH_SIZE
  for (let i = 0; i < workspacesWithSheets.length; i += BATCH_SIZE) {
    const batch = workspacesWithSheets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((ws) => syncMeetings(ws as WorkspaceRow))
    );

    for (const settledResult of batchResults) {
      if (settledResult.status === "fulfilled") {
        results.push(settledResult.value);
      } else {
        const idx = batchResults.indexOf(settledResult);
        const failedWs = batch[idx];
        results.push({
          workspace_id: failedWs.id,
          workspace_name: failedWs.name,
          sheet_url: failedWs.google_sheet_url,
          dates_synced: 0,
          error:
            settledResult.reason instanceof Error
              ? settledResult.reason.message
              : "Unknown error occurred",
        });
      }
    }
  }

  // Build summary
  const syncFinishedAt = new Date().toISOString();
  const totalDatesSynced = results.reduce((s, r) => s + r.dates_synced, 0);
  const successfulWorkspaces = results.filter((r) => !r.error);
  const failedWorkspaces = results.filter((r) => r.error);

  const summaryMessage =
    failedWorkspaces.length > 0
      ? `${successfulWorkspaces.length} succeeded, ${failedWorkspaces.length} failed: ${failedWorkspaces.map((r) => `"${r.workspace_name}" (id=${r.workspace_id}): ${r.error}`).join("; ")}`
      : `All ${successfulWorkspaces.length} workspaces synced successfully`;


  // Log to sync_log
  await supabase.from("sync_log").insert({
    sync_type: "meetings",
    status:
      failedWorkspaces.length === results.length
        ? "failed"
        : failedWorkspaces.length > 0
          ? "partial"
          : "completed",
    records_synced: totalDatesSynced,
    error_message:
      failedWorkspaces.length > 0
        ? `${failedWorkspaces.length}/${results.length} workspaces failed: ${failedWorkspaces.map((r) => `"${r.workspace_name}"`).join(", ")}`
        : null,
    started_at: syncStartedAt,
    completed_at: syncFinishedAt,
  });

  return NextResponse.json({
    message: "Meetings sync complete",
    summary: summaryMessage,
    workspaces_processed: results.length,
    workspaces_succeeded: successfulWorkspaces.length,
    workspaces_failed: failedWorkspaces.length,
    total_dates_synced: totalDatesSynced,
    results,
  });
}
