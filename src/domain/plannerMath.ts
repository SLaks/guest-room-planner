import type {
  Bed,
  BedKind,
  BedTypeReport,
  BedView,
  BlanketType,
  Family,
  FamilyAssignmentRow,
  FamilySummary,
  LinenCountSummary,
  LinenSizeReport,
  LinenSourceAllocation,
  OverallInventorySummary,
  OverallLinenSummary,
  Person,
  PersonWithFamily,
  PillowReport,
  PillowSourceAllocation,
  PlannerState,
  Room,
  RoomPillowCount,
  RoomSummary,
  SourceAllocation,
  SourceBalanceStatus,
} from './types.ts';

export function normalizeSizeAndKind(
  rawSize: string,
  rawKind: BedKind
): { size: string; kind: BedKind } {
  const trimmedSize = rawSize.trim();
  if (rawKind === 'Pack & Play') {
    return { size: 'Pack & Play', kind: 'Pack & Play' };
  }
  if (rawKind === 'Toddler Bed') {
    return { size: 'Toddler', kind: 'Toddler Bed' };
  }
  return {
    size: trimmedSize || 'Queen',
    kind: rawKind,
  };
}

export function makeBedTypeKey(rawSize: string, rawKind: BedKind): string {
  const { size, kind } = normalizeSizeAndKind(rawSize, rawKind);
  return `${size}|${kind}`;
}

export function formatBedTypeLabel(rawSize: string, rawKind: BedKind): string {
  const { size, kind } = normalizeSizeAndKind(rawSize, rawKind);
  if (kind === 'Pack & Play') return 'Pack & Play';
  if (kind === 'Toddler Bed') return 'Toddler Bed';
  return `${size} · ${kind}`;
}

