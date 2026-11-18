import { describe, expect, it } from 'vitest';
import {
  addFamily,
  addLinenSourceAllocation,
  addPerson,
  addPillowSourceAllocation,
  addRoom,
  addSourceAllocation,
  assignPersonToExistingBed,
  assignPersonToNewBed,
  computeBedTypeReports,
  computeFamilySummaries,
  computeLinenSizeReports,
  computeOverallInventorySummary,
  computeOverallLinenSummary,
  computePillowReport,
  computeRoomSummaries,
  createEmptyPlannerState,
  createSamplePlannerState,
  makeBedTypeKey,
  moveBedToRoom,
  removeFamily,
  removePerson,
  removePillowSourceAllocation,
  removeRoom,
  updateBed,
  updateLinenSourceAllocation,
  updatePerson,
  updatePillowSourceAllocation,
  updateSourceAllocation,
} from '../plannerMath';
import {
  ALL_SHEET_TABS,
  extractSpreadsheetId,
  parseGvizJsonPayload,
  parseTabsToPlanner,
  serializePlannerToTabs,
} from '../sheetCodec';

describe('Hearth & Bunk End-to-End Math & Serialization', () => {
  it('counts shared beds as 1 physical bed and individual beds separately', () => {
    let state = createEmptyPlannerState('Summer Reunion');
    state = addFamily(state, 'Adams Family');
    const famId = state.families[0].id;

    const p1 = addPerson(state, famId, 'Alice Adams', 'Snorer');
    state = p1.state;
    const p2 = addPerson(state, famId, 'Bob Adams');
    state = p2.state;
    const p3 = addPerson(state, famId, 'Charlie Adams', 'Top bunk preferred');
    state = p3.state;
    const p4 = addPerson(state, famId, 'Daisy Adams');
    state = p4.state;

    // Alice & Bob share 1 Queen Real Mattress
    const b1 = assignPersonToNewBed(state, p1.personId!, 'Queen', 'Real Mattress');
    state = b1.state;
    state = assignPersonToExistingBed(state, p2.personId!, b1.bedId);

    // Charlie gets a Twin Air Mattress, Daisy gets a Pack & Play
    state = assignPersonToNewBed(state, p3.personId!, 'Twin', 'Air Mattress').state;
    state = assignPersonToNewBed(state, p4.personId!, 'Pack & Play', 'Pack & Play').state;

    const reports = computeBedTypeReports(state);
    const overall = computeOverallInventorySummary(state, reports);

    expect(overall.totalPeople).toBe(4);
    expect(overall.totalPeopleWithBeds).toBe(4);
    expect(overall.totalPeopleWithoutBeds).toBe(0);
    // 1 Queen Real + 1 Twin Air + 1 Pack & Play = 3 physical beds for 4 people
    expect(overall.totalPhysicalBeds).toBe(3);

    const queenReport = reports.find(
      (r) => r.bedTypeKey === makeBedTypeKey('Queen', 'Real Mattress')
    );
    expect(queenReport?.requiredCount).toBe(1);
    expect(queenReport?.occupantCount).toBe(2);

    const twinAirReport = reports.find(
      (r) => r.bedTypeKey === makeBedTypeKey('Twin', 'Air Mattress')
    );
    expect(twinAirReport?.requiredCount).toBe(1);
    expect(twinAirReport?.occupantCount).toBe(1);

    const packPlayReport = reports.find(
      (r) => r.bedTypeKey === makeBedTypeKey('Pack & Play', 'Pack & Play')
    );
    expect(packPlayReport?.requiredCount).toBe(1);
    expect(packPlayReport?.occupantCount).toBe(1);
  });

  it('prunes orphaned beds when a person switches to share another bed or is removed', () => {
    let state = createEmptyPlannerState();
    state = addFamily(state, 'Lee Family');
    const famId = state.families[0].id;

    const p1 = addPerson(state, famId, 'Mia Lee');
    state = p1.state;
    const p2 = addPerson(state, famId, 'Noah Lee');
    state = p2.state;

    const b1 = assignPersonToNewBed(state, p1.personId!, 'King', 'Real Mattress');
    state = b1.state;
    const b2 = assignPersonToNewBed(state, p2.personId!, 'Queen', 'Air Mattress');
    state = b2.state;

    expect(state.beds.length).toBe(2);

    // Noah joins Mia on the King bed -> Noah's old Queen Air Mattress should be pruned
    state = assignPersonToExistingBed(state, p2.personId!, b1.bedId);
    expect(state.beds.length).toBe(1);
    expect(state.beds[0].id).toBe(b1.bedId);

    const reports = computeBedTypeReports(state);
    expect(reports).toHaveLength(1);
    expect(reports[0].requiredCount).toBe(1);
    expect(reports[0].occupantCount).toBe(2);

    // Removing Mia leaves Noah on the King bed, so bed remains
    state = removePerson(state, p1.personId!);
    expect(state.beds.length).toBe(1);

    // Removing family removes Noah and prunes the bed
    state = removeFamily(state, famId);
    expect(state.beds.length).toBe(0);
    expect(computeOverallInventorySummary(state).totalPhysicalBeds).toBe(0);
  });

  it('calculates exact source split math: balanced, deficit, and over-allocated', () => {
    let state = createEmptyPlannerState();
    state = addFamily(state, 'Big Group');
    const famId = state.families[0].id;

    // 7 people each on a Twin Air Mattress (7 required)
    for (let i = 1; i <= 7; i++) {
      const added = addPerson(state, famId, `Guest ${i}`);
      state = added.state;
      state = assignPersonToNewBed(state, added.personId!, 'Twin', 'Air Mattress').state;
    }

    const twinAirKey = makeBedTypeKey('Twin', 'Air Mattress');

    // Divide into 4 from home + 1 borrowed from Joe = 5 (short by 2)
    state = addSourceAllocation(state, twinAirKey, 'From Home', 4);
    state = addSourceAllocation(state, twinAirKey, 'Borrowed from Joe', 1);

    let reports = computeBedTypeReports(state);
    let r = reports.find((x) => x.bedTypeKey === twinAirKey)!;
    expect(r.requiredCount).toBe(7);
    expect(r.allocatedCount).toBe(5);
    expect(r.remainingNeeded).toBe(2);
    expect(r.overAllocated).toBe(0);
    expect(r.status).toBe('needs_sourcing');
    expect(computeOverallInventorySummary(state, reports).allSourcesBalanced).toBe(false);

    // Update Borrowed from Joe to 3 -> 4 + 3 = 7 (balanced!)
    const joeSourceId = state.sources.find((s) => s.sourceName === 'Borrowed from Joe')!.id;
    state = updateSourceAllocation(state, joeSourceId, { quantity: 3 });

    reports = computeBedTypeReports(state);
    r = reports.find((x) => x.bedTypeKey === twinAirKey)!;
    expect(r.allocatedCount).toBe(7);
    expect(r.remainingNeeded).toBe(0);
    expect(r.overAllocated).toBe(0);
    expect(r.delta).toBe(0);
    expect(r.status).toBe('balanced');
    expect(computeOverallInventorySummary(state, reports).allSourcesBalanced).toBe(true);

    // Update Borrowed from Joe to 5 -> 4 + 5 = 9 (over-allocated by 2)
    state = updateSourceAllocation(state, joeSourceId, { quantity: 5 });

    reports = computeBedTypeReports(state);
    r = reports.find((x) => x.bedTypeKey === twinAirKey)!;
    expect(r.allocatedCount).toBe(9);
    expect(r.remainingNeeded).toBe(0);
    expect(r.overAllocated).toBe(2);
    expect(r.delta).toBe(-2);
    expect(r.status).toBe('over_allocated');
  });

  it('supports custom air mattress sizes, toddler beds, and room drag-and-drop invariants', () => {
    let state = createEmptyPlannerState();
    state = addFamily(state, 'Clark Family');
    const famId = state.families[0].id;
    state = addRoom(state, 'Bunkhouse', '2 outlets near window');
    const roomId = state.rooms[0].id;

    const p1 = addPerson(state, famId, 'Tall Cousin');
    state = p1.state;
    const p2 = addPerson(state, famId, 'Little Tot');
    state = p2.state;

    // Custom air mattress size: Twin XL Air Mattress
    const b1 = assignPersonToNewBed(state, p1.personId!, 'Twin XL', 'Air Mattress');
    state = b1.state;
    const b2 = assignPersonToNewBed(state, p2.personId!, 'Toddler', 'Toddler Bed');
    state = b2.state;

    // Initially both in unassigned tray
    let roomSummary = computeRoomSummaries(state);
    expect(roomSummary.unassignedBeds).toHaveLength(2);
    expect(roomSummary.rooms[0].beds).toHaveLength(0);

    // Drag both to Bunkhouse
    state = moveBedToRoom(state, b1.bedId, roomId);
    state = moveBedToRoom(state, b2.bedId, roomId);

    roomSummary = computeRoomSummaries(state);
    expect(roomSummary.unassignedBeds).toHaveLength(0);
    expect(roomSummary.rooms[0].beds).toHaveLength(2);
    expect(roomSummary.rooms[0].occupantCount).toBe(2);

    // Update custom air mattress size in place
    state = updateBed(state, b1.bedId, { size: 'California King', kind: 'Air Mattress' });
    const reports = computeBedTypeReports(state);
    expect(reports.some((r) => r.label === 'California King · Air Mattress')).toBe(true);

    // Removing room returns beds cleanly to unassigned tray
    state = removeRoom(state, roomId);
    roomSummary = computeRoomSummaries(state);
    expect(roomSummary.rooms).toHaveLength(0);
    expect(roomSummary.unassignedBeds).toHaveLength(2);
  });

  it('builds accurate family summaries including shared partners and room notes', () => {
    const sample = createSamplePlannerState();
    const summaries = computeFamilySummaries(sample);

    expect(summaries).toHaveLength(3);

    const cohen = summaries.find((s) => s.family.name === 'Cohen Family')!;
    expect(cohen.memberCount).toBe(3);
    // David + Sarah share 1 King, Leo has 1 Twin Air => 2 distinct beds used
    expect(cohen.bedsAssignedCount).toBe(2);
    expect(cohen.roomsUsed).toContain('Primary Suite');
    expect(cohen.roomsUsed).toContain('Upstairs Loft');

    const davidRow = cohen.rows.find((r) => r.person.name === 'David Cohen')!;
    expect(davidRow.bedTypeLabel).toBe('King · Real Mattress');
    expect(davidRow.sharedWith).toEqual(['Sarah Cohen']);
    expect(davidRow.roomName).toBe('Primary Suite');
    expect(davidRow.roomNotes).toBe('En-suite bath, quiet hallway');

    const miller = summaries.find((s) => s.family.name === 'Miller Family')!;
    const mayaRow = miller.rows.find((r) => r.person.name === 'Maya Miller')!;
    expect(mayaRow.bedTypeLabel).toBe('Pack & Play');
    expect(mayaRow.roomName).toBe('Garden Guest Room');
  });

  it('consumes one blanket per bed (not per person) and groups sheets, blankets, and throws by size regardless of air vs real mattress', () => {
    let state = createEmptyPlannerState();
    state = addFamily(state, 'Linens Family');
    const famId = state.families[0].id;

    // 1) Couple sharing 1 Queen Air Mattress: consumes 1 Queen blanket total, not 2
    const p1 = addPerson(state, famId, 'Jordan');
    state = p1.state;
    expect(state.people[0].blanketType).toBe('Regular Blanket');

    const p2 = addPerson(state, famId, 'Taylor');
    state = p2.state;

    const qAir = assignPersonToNewBed(state, p1.personId!, 'Queen', 'Air Mattress');
    state = qAir.state;
    state = assignPersonToExistingBed(state, p2.personId!, qAir.bedId);

    // Changing Taylor's blanket dropdown to Throw switches the shared Queen Air Mattress to 1 Throw
    state = updatePerson(state, p2.personId!, { blanketType: 'Throw' });
    expect(state.beds.find((b) => b.id === qAir.bedId)?.blanketType).toBe('Throw');
    expect(state.people.find((p) => p.id === p1.personId!)?.blanketType).toBe('Throw');

    // 2) Single person on a Queen Real Mattress with Regular Blanket
    const p3 = addPerson(state, famId, 'Morgan');
    state = p3.state;
    state = assignPersonToNewBed(state, p3.personId!, 'Queen', 'Real Mattress').state;

    // 3) Twin Real Mattress (Throw) + 2 Twin Air Mattresses (Regular Blanket)
    const p4 = addPerson(state, famId, 'Kid 1');
    state = p4.state;
    state = updatePerson(state, p4.personId!, { blanketType: 'Throw' });
    state = assignPersonToNewBed(state, p4.personId!, 'Twin', 'Real Mattress').state;

    const p5 = addPerson(state, famId, 'Kid 2');
    state = p5.state;
    state = assignPersonToNewBed(state, p5.personId!, 'Twin', 'Air Mattress').state;

    const p6 = addPerson(state, famId, 'Kid 3');
    state = p6.state;
    state = assignPersonToNewBed(state, p6.personId!, 'Twin', 'Air Mattress').state;

    // Queen: 2 beds (1 Air shared by 2 people with Throw + 1 Real with Regular Blanket)
    //   => 2 sheets, 1 regular blanket, 1 throw (1 blanket per bed!)
    //   => pillows still count per person: 3 Queen sleepers
    // Twin: 3 beds (1 Real Throw + 2 Air Regular) => 3 sheets, 2 regular blankets, 1 throw
    let linenReports = computeLinenSizeReports(state);
    expect(linenReports).toHaveLength(2);

    const queen = linenReports.find((r) => r.size === 'Queen')!;
    expect(queen.physicalBedsCount).toBe(2);
    expect(queen.occupantCount).toBe(3);
    expect(queen.sheets.required).toBe(2);
    expect(queen.blankets.required).toBe(1);
    expect(queen.throws.required).toBe(1);
    expect(queen.allBalanced).toBe(false);

    // Pillows remain 1 per person (3 on Queen beds + 3 on Twin beds = 6 total)
    expect(computePillowReport(state).totalRequired).toBe(6);

    const twin = linenReports.find((r) => r.size === 'Twin')!;
    expect(twin.physicalBedsCount).toBe(3);
    expect(twin.sheets.required).toBe(3);
    expect(twin.blankets.required).toBe(2);
    expect(twin.throws.required).toBe(1);

    // Allocate Queen linens across 2 sources: From Home (1 sheet, 1 blanket) + Borrowed from Joe (1 sheet, 1 throw)
    state = addLinenSourceAllocation(state, 'Queen', 'From Home', {
      sheets: 1,
      blankets: 1,
      throws: 0,
    });
    state = addLinenSourceAllocation(state, 'Queen', 'Borrowed from Joe', {
      sheets: 1,
      blankets: 0,
      throws: 1,
    });

    // Allocate Twin linens partially -> verify deficit then update to match
    state = addLinenSourceAllocation(state, 'Twin', 'From Home', {
      sheets: 2,
      blankets: 2,
      throws: 0,
    });
    const twinHomeId = state.linenSources.find(
      (ls) => ls.size === 'Twin' && ls.sourceName === 'From Home'
    )!.id;

    linenReports = computeLinenSizeReports(state);
    expect(linenReports.find((r) => r.size === 'Queen')!.allBalanced).toBe(true);
    const twinMid = linenReports.find((r) => r.size === 'Twin')!;
    expect(twinMid.sheets.remainingNeeded).toBe(1);
    expect(twinMid.blankets.status).toBe('balanced');
    expect(twinMid.throws.remainingNeeded).toBe(1);

    // Add remaining Twin linens from Joe and check overall summary
    state = addLinenSourceAllocation(state, 'Twin', 'Borrowed from Joe', {
      sheets: 1,
      blankets: 0,
      throws: 1,
    });
    const overallLinens = computeOverallLinenSummary(state);
    expect(overallLinens.allLinensBalanced).toBe(true);
    expect(overallLinens.totalSheetsRequired).toBe(5);
    expect(overallLinens.totalSheetsAllocated).toBe(5);
    expect(overallLinens.totalBlanketsRequired).toBe(3);
    expect(overallLinens.totalBlanketsAllocated).toBe(3);
    expect(overallLinens.totalThrowsRequired).toBe(2);
    expect(overallLinens.totalThrowsAllocated).toBe(2);

    // Over-allocating throws flags over_allocated accurately
    state = updateLinenSourceAllocation(state, twinHomeId, { throws: 2 });
    const twinOver = computeLinenSizeReports(state).find((r) => r.size === 'Twin')!;
    expect(twinOver.throws.status).toBe('over_allocated');
    expect(twinOver.throws.overAllocated).toBe(2);
  });

  it('preserves all math and assignments across full Google Sheet round-trip serialization', () => {
    const original = createSamplePlannerState();
    const tabs = serializePlannerToTabs(original);

    for (const tab of ALL_SHEET_TABS) {
      expect(tabs[tab].length).toBeGreaterThanOrEqual(2);
    }

    const parsed = parseTabsToPlanner(tabs);

    expect(parsed.eventName).toBe(original.eventName);
    expect(parsed.families).toEqual(original.families);
    expect(parsed.people).toEqual(original.people);
    expect(parsed.beds).toEqual(original.beds);
    expect(parsed.rooms).toEqual(original.rooms);
    expect(parsed.sources).toEqual(original.sources);
    expect(parsed.linenSources).toEqual(original.linenSources);
    expect(parsed.pillowSources).toEqual(original.pillowSources);

    const origReports = computeBedTypeReports(original);
    const parsedReports = computeBedTypeReports(parsed);
    expect(parsedReports.map((r) => ({ key: r.bedTypeKey, req: r.requiredCount, alloc: r.allocatedCount }))).toEqual(
      origReports.map((r) => ({ key: r.bedTypeKey, req: r.requiredCount, alloc: r.allocatedCount }))
    );

    const origLinenReports = computeLinenSizeReports(original);
    const parsedLinenReports = computeLinenSizeReports(parsed);
    expect(parsedLinenReports).toEqual(origLinenReports);

    const origPillowReport = computePillowReport(original);
    const parsedPillowReport = computePillowReport(parsed);
    expect(parsedPillowReport).toEqual(origPillowReport);

    const origOverall = computeOverallInventorySummary(original, origReports);
    const parsedOverall = computeOverallInventorySummary(parsed, parsedReports);
    expect(parsedOverall).toEqual(origOverall);

    const origFamilies = computeFamilySummaries(original);
    const parsedFamilies = computeFamilySummaries(parsed);
    expect(parsedFamilies).toEqual(origFamilies);

    // Legacy 5-column People & 6-column Beds backward compatibility (no blanketType column, LinenSources, or PillowSources tab)
    const legacyParsed = parseTabsToPlanner({
      EventMeta: tabs.EventMeta,
      Families: tabs.Families,
      People: [
        ['personId', 'familyId', 'name', 'notes', 'bedId'],
        ...tabs.People.slice(1).map((row) => row.slice(0, 5)),
      ],
      Beds: [
        ['bedId', 'bedTypeKey', 'size', 'kind', 'roomId', 'customLabel'],
        ...tabs.Beds.slice(1).map((row) => row.slice(0, 6)),
      ],
      Rooms: tabs.Rooms,
      BedSources: tabs.BedSources,
    });
    expect(legacyParsed.people.every((p) => p.blanketType === 'Regular Blanket')).toBe(
      true
    );
    expect(legacyParsed.beds.every((b) => b.blanketType === 'Regular Blanket')).toBe(
      true
    );
    expect(legacyParsed.linenSources).toEqual([]);
    expect(legacyParsed.pillowSources).toEqual([]);
  });

  it('computes pillow counts by room ignoring bed sizes and excludes Pack & Plays from pillows and blankets', () => {
    let state = createEmptyPlannerState('Pillow Test');
    state = addFamily(state, 'Test Family');
    const famId = state.families[0].id;

    state = addRoom(state, 'Master Room');
    const masterId = state.rooms[0].id;
    state = addRoom(state, 'Nursery');
    const nurseryId = state.rooms[1].id;

    // Couple in Master Room on a King Real Mattress (2 pillows, 2 blankets)
    const p1 = addPerson(state, famId, 'Alex', '', 'Regular Blanket');
    state = p1.state;
    const p2 = addPerson(state, famId, 'Sam', '', 'Throw');
    state = p2.state;
    const king = assignPersonToNewBed(state, p1.personId!, 'King', 'Real Mattress', '', masterId);
    state = king.state;
    state = assignPersonToExistingBed(state, p2.personId!, king.bedId);

    // Baby in Nursery on a Pack & Play (0 pillows, 0 blankets, 0 throws, 1 fitted sheet)
    const p3 = addPerson(state, famId, 'Baby Jo', '', 'Throw');
    state = p3.state;
    state = assignPersonToNewBed(state, p3.personId!, 'Pack & Play', 'Pack & Play', '', nurseryId).state;

    // Solo guest in Nursery on a Twin Air Mattress (1 pillow, 1 regular blanket)
    const p4 = addPerson(state, famId, 'Aunt Bea', '', 'Regular Blanket');
    state = p4.state;
    state = assignPersonToNewBed(state, p4.personId!, 'Twin', 'Air Mattress', '', nurseryId).state;

    // Unassigned guest on a Full Real Mattress (1 pillow)
    const p5 = addPerson(state, famId, 'Cousin Dan');
    state = p5.state;
    state = assignPersonToNewBed(state, p5.personId!, 'Full', 'Real Mattress').state;

    // Verify Pack & Play linen report requires 1 sheet, 0 blankets, 0 throws
    const linenReports = computeLinenSizeReports(state);
    const packAndPlayLinen = linenReports.find((r) => r.size === 'Pack & Play')!;
    expect(packAndPlayLinen.sheets.required).toBe(1);
    expect(packAndPlayLinen.blankets.required).toBe(0);
    expect(packAndPlayLinen.throws.required).toBe(0);

    // Verify room summaries carry pillow counts
    const roomSummaries = computeRoomSummaries(state);
    expect(roomSummaries.rooms[0].pillowsRequired).toBe(2);
    expect(roomSummaries.rooms[1].pillowsRequired).toBe(1);

    // Verify pillow report by room (ignores bed sizes) and source reconciliation
    let pillowReport = computePillowReport(state);
    expect(pillowReport.totalRequired).toBe(4);
    expect(pillowReport.byRoom).toHaveLength(3);
    expect(pillowReport.byRoom[0]).toMatchObject({
      roomName: 'Master Room',
      pillowsRequired: 2,
      excludedPackAndPlayCount: 0,
    });
    expect(pillowReport.byRoom[1]).toMatchObject({
      roomName: 'Nursery',
      pillowsRequired: 1,
      excludedPackAndPlayCount: 1,
    });
    expect(pillowReport.byRoom[2]).toMatchObject({
      roomId: null,
      roomName: 'Unassigned room',
      pillowsRequired: 1,
    });
    expect(pillowReport.status).toBe('needs_sourcing');
    expect(pillowReport.remainingNeeded).toBe(4);

    // Add sources: 3 From Home + 1 Borrowed from Joe => 4/4 Balanced
    state = addPillowSourceAllocation(state, 'From Home', 3);
    state = addPillowSourceAllocation(state, 'Borrowed from Joe', 1);
    pillowReport = computePillowReport(state);
    expect(pillowReport.totalAllocated).toBe(4);
    expect(pillowReport.status).toBe('balanced');

    // Over-allocate then remove
    const joeId = state.pillowSources.find((p) => p.sourceName === 'Borrowed from Joe')!.id;
    state = updatePillowSourceAllocation(state, joeId, { quantity: 3 });
    expect(computePillowReport(state).status).toBe('over_allocated');
    expect(computePillowReport(state).overAllocated).toBe(2);

    state = removePillowSourceAllocation(state, joeId);
    expect(computePillowReport(state).totalAllocated).toBe(3);
    expect(computePillowReport(state).remainingNeeded).toBe(1);
  });

  it('extracts spreadsheet IDs from URLs and parses public gviz JSON payloads', () => {
    expect(
      extractSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
      )
    ).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

    expect(extractSpreadsheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')).toBe(
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );

    expect(extractSpreadsheetId('not-a-valid-id')).toBeNull();

    const gvizSample = `/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","table":{"cols":[{"id":"A","label":"familyId","type":"string"},{"id":"B","label":"familyName","type":"string"},{"id":"C","label":"sortOrder","type":"number"}],"rows":[{"c":[{"v":"fam_1"},{"v":"Smith"},{"v":0}]}]}});`;

    const rows = parseGvizJsonPayload(gvizSample);
    expect(rows).toEqual([
      ['familyId', 'familyName', 'sortOrder'],
      ['fam_1', 'Smith', 0],
    ]);
  });
});
