import firebaseConfig from '../../firebase-applet-config.json';
import {
  ALL_SHEET_TABS,
  headerMatchesTab,
  parseTabsToPlanner,
  serializePlannerToTabs,
  SHEET_HEADERS,
} from '../domain/sheetCodec';
import { PlannerState, SheetTabName } from '../domain/types';

export interface SpreadsheetSummary {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTabs: string[];
}

export class SheetsApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Google Sheets request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string; status?: string } };
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    if (res.status === 401) {
      throw new SheetsApiError(
        'Your Google session expired. Please sign in again to continue syncing.',
        401,
        'TOKEN_EXPIRED'
      );
    }
    if (res.status === 403) {
      throw new SheetsApiError(
        'Permission denied. Select this spreadsheet using Google Picker (or create it in the app) and make sure you have edit access.',
        403,
        'PERMISSION_DENIED'
      );
    }
    if (res.status === 404) {
      throw new SheetsApiError(
        'Spreadsheet not found or not yet granted access. Choose it via Google Picker to grant per-file access.',
        404,
        'NOT_FOUND'
      );
    }
    throw new SheetsApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export async function createPlannerSpreadsheet(
  accessToken: string,
  eventName: string,
  initialState: PlannerState
): Promise<{ spreadsheetId: string; title: string; spreadsheetUrl: string }> {
  const safeTitle = eventName.trim() || 'Family Sleeping Arrangements';
  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: safeTitle,
      },
      sheets: ALL_SHEET_TABS.map((tabName) => ({
        properties: {
          title: tabName,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      })),
    }),
  });

  await writePlannerToSpreadsheet(accessToken, created.spreadsheetId, {
    ...initialState,
    eventName: safeTitle,
  });

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title ?? safeTitle,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
  };
}

export async function inspectSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetSummary> {
  const meta = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title`,
    accessToken
  );

  return {
    spreadsheetId: meta.spreadsheetId,
    title: meta.properties?.title ?? 'Untitled Spreadsheet',
    spreadsheetUrl:
      meta.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetTabs: (meta.sheets ?? []).map((s) => s.properties.title),
  };
}

export async function ensurePlannerTabsExist(
  accessToken: string,
  spreadsheetId: string,
  existingTabs: string[]
): Promise<string[]> {
  const existingSet = new Set(existingTabs);
  const missingTabs = ALL_SHEET_TABS.filter((t) => !existingSet.has(t));

  if (missingTabs.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((tabName) => ({
            addSheet: {
              properties: {
                title: tabName,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
            },
          })),
        }),
      }
    );

    // Initialize headers on newly added tabs
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: missingTabs.map((tabName) => ({
            range: `${tabName}!A1`,
            values: [SHEET_HEADERS[tabName]],
          })),
        }),
      }
    );
  }

  return missingTabs;
}

export async function loadPlannerFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  summary: SpreadsheetSummary;
  state: PlannerState;
  initializedMissingTabs: string[];
}> {
  const summary = await inspectSpreadsheet(accessToken, spreadsheetId);
  const initializedMissingTabs = await ensurePlannerTabsExist(
    accessToken,
    spreadsheetId,
    summary.sheetTabs
  );

  const rangesQuery = ALL_SHEET_TABS.map(
    (tab) => `ranges=${encodeURIComponent(`${tab}!A1:Z2000`)}`
  ).join('&');

  const batchData = await sheetsFetch<{
    valueRanges?: Array<{ range: string; values?: unknown[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}`,
    accessToken
  );

  const tabValues: Partial<Record<SheetTabName, unknown[][]>> = {};
  (batchData.valueRanges ?? []).forEach((vr, index) => {
    const tabName = ALL_SHEET_TABS[index];
    if (tabName) {
      tabValues[tabName] = vr.values ?? [];
    }
  });

  const state = parseTabsToPlanner(tabValues, summary.title);
  return { summary, state, initializedMissingTabs };
}

export async function writePlannerToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  state: PlannerState
): Promise<void> {
  const summary = await inspectSpreadsheet(accessToken, spreadsheetId);
  await ensurePlannerTabsExist(accessToken, spreadsheetId, summary.sheetTabs);

  const serialized = serializePlannerToTabs(state);

  // Clear existing ranges first so deleted rows don't leave stale data behind
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: ALL_SHEET_TABS.map((tab) => `${tab}!A1:Z2000`),
      }),
    }
  );

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: ALL_SHEET_TABS.map((tab) => ({
          range: `${tab}!A1`,
          values: serialized[tab],
        })),
      }),
    }
  );
}

export interface PublicSheetLoadResult {
  spreadsheetId: string;
  state: PlannerState;
}

interface GoogleApiErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{ reason?: string }>;
  };
}