export function parseBedTypeKey(key: string): { size: string; kind: BedKind } {
  const [sizePart = 'Queen', kindPart = 'Real Mattress'] = key.split('|');
  const validKinds: BedKind[] = [
    'Real Mattress',
    'Air Mattress',
    'Toddler Bed',
    'Pack & Play',
  ];
  const kind = validKinds.includes(kindPart as BedKind)
    ? (kindPart as BedKind)
    : 'Real Mattress';
  return normalizeSizeAndKind(sizePart, kind);
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyPlannerState(eventName = 'Family Gathering'): PlannerState {
  return {
    eventName,
    updatedAt: new Date().toISOString(),
    families: [],
    people: [],
    beds: [],
    rooms: [],
    sources: [],
    linenSources: [],
    pillowSources: [],
  };
}

export function createSamplePlannerState(): PlannerState {
  const fam1: Family = { id: 'fam_cohen', name: 'Cohen Family', sortOrder: 0 };
  const fam2: Family = { id: 'fam_miller', name: 'Miller Family', sortOrder: 1 };
  const fam3: Family = { id: 'fam_patel', name: 'Patel Family', sortOrder: 2 };

  const room1: Room = {
    id: 'room_primary',
    name: 'Primary Suite',
    notes: 'En-suite bath, quiet hallway',
    sortOrder: 0,
  };
  const room2: Room = {
    id: 'room_loft',
    name: 'Upstairs Loft',
    notes: 'Plenty of floor space for air mattresses',
    sortOrder: 1,
  };
  const room3: Room = {
    id: 'room_bunk',
    name: 'Garden Guest Room',
    notes: 'Ground floor, easy crib access',
    sortOrder: 2,
  };

  const beds: Bed[] = [
    {
      id: 'bed_1',
      bedTypeKey: makeBedTypeKey('King', 'Real Mattress'),
      size: 'King',
      kind: 'Real Mattress',
      roomId: room1.id,
      customLabel: '',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'bed_2',
      bedTypeKey: makeBedTypeKey('Queen', 'Real Mattress'),
      size: 'Queen',
      kind: 'Real Mattress',
      roomId: room3.id,
      customLabel: '',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'bed_3',
      bedTypeKey: makeBedTypeKey('Twin', 'Air Mattress'),
      size: 'Twin',
      kind: 'Air Mattress',
      roomId: room2.id,
      customLabel: '',
      blanketType: 'Throw',
    },
    {
      id: 'bed_4',
      bedTypeKey: makeBedTypeKey('Twin', 'Air Mattress'),
      size: 'Twin',
      kind: 'Air Mattress',
      roomId: room2.id,
      customLabel: '',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'bed_5',
      bedTypeKey: makeBedTypeKey('Pack & Play', 'Pack & Play'),
      size: 'Pack & Play',
      kind: 'Pack & Play',
      roomId: room3.id,
      customLabel: '',
      blanketType: 'Regular Blanket',
    },
  ];

  const people: Person[] = [
    {
      id: 'per_1',
      familyId: fam1.id,
      name: 'David Cohen',
      notes: 'Early riser',
      bedId: 'bed_1',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'per_2',
      familyId: fam1.id,
      name: 'Sarah Cohen',
      notes: '',
      bedId: 'bed_1',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'per_3',
      familyId: fam1.id,
      name: 'Leo Cohen',
      notes: 'Needs nightlight',
      bedId: 'bed_3',
      blanketType: 'Throw',
    },
    {
      id: 'per_4',
      familyId: fam2.id,
      name: 'Hannah Miller',
      notes: '',
      bedId: 'bed_2',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'per_5',
      familyId: fam2.id,
      name: 'Sam Miller',
      notes: 'Arriving Friday night',
      bedId: 'bed_2',
      blanketType: 'Regular Blanket',
    },
    {
      id: 'per_6',
      familyId: fam2.id,
      name: 'Maya Miller',
      notes: 'Nap at 1pm',
      bedId: 'bed_5',
      blanketType: 'Throw',
    },
    {
      id: 'per_7',
      familyId: fam3.id,
      name: 'Noah Patel',
      notes: '',
      bedId: 'bed_4',
      blanketType: 'Regular Blanket',
    },
  ];

  const sources: SourceAllocation[] = [
    {
      id: 'src_1',
      bedTypeKey: makeBedTypeKey('King', 'Real Mattress'),
      sourceName: 'House (Built-in)',
      quantity: 1,
    },
    {
      id: 'src_2',
      bedTypeKey: makeBedTypeKey('Queen', 'Real Mattress'),
      sourceName: 'House (Built-in)',
      quantity: 1,
    },
    {
      id: 'src_3',
      bedTypeKey: makeBedTypeKey('Twin', 'Air Mattress'),
      sourceName: 'From Home',
      quantity: 1,
    },
    {
      id: 'src_4',
      bedTypeKey: makeBedTypeKey('Twin', 'Air Mattress'),
      sourceName: 'Borrowed from Joe',
      quantity: 1,
    },
    {
      id: 'src_5',
      bedTypeKey: makeBedTypeKey('Pack & Play', 'Pack & Play'),
      sourceName: 'Miller Family',
      quantity: 1,
    },
  ];

  const linenSources: LinenSourceAllocation[] = [
    {
      id: 'lin_1',
      size: 'King',
      sourceName: 'From Home',
      sheets: 1,
      blankets: 1,
      throws: 0,
    },
    {
      id: 'lin_2',
      size: 'Queen',
      sourceName: 'From Home',
      sheets: 1,
      blankets: 1,
      throws: 0,
    },
    {
      id: 'lin_3',
      size: 'Twin',
      sourceName: 'From Home',
      sheets: 1,
      blankets: 1,
      throws: 1,
    },
    {
      id: 'lin_4',
      size: 'Twin',
      sourceName: 'Borrowed from Joe',
      sheets: 1,
      blankets: 0,
      throws: 0,
    },
    {
      id: 'lin_5',
      size: 'Pack & Play',
      sourceName: 'Miller Family',
      sheets: 1,
      blankets: 0,
      throws: 0,
    },
  ];

  const pillowSources: PillowSourceAllocation[] = [
    {
      id: 'pil_1',
      sourceName: 'From Home',
      quantity: 4,
    },
    {
      id: 'pil_2',
      sourceName: 'Borrowed from Joe',
      quantity: 2,
    },
  ];

  return {
    eventName: 'Thanksgiving Lakehouse Reunion',
    updatedAt: new Date().toISOString(),
    families: [fam1, fam2, fam3],
    people,
    beds,
    rooms: [room1, room2, room3],
    sources,
    linenSources,
    pillowSources,
  };
}

export function pruneOrphanBeds(state: PlannerState): PlannerState {
  const usedBedIds = new Set(
    state.people.map((p) => p.bedId).filter((id): id is string => Boolean(id))
  );
  const nextBeds = state.beds.filter((b) => usedBedIds.has(b.id));
  if (nextBeds.length === state.beds.length) {
    return state;
  }
  return {
    ...state,
    beds: nextBeds,
  };
}

export function touchState(state: PlannerState): PlannerState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}

export function addFamily(state: PlannerState, name: string): PlannerState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const maxOrder = state.families.reduce((m, f) => Math.max(m, f.sortOrder), -1);
  const next: Family = {
    id: createId('fam'),
    name: trimmed,
    sortOrder: maxOrder + 1,
  };
  return touchState({
    ...state,
    families: [...state.families, next],
  });
}

