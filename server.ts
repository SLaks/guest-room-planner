import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_SHEET_TABS,
  headerMatchesTab,
  parseGvizJsonPayload,
} from './src/domain/sheetCodec.ts';
import type { SheetTabName } from './src/domain/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function fetchPublicTab(
  spreadsheetId: string,
  tabName: SheetTabName
): Promise<{
  status: 'ok' | 'private' | 'not_found' | 'mismatch' | 'error';
  rows?: unknown[][];
}> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tabName)}`;

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'HearthAndBunk/1.0',
    },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    if (
      location.includes('accounts.google.com') ||
      location.includes('ServiceLogin')
    ) {
      return { status: 'private' };
    }
    return { status: 'private' };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'private' };
  }

  if (response.status === 404) {
    return { status: 'not_found' };
  }

  if (!response.ok) {
    return { status: 'error' };
  }

  const rawText = await response.text();
  if (
    rawText.includes('accounts.google.com') ||
    rawText.trimStart().startsWith('<!DOCTYPE') ||
    rawText.trimStart().startsWith('<html')
  ) {
    return { status: 'private' };
  }

  const rows = parseGvizJsonPayload(rawText);
  if (!rows) {
    return { status: 'error' };
  }

  // Verify the fetched tab actually matches expected columns for this tab
  if (rows.length > 0 && !headerMatchesTab(rows[0], tabName)) {
    return { status: 'mismatch' };
  }

  return { status: 'ok', rows };
}

async function fetchPublicSheetTitle(spreadsheetId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
        spreadsheetId
      )}/htmlview`,
      { redirect: 'manual' }
    );
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title>([^<]+)<\/title>/i);
    if (!match?.[1]) return null;
    return match[1].replace(/\s*-\s*Google Sheets\s*$/i, '').trim() || null;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Read-only public Google Spreadsheet proxy (no user OAuth required)
  app.get('/api/public-sheet/:spreadsheetId', async (req, res) => {
    const spreadsheetId = String(req.params.spreadsheetId || '').trim();
    if (!/^[a-zA-Z0-9-_]{15,120}$/.test(spreadsheetId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        error: 'Invalid Google Spreadsheet ID.',
      });
      return;
    }

    try {
      // Probe EventMeta & Families first to verify public read access
      const tabResults = await Promise.all(
        ALL_SHEET_TABS.map(async (tabName) => ({
          tabName,
          result: await fetchPublicTab(spreadsheetId, tabName),
        }))
      );

      if (tabResults.some((t) => t.result.status === 'private')) {
        res.status(403).json({
          code: 'PRIVATE_OR_RESTRICTED',
          error:
            'This Google Spreadsheet is private. Ask the organizer to set Drive sharing to "Anyone with the link" (Viewer) for login-free access.',
        });
        return;
      }

      if (tabResults.every((t) => t.result.status === 'not_found')) {
        res.status(404).json({
          code: 'NOT_FOUND',
          error: 'Spreadsheet not found. Check that the link is valid.',
        });
        return;
      }

      const tabs: Partial<Record<SheetTabName, unknown[][]>> = {};
      let matchedCount = 0;

      for (const { tabName, result } of tabResults) {
        if (result.status === 'ok' && result.rows) {
          tabs[tabName] = result.rows;
          matchedCount += 1;
        }
      }

      if (matchedCount === 0) {
        res.status(422).json({
          code: 'UNRECOGNIZED_FORMAT',
          error:
            'This public spreadsheet does not contain Hearth & Bunk planning tabs yet. The organizer needs to save their plan to this sheet first.',
        });
        return;
      }

      const title = await fetchPublicSheetTitle(spreadsheetId);

      res.json({
        spreadsheetId,
        title: title || 'Shared Family Event',
        tabs,
      });
    } catch (err) {
      console.error('Failed to read public spreadsheet:', err);
      res.status(500).json({
        code: 'FETCH_ERROR',
        error: 'Unable to reach Google Sheets right now. Please try again shortly.',
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