function getPublicSheetsApiKey(): string {
  const envKey = (
    import.meta.env.VITE_GOOGLE_SHEETS_API_KEY as string | undefined
  )?.trim();
  return envKey || firebaseConfig.apiKey || '';
}

async function publicSheetsFetch<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch {
    throw new SheetsApiError(
      'Unable to reach Google Sheets right now. Please try again shortly.',
      500,
      'FETCH_ERROR'
    );
  }

  if (!res.ok) {
    let errBody: GoogleApiErrorBody | null = null;
    try {
      errBody = (await res.json()) as GoogleApiErrorBody;
    } catch {
      // ignore json parse failure
    }

    const message = errBody?.error?.message || '';
    const reasons = (errBody?.error?.details ?? [])
      .map((d) => d.reason || '')
      .filter(Boolean);

    if (res.status === 401 || res.status === 403) {
      const isKeyOrConfigError =
        reasons.some(
          (r) =>
            r === 'API_KEY_INVALID' ||
            r === 'API_KEY_HTTP_REFERRER_BLOCKED' ||
            r === 'SERVICE_DISABLED'
        ) ||
        /api key|referer|referrer|has not been used|is disabled/i.test(message);

      if (isKeyOrConfigError) {
        throw new SheetsApiError(
          `Google Sheets API access blocked (${
            message || 'API key or project restriction'
          }). Ensure the Google Sheets API is enabled and this domain is allowed on the browser API key.`,
          403,
          'API_KEY_OR_CONFIG_ERROR'
        );
      }

      throw new SheetsApiError(
        'This Google Spreadsheet is private. Ask the organizer to set Drive sharing to "Anyone with the link" (Viewer) for login-free access.',
        403,
        'PRIVATE_OR_RESTRICTED'
      );
    }

    if (res.status === 404) {
      throw new SheetsApiError(
        'Spreadsheet not found. Check that the link is valid.',
        404,
        'NOT_FOUND'
      );
    }

    throw new SheetsApiError(
      message || 'Unable to reach Google Sheets right now. Please try again shortly.',
      res.status,
      'FETCH_ERROR'
    );
  }

  return (await res.json()) as T;
}

export async function loadPublicReadOnlyPlanner(
  spreadsheetId: string
): Promise<PublicSheetLoadResult> {
  const safeId = spreadsheetId.trim();
  if (!/^[a-zA-Z0-9-_]{15,120}$/.test(safeId)) {
    throw new SheetsApiError('Invalid Google Spreadsheet ID.', 400, 'INVALID_ID');
  }

  const apiKey = getPublicSheetsApiKey();
  if (!apiKey) {
    throw new SheetsApiError(
      'Missing Google API key for read-only Sheets access.',
      500,
      'MISSING_API_KEY'
    );
  }

  const meta = await publicSheetsFetch<{
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      safeId
    )}?fields=spreadsheetId,properties.title,sheets.properties.title&key=${encodeURIComponent(
      apiKey
    )}`
  );

  const existingSheetTitles = new Set(
    (meta.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t))
  );

  const tabsToFetch = ALL_SHEET_TABS.filter((tab) =>
    existingSheetTitles.has(tab)
  );

  if (tabsToFetch.length === 0) {
    throw new SheetsApiError(
      'This public spreadsheet does not contain Hearth & Bunk planning tabs yet. The organizer needs to save their plan to this sheet first.',
      422,
      'UNRECOGNIZED_FORMAT'
    );
  }

  const rangesQuery = tabsToFetch
    .map((tab) => `ranges=${encodeURIComponent(`${tab}!A1:Z2000`)}`)
    .join('&');

  const batchData = await publicSheetsFetch<{
    valueRanges?: Array<{ range: string; values?: unknown[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      safeId
    )}/values:batchGet?${rangesQuery}&key=${encodeURIComponent(apiKey)}`
  );

  const tabValues: Partial<Record<SheetTabName, unknown[][]>> = {};
  let matchedCount = 0;

  (batchData.valueRanges ?? []).forEach((vr, index) => {
    const tabName = tabsToFetch[index];
    if (!tabName) return;
    const rows = vr.values ?? [];
    if (rows.length > 0 && headerMatchesTab(rows[0], tabName)) {
      tabValues[tabName] = rows;
      matchedCount += 1;
    }
  });

  if (matchedCount === 0) {
    throw new SheetsApiError(
      'This public spreadsheet does not contain Hearth & Bunk planning tabs yet. The organizer needs to save their plan to this sheet first.',
      422,
      'UNRECOGNIZED_FORMAT'
    );
  }

  const state = parseTabsToPlanner(
    tabValues,
    meta.properties?.title || 'Shared Family Event'
  );

  return {
    spreadsheetId: safeId,
    state,
  };
}