export function updateFamily(state: PlannerState, familyId: string, name: string): PlannerState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return touchState({
    ...state,
    families: state.families.map((f) =>
      f.id === familyId ? { ...f, name: trimmed } : f
    ),
  });
}

export function removeFamily(state: PlannerState, familyId: string): PlannerState {
  const remainingFamilies = state.families.filter((f) => f.id !== familyId);
  const remainingPeople = state.people.filter((p) => p.familyId !== familyId);
  return touchState(
    pruneOrphanBeds({
      ...state,
      families: remainingFamilies,
      people: remainingPeople,
    })
  );
}

export function addPerson(
  state: PlannerState,
  familyId: string,
  name: string,
  notes = '',
  blanketType: BlanketType = 'Regular Blanket'
): { state: PlannerState; personId: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { state, personId: null };
  const person: Person = {
    id: createId('per'),
    familyId,
    name: trimmed,
    notes: notes.trim(),
    bedId: null,
    blanketType,
  };
  return {
    state: touchState({
      ...state,
      people: [...state.people, person],
    }),
    personId: person.id,
  };
}

export function resolveBedBlanketType(
  bed: Bed,
  occupants: Person[] = []
): BlanketType {
  if (bed.blanketType === 'Throw' || bed.blanketType === 'Regular Blanket') {
    return bed.blanketType;
  }
  if (occupants.some((o) => o.blanketType === 'Throw')) {
    return 'Throw';
  }
  return 'Regular Blanket';
}

export function updatePerson(
  state: PlannerState,
  personId: string,
  patch: Partial<Pick<Person, 'name' | 'notes' | 'familyId' | 'blanketType'>>
): PlannerState {
  const targetPerson = state.people.find((p) => p.id === personId);
  const sharedBedId =
    patch.blanketType !== undefined ? targetPerson?.bedId ?? null : null;

  return touchState({
    ...state,
    beds:
      sharedBedId && patch.blanketType !== undefined
        ? state.beds.map((b) =>
            b.id === sharedBedId ? { ...b, blanketType: patch.blanketType } : b
          )
        : state.beds,
    people: state.people.map((p) => {
      if (p.id === personId) {
        return {
          ...p,
          name: patch.name !== undefined ? patch.name.trim() || p.name : p.name,
          notes: patch.notes !== undefined ? patch.notes : p.notes,
          familyId: patch.familyId !== undefined ? patch.familyId : p.familyId,
          blanketType:
            patch.blanketType !== undefined ? patch.blanketType : p.blanketType,
        };
      }
      if (
        sharedBedId &&
        patch.blanketType !== undefined &&
        p.bedId === sharedBedId
      ) {
        return {
          ...p,
          blanketType: patch.blanketType,
        };
      }
      return p;
    }),
  });
}

export function removePerson(state: PlannerState, personId: string): PlannerState {
  return touchState(
    pruneOrphanBeds({
      ...state,
      people: state.people.filter((p) => p.id !== personId),
    })
  );
}

export function assignPersonToNewBed(
  state: PlannerState,
  personId: string,
  size: string,
  kind: BedKind,
  customLabel = '',
  initialRoomId: string | null = null
): { state: PlannerState; bedId: string } {
  const normalized = normalizeSizeAndKind(size, kind);
  const bedTypeKey = makeBedTypeKey(normalized.size, normalized.kind);
  const existingPerson = state.people.find((p) => p.id === personId);
  const previousBed = existingPerson?.bedId
    ? state.beds.find((b) => b.id === existingPerson.bedId)
    : undefined;

  const newBed: Bed = {
    id: createId('bed'),
    bedTypeKey,
    size: normalized.size,
    kind: normalized.kind,
    roomId: initialRoomId ?? previousBed?.roomId ?? null,
    customLabel: customLabel.trim(),
    blanketType: existingPerson?.blanketType ?? 'Regular Blanket',
  };

  const nextPeople = state.people.map((p) =>
    p.id === personId ? { ...p, bedId: newBed.id } : p
  );

  const nextState = touchState(
    pruneOrphanBeds({
      ...state,
      beds: [...state.beds, newBed],
      people: nextPeople,
    })
  );

  return { state: nextState, bedId: newBed.id };
}

export function assignPersonToExistingBed(
  state: PlannerState,
  personId: string,
  targetBedId: string
): PlannerState {
  const targetBed = state.beds.find((b) => b.id === targetBedId);
  if (!targetBed) return state;

  const existingOccupants = state.people.filter((p) => p.bedId === targetBedId);
  const bedBlanketType = resolveBedBlanketType(targetBed, existingOccupants);

  const nextPeople = state.people.map((p) =>
    p.id === personId
      ? { ...p, bedId: targetBedId, blanketType: bedBlanketType }
      : p
  );

  return touchState(
    pruneOrphanBeds({
      ...state,
      beds: state.beds.map((b) =>
        b.id === targetBedId && !b.blanketType
          ? { ...b, blanketType: bedBlanketType }
          : b
      ),
      people: nextPeople,
    })
  );
}

