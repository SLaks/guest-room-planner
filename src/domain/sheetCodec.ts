import {
  formatBedTypeLabel,
  makeBedTypeKey,
  normalizeSizeAndKind,
  parseBedTypeKey,
} from './plannerMath.ts';
import type {
  Bed,
  BedKind,
  BlanketType,
  Family,
  LinenSourceAllocation,
  Person,
  PillowSourceAllocation,
  PlannerState,
  Room,
  SheetTabName,
  SourceAllocation,
} from './types.ts';

export const SHEET_HEADERS: Record<SheetTabName, string[]> = {
  EventMeta: ['key', 'value'],
  Families: ['familyId', 'familyName', 'sortOrder'],
  People: ['personId', 'familyId', 'name', 'notes', 'bedId', 'blanketType'],
  Beds: ['bedId', 'bedTypeKey', 'size', 'kind', 'roomId', 'customLabel', 'blanketType'],
  Rooms: ['roomId', 'name', 'notes', 'sortOrder'],
  BedSources: ['sourceAllocationId', 'bedTypeKey', 'sourceName', 'quantity'],
  LinenSources: [
    'linenSourceId',
    'size',
    'sourceName',
    'sheets',
    'blankets',
    'throws',
  ],
  PillowSources: ['pillowSourceId', 'sourceName', 'quantity'],
};

