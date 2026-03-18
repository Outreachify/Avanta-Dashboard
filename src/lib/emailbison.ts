const BASE_URL = process.env.EMAILBISON_BASE_URL || "https://send.avantaagency.com";
const API_TOKEN = process.env.EMAILBISON_API_TOKEN || "";
const REQUEST_DELAY = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(method: string, path: string, body?: unknown) {
  await delay(REQUEST_DELAY);
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`EmailBison API error: ${res.status} ${res.statusText} - ${await res.text()}`);
  }
  return res.json();
}

export async function listWorkspaces() {
  const data = await apiRequest("GET", "/api/workspaces");
  return data.data || data;
}

export async function switchWorkspace(teamId: number) {
  return apiRequest("POST", "/api/workspaces/switch-workspace", { team_id: teamId });
}

export async function listCampaigns() {
  const data = await apiRequest("GET", "/api/campaigns");
  return data.data || data;
}

export async function getCampaignStats(campaignId: number, startDate: string, endDate: string) {
  const data = await apiRequest("POST", `/api/campaigns/${campaignId}/stats`, {
    start_date: startDate,
    end_date: endDate,
  });
  return data.data || data;
}

export interface ChartDataPoint {
  label: string;
  color: string;
  dates: [string, number][];
}

export async function getCampaignChartStats(
  campaignId: number,
  startDate: string,
  endDate: string
): Promise<ChartDataPoint[]> {
  const data = await apiRequest(
    "GET",
    `/api/campaigns/${campaignId}/line-area-chart-stats?start_date=${startDate}&end_date=${endDate}`
  );
  return data.data || data;
}

export async function getCampaignEventStats(
  startDate: string,
  endDate: string,
  campaignIds?: number[]
): Promise<ChartDataPoint[]> {
  let url = `/api/campaign-events/stats?start_date=${startDate}&end_date=${endDate}`;
  if (campaignIds && campaignIds.length > 0) {
    campaignIds.forEach((id) => {
      url += `&campaign_ids[]=${id}`;
    });
  }
  const data = await apiRequest("GET", url);
  return data.data || data;
}

// ---------------------------------------------------------------------------
// Workspace-scoped API functions (per-workspace token, no workspace switching)
// ---------------------------------------------------------------------------

async function wsApiRequest(method: string, path: string, token: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(`EmailBison API error: ${res.status} - ${await res.text()}`);
  }
  return res.json();
}

export async function wsListCampaigns(token: string) {
  const data = await wsApiRequest("GET", "/api/campaigns", token);
  return data.data || data;
}

export async function wsGetCampaignEventStats(
  token: string,
  startDate: string,
  endDate: string,
  campaignIds: number[]
): Promise<ChartDataPoint[]> {
  let url = `/api/campaign-events/stats?start_date=${startDate}&end_date=${endDate}`;
  for (const id of campaignIds) {
    url += `&campaign_ids[]=${id}`;
  }
  const data = await wsApiRequest("GET", url, token);
  return data.data || data;
}

export async function wsGetCampaignChartStats(
  token: string,
  campaignId: number,
  startDate: string,
  endDate: string
): Promise<ChartDataPoint[]> {
  const data = await wsApiRequest(
    "GET",
    `/api/campaigns/${campaignId}/line-area-chart-stats?start_date=${startDate}&end_date=${endDate}`,
    token
  );
  return data.data || data;
}

// Get all tags for a workspace, find "Meeting Request" tag ID
export async function wsGetMeetingRequestTagId(token: string): Promise<number | null> {
  const data = await wsApiRequest("GET", "/api/tags", token);
  const tags = data.data || data;
  const meetingTag = (tags as { id: number; name: string }[]).find(
    (t) => t.name === "Meeting Request"
  );
  return meetingTag?.id ?? null;
}

// Get meeting request count for a campaign using replies endpoint with tag filter
// Deduplicates by lead email — multiple replies from same lead = 1 meeting
export async function wsGetCampaignMeetingCount(
  token: string,
  campaignId: number,
  tagId: number
): Promise<number> {
  const uniqueEmails = new Set<string>();
  let page = 1;

  while (true) {
    const data = await wsApiRequest(
      "GET",
      `/api/replies?campaign_id=${campaignId}&tag_ids[]=${tagId}&page=${page}`,
      token
    );
    const replies = data.data || [];
    if (replies.length === 0) break;

    for (const reply of replies) {
      const email = reply.from_email_address;
      if (email) uniqueEmails.add(email.toLowerCase());
    }

    const lastPage = data.meta?.last_page ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  return uniqueEmails.size;
}

// Pivot chart data (label-based arrays) into row-per-date format
export function pivotChartData(
  chartData: ChartDataPoint[]
): Record<string, Record<string, number>> {
  const dateMap: Record<string, Record<string, number>> = {};

  const labelToField: Record<string, string> = {
    Sent: "emails_sent",
    Replied: "replied",
    "Total Opens": "total_opens",
    "Unique Opens": "unique_opens",
    Bounced: "bounced",
    Unsubscribed: "unsubscribed",
    Interested: "interested",
  };

  for (const series of chartData) {
    const field = labelToField[series.label];
    if (!field) continue;
    for (const [date, value] of series.dates) {
      if (!dateMap[date]) {
        dateMap[date] = {
          emails_sent: 0,
          replied: 0,
          total_opens: 0,
          unique_opens: 0,
          bounced: 0,
          unsubscribed: 0,
          interested: 0,
        };
      }
      dateMap[date][field] = value;
    }
  }

  return dateMap;
}