export function unassignPersonBed(state: PlannerState, personId: string): PlannerState {
  const nextPeople = state.people.map((p) =>
    p.id === personId ? { ...p, bedId: null } : p
  );
  return touchState(
    pruneOrphanBeds({
      ...state,
      people: nextPeople,
    })
  );
}

export function updateBed(
  state: PlannerState,
  bedId: string,
  patch: { size?: string; kind?: BedKind; customLabel?: string }
): PlannerState {
  return touchState({
    ...state,
    beds: state.beds.map((b) => {
      if (b.id !== bedId) return b;
      const nextKind = patch.kind ?? b.kind;
      const nextSize = patch.size ?? b.size;
      const normalized = normalizeSizeAndKind(nextSize, nextKind);
      return {
        ...b,
        size: normalized.size,
        kind: normalized.kind,
        bedTypeKey: makeBedTypeKey(normalized.size, normalized.kind),
        customLabel:
          patch.customLabel !== undefined ? patch.customLabel.trim() : b.customLabel,
      };
    }),
  });
}

export function addRoom(state: PlannerState, name: string, notes = ''): PlannerState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const maxOrder = state.rooms.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  const room: Room = {
    id: createId('room'),
    name: trimmed,
    notes: notes.trim(),
    sortOrder: maxOrder + 1,
  };
  return touchState({
    ...state,
    rooms: [...state.rooms, room],
  });
}

export function updateRoom(
  state: PlannerState,
  roomId: string,
  patch: Partial<Pick<Room, 'name' | 'notes'>>
): PlannerState {
  return touchState({
    ...state,
    rooms: state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        name: patch.name !== undefined ? patch.name.trim() || r.name : r.name,
        notes: patch.notes !== undefined ? patch.notes : r.notes,
      };
    }),
  });
}

export function removeRoom(state: PlannerState, roomId: string): PlannerState {
  return touchState({
    ...state,
    rooms: state.rooms.filter((r) => r.id !== roomId),
    beds: state.beds.map((b) => (b.roomId === roomId ? { ...b, roomId: null } : b)),
  });
}

export function moveBedToRoom(
  state: PlannerState,
  bedId: string,
  roomId: string | null
): PlannerState {
  if (roomId !== null && !state.rooms.some((r) => r.id === roomId)) {
    return state;
  }
  return touchState({
    ...state,
    beds: state.beds.map((b) => (b.id === bedId ? { ...b, roomId } : b)),
  });
}

export function addSourceAllocation(
  state: PlannerState,
  bedTypeKey: string,
  sourceName: string,
  quantity: number
): PlannerState {
  const trimmed = sourceName.trim();
  const safeQty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  if (!trimmed) return state;
  const next: SourceAllocation = {
    id: createId('src'),
    bedTypeKey,
    sourceName: trimmed,
    quantity: safeQty,
  };
  return touchState({
    ...state,
    sources: [...state.sources, next],
  });
}

export function updateSourceAllocation(
  state: PlannerState,
  sourceId: string,
  patch: Partial<Pick<SourceAllocation, 'sourceName' | 'quantity'>>
): PlannerState {
  return touchState({
    ...state,
    sources: state.sources.map((s) => {
      if (s.id !== sourceId) return s;
      const nextQty =
        patch.quantity !== undefined
          ? Math.max(0, Math.floor(Number.isFinite(patch.quantity) ? patch.quantity : 0))
          : s.quantity;
      return {
        ...s,
        sourceName:
          patch.sourceName !== undefined ? patch.sourceName : s.sourceName,
        quantity: nextQty,
      };
    }),
  });
}

export function removeSourceAllocation(state: PlannerState, sourceId: string): PlannerState {
  return touchState({
    ...state,
    sources: state.sources.filter((s) => s.id !== sourceId),
  });
}

function clampNonNegativeInt(val: number): number {
  return Math.max(0, Math.floor(Number.isFinite(val) ? val : 0));
}

