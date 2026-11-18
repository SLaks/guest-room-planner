export type BedKind =
  | 'Real Mattress'
  | 'Air Mattress'
  | 'Toddler Bed'
  | 'Pack & Play';

export type PresetBedSize =
  | 'King'
  | 'Queen'
  | 'Full'
  | 'Twin'
  | 'Toddler'
  | 'Pack & Play';

export const MATTRESS_SIZES: PresetBedSize[] = ['King', 'Queen', 'Full', 'Twin'];

export const ALL_BED_KINDS: BedKind[] = [
  'Real Mattress',
  'Air Mattress',
  'Toddler Bed',
  'Pack & Play',
];

export type BlanketType = 'Regular Blanket' | 'Throw';

export const ALL_BLANKET_TYPES: BlanketType[] = ['Regular Blanket', 'Throw'];

export interface Family {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Person {
  id: string;
  familyId: string;
  name: string;
  notes: string;
  bedId: string | null;
  blanketType: BlanketType;
}

export interface Bed {
  id: string;
  bedTypeKey: string;
  size: string;
  kind: BedKind;
  roomId: string | null;
  customLabel: string;
  blanketType?: BlanketType;
}

export interface Room {
  id: string;
  name: string;
  notes: string;
  sortOrder: number;
}

export interface SourceAllocation {
  id: string;
  bedTypeKey: string;
  sourceName: string;
  quantity: number;
}

export interface LinenSourceAllocation {
  id: string;
  size: string;
  sourceName: string;
  sheets: number;
  blankets: number;
  throws: number;
}

export interface PillowSourceAllocation {
  id: string;
  sourceName: string;
  quantity: number;
}

export interface PlannerState {
  eventName: string;
  updatedAt: string;
  families: Family[];
  people: Person[];
  beds: Bed[];
  rooms: Room[];
  sources: SourceAllocation[];
  linenSources: LinenSourceAllocation[];
  pillowSources: PillowSourceAllocation[];
}

export interface PersonWithFamily extends Person {
  familyName: string;
}

export interface BedView {
  bed: Bed;
  occupants: PersonWithFamily[];
  room: Room | null;
  typeLabel: string;
  occupantSummary: string;
}

export type SourceBalanceStatus = 'balanced' | 'needs_sourcing' | 'over_allocated';

export interface LinenCountSummary {
  required: number;
  allocated: number;
  remainingNeeded: number;
  overAllocated: number;
  delta: number;
  status: SourceBalanceStatus;
}

export interface LinenSizeReport {
  size: string;
  physicalBedsCount: number;
  occupantCount: number;
  sheets: LinenCountSummary;
  blankets: LinenCountSummary;
  throws: LinenCountSummary;
  sources: LinenSourceAllocation[];
  allBalanced: boolean;
}

export interface OverallLinenSummary {
  totalSheetsRequired: number;
  totalSheetsAllocated: number;
  totalBlanketsRequired: number;
  totalBlanketsAllocated: number;
  totalThrowsRequired: number;
  totalThrowsAllocated: number;
  balancedSizesCount: number;
  totalSizesCount: number;
  allLinensBalanced: boolean;
  unmappedPeopleCount: number;
}

export interface BedTypeReport {
  bedTypeKey: string;
  label: string;
  size: string;
  kind: BedKind;
  requiredCount: number;
  occupantCount: number;
  beds: BedView[];
  sources: SourceAllocation[];
  allocatedCount: number;
  remainingNeeded: number;
  overAllocated: number;
  delta: number;
  status: SourceBalanceStatus;
}

export interface OverallInventorySummary {
  totalPhysicalBeds: number;
  totalAllocatedBeds: number;
  totalPeople: number;
  totalPeopleWithBeds: number;
  totalPeopleWithoutBeds: number;
  unplacedBedsCount: number;
  balancedGroupsCount: number;
  unbalancedGroupsCount: number;
  allSourcesBalanced: boolean;
}

export interface RoomPillowCount {
  roomId: string | null;
  roomName: string;
  roomNotes: string;
  pillowsRequired: number;
  bedCount: number;
  occupantCount: number;
  excludedPackAndPlayCount: number;
}

export interface PillowReport {
  totalRequired: number;
  totalAllocated: number;
  remainingNeeded: number;
  overAllocated: number;
  delta: number;
  status: SourceBalanceStatus;
  byRoom: RoomPillowCount[];
  sources: PillowSourceAllocation[];
}

export interface RoomSummary {
  room: Room;
  beds: BedView[];
  occupantCount: number;
  pillowsRequired: number;
}

export interface FamilyAssignmentRow {
  person: Person;
  bed: Bed | null;
  bedTypeLabel: string;
  sharedWith: string[];
  room: Room | null;
  roomName: string;
  roomNotes: string;
}

export interface FamilySummary {
  family: Family;
  rows: FamilyAssignmentRow[];
  memberCount: number;
  bedsAssignedCount: number;
  roomsUsed: string[];
}

export type SheetTabName =
  | 'EventMeta'
  | 'Families'
  | 'People'
  | 'Beds'
  | 'Rooms'
  | 'BedSources'
  | 'LinenSources'
  | 'PillowSources';
