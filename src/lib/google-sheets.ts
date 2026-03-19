import { google } from "googleapis";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function extractGid(url: string): number | null {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export interface MeetingsByDate {
  [date: string]: number; // ISO date string -> count
}

/**
 * Given a spreadsheet ID and a gid, fetch the spreadsheet metadata
 * and return the sheet title (tab name) that matches the gid.
 * Returns null if gid is 0 or not found (caller should use default).
 */
async function getSheetNameByGid(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  gid: number
): Promise<string | null> {
  // gid=0 is always the first sheet — no need to look it up
  if (gid === 0) return null;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const sheetsList = meta.data.sheets;
  if (!sheetsList) return null;

  for (const s of sheetsList) {
    if (s.properties?.sheetId === gid) {
      return s.properties.title ?? null;
    }
  }

  // If gid not found in metadata, return null so caller uses default
  console.warn(
    `Sheet gid=${gid} not found in spreadsheet ${spreadsheetId}. Falling back to default sheet.`
  );
  return null;
}

export async function readMeetingsFromSheet(sheetUrl: string): Promise<MeetingsByDate> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error(`Invalid Google Sheet URL: ${sheetUrl}`);
  }

  const gid = extractGid(sheetUrl);
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Resolve the sheet tab name from gid if present
  let sheetName: string | null = null;
  if (gid !== null && gid !== 0) {
    sheetName = await getSheetNameByGid(sheets, spreadsheetId, gid);
  }

  // Build the range — prefix with sheet name if we found one
  const range = sheetName ? `'${sheetName}'!A:B` : "A:B";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return {};
  }

  const meetingsByDate: MeetingsByDate = {};

  // Detect whether row 0 is a header.
  // If the first cell of row 0 parses as a valid date, treat it as data.
  // Otherwise skip it as a header.
  const firstCellValue = rows[0]?.[0];
  const startIndex = firstCellValue && parseDate(String(firstCellValue)) ? 0 : 1;

  if (rows.length <= startIndex) {
    return {};
  }

  for (let i = startIndex; i < rows.length; i++) {
    const rawDate = rows[i]?.[0];
    if (!rawDate) continue;

    const parsed = parseDate(String(rawDate));
    if (!parsed) continue;

    meetingsByDate[parsed] = (meetingsByDate[parsed] || 0) + 1;
  }

  return meetingsByDate;
}

// Google Sheets epoch: December 30, 1899
// (Sheets has a Lotus 1-2-3 bug where it treats 1900 as a leap year,
//  so the epoch is effectively Dec 30, 1899)
const SHEETS_EPOCH = new Date(1899, 11, 30); // month is 0-indexed

function parseDate(dateStr: string): string | null {
  try {
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    // 1) Google Sheets serial date number (pure numeric value)
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const serial = parseFloat(trimmed);
      // Sanity check: serial dates for reasonable years (2000-2100) are ~36526-73050
      // Be generous: anything between 1 and 200000
      if (serial >= 1 && serial <= 200000) {
        // Use UTC to avoid timezone shifts
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split("T")[0];
        }
      }
    }

    // 2) M/D/YYYY or MM/DD/YYYY
    const slashParts = trimmed.split("/");
    if (slashParts.length === 3) {
      const month = parseInt(slashParts[0], 10);
      const day = parseInt(slashParts[1], 10);
      const year = parseInt(slashParts[2], 10);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year) && year > 1900) {
        // Use string formatting to avoid timezone issues
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // 3) YYYY-MM-DD (ISO format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }

    // 4) D-MMM-YYYY or DD-MMM-YYYY (e.g., 6-Jan-2026 or 06-Jan-2026)
    const dmmmy = trimmed.match(/^(\d{1,2})[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s](\d{4})$/i);
    if (dmmmy) {
      const d = new Date(`${dmmmy[2]} ${dmmmy[1]}, ${dmmmy[3]}`);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }

    // 5) MMM D, YYYY or MMMM D, YYYY (e.g., Jan 6, 2026 or January 6, 2026)
    const mdy = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (mdy) {
      const d = new Date(`${mdy[1]} ${mdy[2]}, ${mdy[3]}`);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }

    // 6) Fallback: let Date constructor try
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) {
      return fallback.toISOString().split("T")[0];
    }

    return null;
  } catch {
    return null;
  }
}