export function addLinenSourceAllocation(
  state: PlannerState,
  size: string,
  sourceName: string,
  counts: { sheets?: number; blankets?: number; throws?: number } = {}
): PlannerState {
  const trimmedSource = sourceName.trim();
  const trimmedSize = size.trim();
  if (!trimmedSource || !trimmedSize) return state;

  const next: LinenSourceAllocation = {
    id: createId('lin'),
    size: trimmedSize,
    sourceName: trimmedSource,
    sheets: clampNonNegativeInt(counts.sheets ?? 0),
    blankets: clampNonNegativeInt(counts.blankets ?? 0),
    throws: clampNonNegativeInt(counts.throws ?? 0),
  };

  return touchState({
    ...state,
    linenSources: [...state.linenSources, next],
  });
}

export function updateLinenSourceAllocation(
  state: PlannerState,
  linenSourceId: string,
  patch: Partial<Pick<LinenSourceAllocation, 'sourceName' | 'sheets' | 'blankets' | 'throws'>>
): PlannerState {
  return touchState({
    ...state,
    linenSources: state.linenSources.map((ls) => {
      if (ls.id !== linenSourceId) return ls;
      return {
        ...ls,
        sourceName:
          patch.sourceName !== undefined ? patch.sourceName : ls.sourceName,
        sheets:
          patch.sheets !== undefined
            ? clampNonNegativeInt(patch.sheets)
            : ls.sheets,
        blankets:
          patch.blankets !== undefined
            ? clampNonNegativeInt(patch.blankets)
            : ls.blankets,
        throws:
          patch.throws !== undefined
            ? clampNonNegativeInt(patch.throws)
            : ls.throws,
      };
    }),
  });
}

export function removeLinenSourceAllocation(
  state: PlannerState,
  linenSourceId: string
): PlannerState {
  return touchState({
    ...state,
    linenSources: state.linenSources.filter((ls) => ls.id !== linenSourceId),
  });
}

export function addPillowSourceAllocation(
  state: PlannerState,
  sourceName: string,
  quantity: number
): PlannerState {
  const trimmedSource = sourceName.trim();
  if (!trimmedSource) return state;

  const next: PillowSourceAllocation = {
    id: createId('pil'),
    sourceName: trimmedSource,
    quantity: clampNonNegativeInt(quantity),
  };

  return touchState({
    ...state,
    pillowSources: [...state.pillowSources, next],
  });
}

export function updatePillowSourceAllocation(
  state: PlannerState,
  pillowSourceId: string,
  patch: Partial<Pick<PillowSourceAllocation, 'sourceName' | 'quantity'>>
): PlannerState {
  return touchState({
    ...state,
    pillowSources: state.pillowSources.map((ps) => {
      if (ps.id !== pillowSourceId) return ps;
      return {
        ...ps,
        sourceName:
          patch.sourceName !== undefined ? patch.sourceName : ps.sourceName,
        quantity:
          patch.quantity !== undefined
            ? clampNonNegativeInt(patch.quantity)
            : ps.quantity,
      };
    }),
  });
}

export function removePillowSourceAllocation(
  state: PlannerState,
  pillowSourceId: string
): PlannerState {
  return touchState({
    ...state,
    pillowSources: state.pillowSources.filter((ps) => ps.id !== pillowSourceId),
  });
}

// ============================================================================
// Pure Mathematical & Reporting Projections
// ============================================================================

export function computeBedViews(state: PlannerState): BedView[] {
  const familyMap = new Map(state.families.map((f) => [f.id, f.name]));
  const roomMap = new Map(state.rooms.map((r) => [r.id, r]));

  const occupantsByBed = new Map<string, PersonWithFamily[]>();
  for (const person of state.people) {
    if (!person.bedId) continue;
    const list = occupantsByBed.get(person.bedId) ?? [];
    list.push({
      ...person,
      familyName: familyMap.get(person.familyId) ?? 'Unassigned Family',
    });
    occupantsByBed.set(person.bedId, list);
  }

  return state.beds
    .filter((bed) => (occupantsByBed.get(bed.id)?.length ?? 0) > 0)
    .map((bed) => {
      const occupants = occupantsByBed.get(bed.id) ?? [];
      const room = bed.roomId ? roomMap.get(bed.roomId) ?? null : null;
      const typeLabel = formatBedTypeLabel(bed.size, bed.kind);
      const occupantSummary = occupants.map((o) => o.name).join(' & ');
      return {
        bed,
        occupants,
        room,
        typeLabel,
        occupantSummary,
      };
    });
}

const SIZE_SORT_ORDER: Record<string, number> = {
  King: 1,
  Queen: 2,
  Full: 3,
  Twin: 4,
  Toddler: 5,
  'Pack & Play': 6,
};

const KIND_SORT_ORDER: Record<BedKind, number> = {
  'Real Mattress': 1,
  'Air Mattress': 2,
  'Toddler Bed': 3,
  'Pack & Play': 4,
};

