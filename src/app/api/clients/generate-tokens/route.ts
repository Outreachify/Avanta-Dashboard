import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const maxDuration = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const apiToken = process.env.EMAILBISON_API_TOKEN;
    const baseUrl = process.env.EMAILBISON_BASE_URL || "https://send.avantaagency.com";

    if (!apiToken) {
      return NextResponse.json(
        { error: "EMAILBISON_API_TOKEN environment variable is not set" },
        { status: 500 }
      );
    }

    const workspaceIdParam = new URL(request.url).searchParams.get("workspace_id");

    let query = supabase.from("workspaces").select("*");

    if (workspaceIdParam) {
      query = query.eq("id", Number(workspaceIdParam));
    } else {
      query = query.is("api_token", null);
    }

    const { data: workspaces, error } = await query.order("name").range(0, 999);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only those without tokens (in case workspace_id was specified but already has a token)
    const toProcess = (workspaces ?? []).filter((ws) => !ws.api_token);

    if (toProcess.length === 0) {
      return NextResponse.json({
        message: "No workspaces need token generation",
        generated: 0,
        failed: 0,
        details: [],
      });
    }

    const results: { workspace_id: number; name: string; success: boolean; error?: string }[] = [];
    let generated = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const ws = toProcess[i];

      if (i > 0) {
        await delay(300);
      }

      try {
        const teamId = ws.team_id ?? ws.id;
        const res = await fetch(
          `${baseUrl}/api/workspaces/v1.1/${teamId}/api-tokens`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiToken}`,
            },
            body: JSON.stringify({ name: "dashboard-api" }),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const json = await res.json();
        const plainTextToken = json.data?.plain_text_token;

        if (!plainTextToken) {
          throw new Error("No plain_text_token in response");
        }

        const { error: updateError } = await supabase
          .from("workspaces")
          .update({ api_token: plainTextToken })
          .eq("id", ws.id);

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        generated++;
        results.push({ workspace_id: ws.id, name: ws.name, success: true });
      } catch (err) {
        failed++;
        results.push({
          workspace_id: ws.id,
          name: ws.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Token generation complete. Generated: ${generated}, Failed: ${failed}`,
      generated,
      failed,
      details: results,
    });
  } catch (err) {
    console.error("POST /api/clients/generate-tokens error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