export const ALL_SHEET_TABS: SheetTabName[] = [
  'EventMeta',
  'Families',
  'People',
  'Beds',
  'Rooms',
  'BedSources',
  'LinenSources',
  'PillowSources',
];

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match full Google Sheets URL: https://docs.google.com/spreadsheets/d/<ID>/...
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Match bare spreadsheet ID
  if (/^[a-zA-Z0-9-_]{15,120}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function serializePlannerToTabs(
  state: PlannerState
): Record<SheetTabName, (string | number)[][]> {
  return {
    EventMeta: [
      SHEET_HEADERS.EventMeta,
      ['eventName', state.eventName || 'Family Gathering'],
      ['schemaVersion', '1'],
      ['updatedAt', state.updatedAt || new Date().toISOString()],
    ],
    Families: [
      SHEET_HEADERS.Families,
      ...state.families.map((f) => [f.id, f.name, f.sortOrder]),
    ],
    People: [
      SHEET_HEADERS.People,
      ...state.people.map((p) => [
        p.id,
        p.familyId,
        p.name,
        p.notes ?? '',
        p.bedId ?? '',
        p.blanketType ?? 'Regular Blanket',
      ]),
    ],
    Beds: [
      SHEET_HEADERS.Beds,
      ...state.beds.map((b) => [
        b.id,
        b.bedTypeKey || makeBedTypeKey(b.size, b.kind),
        b.size,
        b.kind,
        b.roomId ?? '',
        b.customLabel ?? '',
        b.blanketType ?? 'Regular Blanket',
      ]),
    ],
    Rooms: [
      SHEET_HEADERS.Rooms,
      ...state.rooms.map((r) => [r.id, r.name, r.notes ?? '', r.sortOrder]),
    ],
    BedSources: [
      SHEET_HEADERS.BedSources,
      ...state.sources.map((s) => [
        s.id,
        s.bedTypeKey,
        s.sourceName,
        Math.max(0, Math.floor(s.quantity || 0)),
      ]),
    ],
    LinenSources: [
      SHEET_HEADERS.LinenSources,
      ...state.linenSources.map((ls) => [
        ls.id,
        ls.size,
        ls.sourceName,
        Math.max(0, Math.floor(ls.sheets || 0)),
        Math.max(0, Math.floor(ls.blankets || 0)),
        Math.max(0, Math.floor(ls.throws || 0)),
      ]),
    ],
    PillowSources: [
      SHEET_HEADERS.PillowSources,
      ...(state.pillowSources ?? []).map((ps) => [
        ps.id,
        ps.sourceName,
        Math.max(0, Math.floor(ps.quantity || 0)),
      ]),
    ],
  };
}

function asString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

function asInt(cell: unknown, fallback = 0): number {
  const num = Number(cell);
  if (!Number.isFinite(num)) return fallback;
  return Math.floor(num);
}

export function headerMatchesTab(
  headerRow: unknown[] | undefined,
  tab: SheetTabName
): boolean {
  if (!headerRow || headerRow.length === 0) return false;
  const expected = SHEET_HEADERS[tab];
  const normalized = headerRow.map((h) => asString(h).toLowerCase());
  // Backward compatibility: older People tabs had 5 columns and older Beds tabs had 6 columns before blanketType was added
  const requiredCols =
    tab === 'People' && normalized.length === 5
      ? expected.slice(0, 5)
      : tab === 'Beds' && normalized.length === 6
      ? expected.slice(0, 6)
      : expected;
  return requiredCols.every((col, idx) => normalized[idx] === col.toLowerCase());
}

function parseBlanketType(raw: unknown): BlanketType {
  return asString(raw) === 'Throw' ? 'Throw' : 'Regular Blanket';
}

export function parseTabsToPlanner(
  tabs: Partial<Record<SheetTabName, unknown[][]>>,
  fallbackTitle = 'Family Gathering'
): PlannerState {
  let eventName = fallbackTitle;
  let updatedAt = new Date().toISOString();

  const metaRows = tabs.EventMeta;
  if (metaRows && metaRows.length > 1 && headerMatchesTab(metaRows[0], 'EventMeta')) {
    for (const row of metaRows.slice(1)) {
      const k = asString(row[0]);
      const v = asString(row[1]);
      if (k === 'eventName' && v) eventName = v;
      if (k === 'updatedAt' && v) updatedAt = v;
    }
  }

  const families: Family[] = [];
  const familyRows = tabs.Families;
  if (familyRows && familyRows.length > 1 && headerMatchesTab(familyRows[0], 'Families')) {
    familyRows.slice(1).forEach((row, index) => {
      const id = asString(row[0]);
      const name = asString(row[1]);
      if (!id || !name) return;
      families.push({
        id,
        name,
        sortOrder: row[2] !== undefined && row[2] !== '' ? asInt(row[2], index) : index,
      });
    });
  }

  const rooms: Room[] = [];
  const roomRows = tabs.Rooms;
  if (roomRows && roomRows.length > 1 && headerMatchesTab(roomRows[0], 'Rooms')) {
    roomRows.slice(1).forEach((row, index) => {
      const id = asString(row[0]);
      const name = asString(row[1]);
      if (!id || !name) return;
      rooms.push({
        id,
        name,
        notes: asString(row[2]),
        sortOrder: row[3] !== undefined && row[3] !== '' ? asInt(row[3], index) : index,
      });
    });
  }

  const validRoomIds = new Set(rooms.map((r) => r.id));

  const beds: Bed[] = [];
  const bedRows = tabs.Beds;
  if (bedRows && bedRows.length > 1 && headerMatchesTab(bedRows[0], 'Beds')) {
    for (const row of bedRows.slice(1)) {
      const id = asString(row[0]);
      if (!id) continue;
      const rawKey = asString(row[1]);
      const rawSize = asString(row[2]);
      const rawKind = asString(row[3]) as BedKind;
      const parsedFromKey = rawKey ? parseBedTypeKey(rawKey) : null;
      const validKinds: BedKind[] = [
        'Real Mattress',
        'Air Mattress',
        'Toddler Bed',
        'Pack & Play',
      ];
      const kind: BedKind = validKinds.includes(rawKind)
        ? rawKind
        : parsedFromKey?.kind ?? 'Real Mattress';
      const size = rawSize || parsedFromKey?.size || 'Queen';
      const normalized = normalizeSizeAndKind(size, kind);
      const roomIdRaw = asString(row[4]);

      const hasExplicitBlanket = row[6] !== undefined && asString(row[6]) !== '';

      beds.push({
        id,
        bedTypeKey: makeBedTypeKey(normalized.size, normalized.kind),
        size: normalized.size,
        kind: normalized.kind,
        roomId: roomIdRaw && validRoomIds.has(roomIdRaw) ? roomIdRaw : null,
        customLabel: asString(row[5]),
        blanketType: hasExplicitBlanket ? parseBlanketType(row[6]) : undefined,
      });
    }
  }

  const validBedIds = new Set(beds.map((b) => b.id));
  const validFamilyIds = new Set(families.map((f) => f.id));

  const people: Person[] = [];
  const peopleRows = tabs.People;
  if (peopleRows && peopleRows.length > 1 && headerMatchesTab(peopleRows[0], 'People')) {
    for (const row of peopleRows.slice(1)) {
      const id = asString(row[0]);
      const familyId = asString(row[1]);
      const name = asString(row[2]);
      if (!id || !familyId || !name || !validFamilyIds.has(familyId)) continue;
      const bedIdRaw = asString(row[4]);
      people.push({
        id,
        familyId,
        name,
        notes: asString(row[3]),
        bedId: bedIdRaw && validBedIds.has(bedIdRaw) ? bedIdRaw : null,
        blanketType: parseBlanketType(row[5]),
      });
    }
  }

  for (const bed of beds) {
    if (!bed.blanketType) {
      const occupants = people.filter((p) => p.bedId === bed.id);
      bed.blanketType = occupants.some((p) => p.blanketType === 'Throw')
        ? 'Throw'
        : 'Regular Blanket';
    }
  }

  const sources: SourceAllocation[] = [];
  const sourceRows = tabs.BedSources;
  if (
    sourceRows &&
    sourceRows.length > 1 &&
    headerMatchesTab(sourceRows[0], 'BedSources')
  ) {
    for (const row of sourceRows.slice(1)) {
      const id = asString(row[0]);
      const rawKey = asString(row[1]);
      const sourceName = asString(row[2]);
      const quantity = Math.max(0, asInt(row[3], 0));
      if (!id || !rawKey || !sourceName) continue;
      const { size, kind } = parseBedTypeKey(rawKey);
      sources.push({
        id,
        bedTypeKey: makeBedTypeKey(size, kind),
        sourceName,
        quantity,
      });
    }
  }

  const linenSources: LinenSourceAllocation[] = [];
  const linenRows = tabs.LinenSources;
  if (
    linenRows &&
    linenRows.length > 1 &&
    headerMatchesTab(linenRows[0], 'LinenSources')
  ) {
    for (const row of linenRows.slice(1)) {
      const id = asString(row[0]);
      const size = asString(row[1]);
      const sourceName = asString(row[2]);
      if (!id || !size || !sourceName) continue;
      linenSources.push({
        id,
        size,
        sourceName,
        sheets: Math.max(0, asInt(row[3], 0)),
        blankets: Math.max(0, asInt(row[4], 0)),
        throws: Math.max(0, asInt(row[5], 0)),
      });
    }
  }

  const pillowSources: PillowSourceAllocation[] = [];
  const pillowRows = tabs.PillowSources;
  if (
    pillowRows &&
    pillowRows.length > 1 &&
    headerMatchesTab(pillowRows[0], 'PillowSources')
  ) {
    for (const row of pillowRows.slice(1)) {
      const id = asString(row[0]);
      const sourceName = asString(row[1]);
      const quantity = Math.max(0, asInt(row[2], 0));
      if (!id || !sourceName) continue;
      pillowSources.push({
        id,
        sourceName,
        quantity,
      });
    }
  }

  return {
    eventName,
    updatedAt,
    families,
    people,
    beds,
    rooms,
    sources,
    linenSources,
    pillowSources,
  };
}

export function buildSyncSummaryDescription(state: PlannerState): string {
  const activeBeds = new Set(
    state.people.map((p) => p.bedId).filter((id): id is string => Boolean(id))
  );
  return `${state.families.length} families, ${state.people.length} guests, ${activeBeds.size} beds, ${state.rooms.length} rooms, ${state.sources.length} bed sources, ${state.linenSources.length} linen source entries, and ${(state.pillowSources ?? []).length} pillow sources`;
}

export function parseGvizJsonPayload(rawText: string): unknown[][] | null {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(rawText.slice(start, end + 1)) as {
      status?: string;
      table?: {
        cols?: Array<{ label?: string; id?: string }>;
        rows?: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }>;
      };
    };

    if (parsed.status !== 'ok' || !parsed.table) return null;

    const cols = parsed.table.cols ?? [];
    const headerRow = cols.map((c) => asString(c.label));
    const dataRows = (parsed.table.rows ?? []).map((r) =>
      (r.c ?? []).map((cell) => {
        if (!cell || cell.v === null || cell.v === undefined) return '';
        return cell.v;
      })
    );

    if (headerRow.every((h) => h === '')) {
      return dataRows;
    }

    return [headerRow, ...dataRows];
  } catch {
    return null;
  }
}

export { formatBedTypeLabel };