export function computeBedTypeReports(state: PlannerState): BedTypeReport[] {
  const bedViews = computeBedViews(state);
  const bedsByType = new Map<string, BedView[]>();

  for (const bv of bedViews) {
    const key = makeBedTypeKey(bv.bed.size, bv.bed.kind);
    const list = bedsByType.get(key) ?? [];
    list.push(bv);
    bedsByType.set(key, list);
  }

  // Include any bed types that still have source allocations even if requiredCount is 0
  const allKeys = new Set<string>([
    ...bedsByType.keys(),
    ...state.sources.map((s) => s.bedTypeKey),
  ]);

  const reports: BedTypeReport[] = [];

  for (const bedTypeKey of allKeys) {
    const beds = bedsByType.get(bedTypeKey) ?? [];
    const { size, kind } = parseBedTypeKey(bedTypeKey);
    const requiredCount = beds.length;
    const occupantCount = beds.reduce((sum, bv) => sum + bv.occupants.length, 0);
    const sources = state.sources.filter((s) => s.bedTypeKey === bedTypeKey);
    const allocatedCount = sources.reduce(
      (sum, s) => sum + Math.max(0, Math.floor(s.quantity || 0)),
      0
    );

    // Skip stale zero-count source groups only if neither beds nor sources exist
    if (requiredCount === 0 && sources.length === 0) continue;

    const delta = requiredCount - allocatedCount;
    const remainingNeeded = Math.max(0, delta);
    const overAllocated = Math.max(0, -delta);

    let status: SourceBalanceStatus = 'balanced';
    if (delta > 0) status = 'needs_sourcing';
    else if (delta < 0) status = 'over_allocated';

    reports.push({
      bedTypeKey,
      label: formatBedTypeLabel(size, kind),
      size,
      kind,
      requiredCount,
      occupantCount,
      beds,
      sources,
      allocatedCount,
      remainingNeeded,
      overAllocated,
      delta,
      status,
    });
  }

  reports.sort((a, b) => {
    const sizeDiff = (SIZE_SORT_ORDER[a.size] ?? 99) - (SIZE_SORT_ORDER[b.size] ?? 99);
    if (sizeDiff !== 0) return sizeDiff;
    const kindDiff = (KIND_SORT_ORDER[a.kind] ?? 99) - (KIND_SORT_ORDER[b.kind] ?? 99);
    if (kindDiff !== 0) return kindDiff;
    return a.label.localeCompare(b.label);
  });

  return reports;
}

export function computeOverallInventorySummary(
  state: PlannerState,
  reports: BedTypeReport[] = computeBedTypeReports(state)
): OverallInventorySummary {
  const bedViews = computeBedViews(state);
  const validBedIds = new Set(bedViews.map((bv) => bv.bed.id));

  const totalPhysicalBeds = reports.reduce((s, r) => s + r.requiredCount, 0);
  const totalAllocatedBeds = reports.reduce((s, r) => s + r.allocatedCount, 0);
  const totalPeople = state.people.length;
  const totalPeopleWithBeds = state.people.filter(
    (p) => p.bedId !== null && validBedIds.has(p.bedId)
  ).length;
  const totalPeopleWithoutBeds = totalPeople - totalPeopleWithBeds;
  const unplacedBedsCount = bedViews.filter((bv) => bv.room === null).length;

  const balancedGroupsCount = reports.filter((r) => r.status === 'balanced').length;
  const unbalancedGroupsCount = reports.length - balancedGroupsCount;

  return {
    totalPhysicalBeds,
    totalAllocatedBeds,
    totalPeople,
    totalPeopleWithBeds,
    totalPeopleWithoutBeds,
    unplacedBedsCount,
    balancedGroupsCount,
    unbalancedGroupsCount,
    allSourcesBalanced: unbalancedGroupsCount === 0,
  };
}

function buildLinenCountSummary(
  required: number,
  allocated: number
): LinenCountSummary {
  const delta = required - allocated;
  const remainingNeeded = Math.max(0, delta);
  const overAllocated = Math.max(0, -delta);
  let status: SourceBalanceStatus = 'balanced';
  if (delta > 0) status = 'needs_sourcing';
  else if (delta < 0) status = 'over_allocated';
  return {
    required,
    allocated,
    remainingNeeded,
    overAllocated,
    delta,
    status,
  };
}

export function computeLinenSizeReports(state: PlannerState): LinenSizeReport[] {
  const bedViews = computeBedViews(state);
  const bedsBySize = new Map<string, BedView[]>();

  for (const bv of bedViews) {
    // Group strictly by size, NOT differentiating Real Mattress vs Air Mattress
    const size = bv.bed.size.trim() || 'Queen';
    const list = bedsBySize.get(size) ?? [];
    list.push(bv);
    bedsBySize.set(size, list);
  }

  const allSizes = new Set<string>([
    ...bedsBySize.keys(),
    ...state.linenSources.map((ls) => ls.size.trim()).filter(Boolean),
  ]);

  const reports: LinenSizeReport[] = [];

  for (const size of allSizes) {
    const beds = bedsBySize.get(size) ?? [];
    const physicalBedsCount = beds.length;
    let occupantCount = 0;
    let blanketsRequired = 0;
    let throwsRequired = 0;

    for (const bv of beds) {
      occupantCount += bv.occupants.length;
      // Pack & Plays require fitted sheets only; no pillows or blankets
      if (bv.bed.kind === 'Pack & Play') {
        continue;
      }
      // Consume 1 blanket per bed, not per person on the bed
      const bedBlanketType = resolveBedBlanketType(bv.bed, bv.occupants);
      if (bedBlanketType === 'Throw') {
        throwsRequired += 1;
      } else {
        blanketsRequired += 1;
      }
    }

    const sources = state.linenSources.filter((ls) => ls.size.trim() === size);
    const sheetsAllocated = sources.reduce(
      (sum, ls) => sum + clampNonNegativeInt(ls.sheets),
      0
    );
    const blanketsAllocated = sources.reduce(
      (sum, ls) => sum + clampNonNegativeInt(ls.blankets),
      0
    );
    const throwsAllocated = sources.reduce(
      (sum, ls) => sum + clampNonNegativeInt(ls.throws),
      0
    );

    if (physicalBedsCount === 0 && sources.length === 0) continue;

    const sheets = buildLinenCountSummary(physicalBedsCount, sheetsAllocated);
    const blankets = buildLinenCountSummary(blanketsRequired, blanketsAllocated);
    const throws = buildLinenCountSummary(throwsRequired, throwsAllocated);

    const allBalanced =
      sheets.status === 'balanced' &&
      blankets.status === 'balanced' &&
      throws.status === 'balanced';

    reports.push({
      size,
      physicalBedsCount,
      occupantCount,
      sheets,
      blankets,
      throws,
      sources,
      allBalanced,
    });
  }

  reports.sort((a, b) => {
    const sizeDiff = (SIZE_SORT_ORDER[a.size] ?? 99) - (SIZE_SORT_ORDER[b.size] ?? 99);
    if (sizeDiff !== 0) return sizeDiff;
    return a.size.localeCompare(b.size);
  });

  return reports;
}

export function computeOverallLinenSummary(
  state: PlannerState,
  linenReports: LinenSizeReport[] = computeLinenSizeReports(state)
): OverallLinenSummary {
  const bedViews = computeBedViews(state);
  const mappedPersonIds = new Set(
    bedViews.flatMap((bv) => bv.occupants.map((o) => o.id))
  );
  const unmappedPeopleCount = state.people.filter(
    (p) => !mappedPersonIds.has(p.id)
  ).length;

  const totalSheetsRequired = linenReports.reduce(
    (sum, r) => sum + r.sheets.required,
    0
  );
  const totalSheetsAllocated = linenReports.reduce(
    (sum, r) => sum + r.sheets.allocated,
    0
  );
  const totalBlanketsRequired = linenReports.reduce(
    (sum, r) => sum + r.blankets.required,
    0
  );
  const totalBlanketsAllocated = linenReports.reduce(
    (sum, r) => sum + r.blankets.allocated,
    0
  );
  const totalThrowsRequired = linenReports.reduce(
    (sum, r) => sum + r.throws.required,
    0
  );
  const totalThrowsAllocated = linenReports.reduce(
    (sum, r) => sum + r.throws.allocated,
    0
  );

  const balancedSizesCount = linenReports.filter((r) => r.allBalanced).length;

  return {
    totalSheetsRequired,
    totalSheetsAllocated,
    totalBlanketsRequired,
    totalBlanketsAllocated,
    totalThrowsRequired,
    totalThrowsAllocated,
    balancedSizesCount,
    totalSizesCount: linenReports.length,
    allLinensBalanced: balancedSizesCount === linenReports.length,
    unmappedPeopleCount,
  };
}

export function countBedPillowsRequired(bv: BedView): number {
  if (bv.bed.kind === 'Pack & Play') return 0;
  return bv.occupants.length;
}

export function computeRoomSummaries(state: PlannerState): {
  unassignedBeds: BedView[];
  rooms: RoomSummary[];
} {
  const bedViews = computeBedViews(state);
  const sortedRooms = [...state.rooms].sort((a, b) => a.sortOrder - b.sortOrder);

  const unassignedBeds = bedViews.filter((bv) => bv.room === null);
  const rooms: RoomSummary[] = sortedRooms.map((room) => {
    const beds = bedViews.filter((bv) => bv.room?.id === room.id);
    const occupantCount = beds.reduce((sum, bv) => sum + bv.occupants.length, 0);
    const pillowsRequired = beds.reduce(
      (sum, bv) => sum + countBedPillowsRequired(bv),
      0
    );
    return {
      room,
      beds,
      occupantCount,
      pillowsRequired,
    };
  });

  return { unassignedBeds, rooms };
}

export function computePillowReport(state: PlannerState): PillowReport {
  const { unassignedBeds, rooms } = computeRoomSummaries(state);

  const byRoom: RoomPillowCount[] = rooms.map((r) => {
    const excludedPackAndPlayCount = r.beds
      .filter((bv) => bv.bed.kind === 'Pack & Play')
      .reduce((sum, bv) => sum + bv.occupants.length, 0);

    return {
      roomId: r.room.id,
      roomName: r.room.name,
      roomNotes: r.room.notes,
      pillowsRequired: r.pillowsRequired,
      bedCount: r.beds.length,
      occupantCount: r.occupantCount,
      excludedPackAndPlayCount,
    };
  });

  if (unassignedBeds.length > 0) {
    const unassignedPillows = unassignedBeds.reduce(
      (sum, bv) => sum + countBedPillowsRequired(bv),
      0
    );
    const unassignedOccupants = unassignedBeds.reduce(
      (sum, bv) => sum + bv.occupants.length,
      0
    );
    const excludedPackAndPlayCount = unassignedBeds
      .filter((bv) => bv.bed.kind === 'Pack & Play')
      .reduce((sum, bv) => sum + bv.occupants.length, 0);

    byRoom.push({
      roomId: null,
      roomName: 'Unassigned room',
      roomNotes: 'Beds awaiting room assignment',
      pillowsRequired: unassignedPillows,
      bedCount: unassignedBeds.length,
      occupantCount: unassignedOccupants,
      excludedPackAndPlayCount,
    });
  }

  const totalRequired = byRoom.reduce((sum, r) => sum + r.pillowsRequired, 0);
  const sources = state.pillowSources ?? [];
  const totalAllocated = sources.reduce(
    (sum, ps) => sum + clampNonNegativeInt(ps.quantity),
    0
  );

  const summary = buildLinenCountSummary(totalRequired, totalAllocated);

  return {
    totalRequired,
    totalAllocated,
    remainingNeeded: summary.remainingNeeded,
    overAllocated: summary.overAllocated,
    delta: summary.delta,
    status: summary.status,
    byRoom,
    sources,
  };
}

export function computeFamilySummaries(state: PlannerState): FamilySummary[] {
  const sortedFamilies = [...state.families].sort((a, b) => a.sortOrder - b.sortOrder);
  const bedMap = new Map(state.beds.map((b) => [b.id, b]));
  const roomMap = new Map(state.rooms.map((r) => [r.id, r]));

  const peopleByBed = new Map<string, Person[]>();
  for (const person of state.people) {
    if (!person.bedId) continue;
    const list = peopleByBed.get(person.bedId) ?? [];
    list.push(person);
    peopleByBed.set(person.bedId, list);
  }

  return sortedFamilies.map((family) => {
    const members = state.people.filter((p) => p.familyId === family.id);
    const distinctBedsUsed = new Set<string>();
    const roomsUsedSet = new Set<string>();

    const rows: FamilyAssignmentRow[] = members.map((person) => {
      const bed = person.bedId ? bedMap.get(person.bedId) ?? null : null;
      const room = bed?.roomId ? roomMap.get(bed.roomId) ?? null : null;
      const sharedWith = bed
        ? (peopleByBed.get(bed.id) ?? [])
            .filter((other) => other.id !== person.id)
            .map((other) => other.name)
        : [];

      if (bed) distinctBedsUsed.add(bed.id);
      if (room) roomsUsedSet.add(room.name);

      return {
        person,
        bed,
        bedTypeLabel: bed ? formatBedTypeLabel(bed.size, bed.kind) : 'No bed mapped',
        sharedWith,
        room,
        roomName: room ? room.name : 'Unassigned room',
        roomNotes: room?.notes ?? '',
      };
    });

    return {
      family,
      rows,
      memberCount: members.length,
      bedsAssignedCount: distinctBedsUsed.size,
      roomsUsed: Array.from(roomsUsedSet),
    };
  });
}
