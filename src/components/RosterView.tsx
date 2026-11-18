import React, { useMemo, useState } from 'react';
import {
  BedDouble,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { computeBedViews } from '../domain/plannerMath';
import {
  ALL_BLANKET_TYPES,
  BedKind,
  BedView,
  BlanketType,
  Person,
  PlannerState,
} from '../domain/types';
import { BedSelectorModal } from './BedSelectorModal';

interface RosterViewProps {
  state: PlannerState;
  readOnly: boolean;
  onAddFamily: (name: string) => void;
  onUpdateFamily: (familyId: string, name: string) => void;
  onRemoveFamily: (familyId: string) => void;
  onAddPerson: (
    familyId: string,
    name: string,
    notes: string,
    blanketType: BlanketType
  ) => void;
  onUpdatePerson: (
    personId: string,
    patch: Partial<Pick<Person, 'name' | 'notes' | 'blanketType'>>
  ) => void;
  onRemovePerson: (personId: string) => void;
  onAssignNewBed: (
    personId: string,
    size: string,
    kind: BedKind,
    customLabel: string
  ) => void;
  onUpdateBed: (
    bedId: string,
    size: string,
    kind: BedKind,
    customLabel: string
  ) => void;
  onJoinSharedBed: (personId: string, targetBedId: string) => void;
  onUnassignBed: (personId: string) => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  state,
  readOnly,
  onAddFamily,
  onUpdateFamily,
  onRemoveFamily,
  onAddPerson,
  onUpdatePerson,
  onRemovePerson,
  onAssignNewBed,
  onUpdateBed,
  onJoinSharedBed,
  onUnassignBed,
}) => {
  const [newFamilyName, setNewFamilyName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newPersonDrafts, setNewPersonDrafts] = useState<
    Record<string, { name: string; notes: string; blanketType: BlanketType }>
  >({});
  const [confirmDeleteFamilyId, setConfirmDeleteFamilyId] = useState<string | null>(
    null
  );
  const [editingBedPersonId, setEditingBedPersonId] = useState<string | null>(
    null
  );

  const bedViews = useMemo(() => computeBedViews(state), [state]);
  const bedViewById = useMemo(
    () => new Map<string, BedView>(bedViews.map((bv) => [bv.bed.id, bv])),
    [bedViews]
  );

  const sortedFamilies = useMemo(
    () => [...state.families].sort((a, b) => a.sortOrder - b.sortOrder),
    [state.families]
  );

  const query = searchQuery.trim().toLowerCase();

  const filteredFamilies = useMemo(() => {
    if (!query) return sortedFamilies;
    return sortedFamilies.filter((fam) => {
      if (fam.name.toLowerCase().includes(query)) return true;
      return state.people
        .filter((p) => p.familyId === fam.id)
        .some(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.notes.toLowerCase().includes(query)
        );
    });
  }, [sortedFamilies, state.people, query]);

  const handleCreateFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    onAddFamily(newFamilyName.trim());
    setNewFamilyName('');
  };

  const handleAddMember = (e: React.FormEvent, familyId: string) => {
    e.preventDefault();
    const draft = newPersonDrafts[familyId] ?? {
      name: '',
      notes: '',
      blanketType: 'Regular Blanket' as BlanketType,
    };
    if (!draft.name.trim()) return;
    onAddPerson(
      familyId,
      draft.name.trim(),
      draft.notes.trim(),
      draft.blanketType
    );
    setNewPersonDrafts((prev) => ({
      ...prev,
      [familyId]: {
        name: '',
        notes: '',
        blanketType: 'Regular Blanket',
      },
    }));
  };

  const editingPerson = editingBedPersonId
    ? state.people.find((p) => p.id === editingBedPersonId) ?? null
    : null;
  const editingFamily = editingPerson
    ? state.families.find((f) => f.id === editingPerson.familyId) ?? null
    : null;
  const editingCurrentBed =
    editingPerson?.bedId ? bedViewById.get(editingPerson.bedId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Add Family + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {!readOnly ? (
          <form
            onSubmit={handleCreateFamily}
            className="flex flex-1 max-w-md items-center gap-2"
          >
            <input
              type="text"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder="Add family name (e.g., Johnson Family)"
              className="flex-1 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Family
            </button>
          </form>
        ) : (
          <div />
        )}

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#8E867B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter families or guests..."
            className="w-full rounded-lg border border-[#D5CEC3] bg-white pl-9 pr-3 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
          />
        </div>
      </div>

      {/* Empty State */}
      {state.families.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D5CEC3] bg-white p-10 text-center max-w-xl mx-auto">
          <Users className="w-8 h-8 text-[#486B56] mx-auto mb-3" />
          <h2
            className="text-xl font-semibold text-[#1F1D1A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {readOnly ? 'No families listed yet' : 'Start by adding your first family'}
          </h2>
          <p className="mt-1.5 text-sm text-[#635D54]">
            {readOnly
              ? 'Guests and sleeping assignments will appear here once added to this plan.'
              : 'Group guests by household or family, add personal notes, and map each person to a real mattress, air mattress, toddler bed, or pack & play.'}
          </p>
        </div>
      ) : filteredFamilies.length === 0 ? (
        <div className="rounded-xl border border-[#E2DBD0] bg-white p-8 text-center text-sm text-[#635D54]">
          No families or guests matched &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredFamilies.map((family) => {
            const members = state.people.filter((p) => p.familyId === family.id);
            const distinctBeds = new Set(
              members.map((m) => m.bedId).filter(Boolean)
            );
            const draft = newPersonDrafts[family.id] ?? {
              name: '',
              notes: '',
              blanketType: 'Regular Blanket' as BlanketType,
            };
            const isConfirmingDelete = confirmDeleteFamilyId === family.id;
            const showNotesColumn =
              !readOnly || members.some((m) => Boolean(m.notes.trim()));

            return (
              <section
                key={family.id}
                className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden"
              >
                {/* Family Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DBD0] bg-[#FAF8F5] px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline gap-3 min-w-0 flex-1">
                    {readOnly ? (
                      <h3
                        className="text-lg font-semibold text-[#1F1D1A]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {family.name}
                      </h3>
                    ) : (
                      <input
                        type="text"
                        defaultValue={family.name}
                        key={family.id + family.name}
                        onBlur={(e) => {
                          if (
                            e.target.value.trim() &&
                            e.target.value.trim() !== family.name
                          ) {
                            onUpdateFamily(family.id, e.target.value);
                          }
                        }}
                        aria-label="Family name"
                        className="text-lg font-semibold text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-0.5 -ml-2 focus:outline-none min-w-[180px]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      />
                    )}
                    <span className="text-xs text-[#635D54] tabular-nums whitespace-nowrap">
                      {members.length}{' '}
                      {members.length === 1 ? 'person' : 'people'} ·{' '}
                      {distinctBeds.size}{' '}
                      {distinctBeds.size === 1 ? 'bed' : 'beds'}
                    </span>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#7E3724]">Remove family?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveFamily(family.id);
                              setConfirmDeleteFamilyId(null);
                            }}
                            className="rounded-md bg-[#B85D43] px-2.5 py-1 font-medium text-white hover:bg-[#9C4C35] cursor-pointer"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFamilyId(null)}
                            className="rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1 font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (members.length === 0) {
                              onRemoveFamily(family.id);
                            } else {
                              setConfirmDeleteFamilyId(family.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#635D54] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Members List */}
                <div className="divide-y divide-[#EFEAE2]">
                  {members.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-[#635D54]">
                      No guests added to {family.name} yet.
                    </div>
                  ) : (
                    members.map((person) => {
                      const bedView = person.bedId
                        ? bedViewById.get(person.bedId) ?? null
                        : null;
                      const bedMates = bedView
                        ? bedView.occupants.filter((o) => o.id !== person.id)
                        : [];

                      return (
                        <div
                          key={person.id}
                          className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-center px-5 py-3 hover:bg-[#FAF8F5]/70 transition-colors"
                        >
                          {/* Guest Name */}
                          <div
                            className={`min-w-0 ${
                              readOnly && !showNotesColumn
                                ? 'lg:col-span-4'
                                : 'lg:col-span-3'
                            }`}
                          >
                            {readOnly ? (
                              <p className="text-sm font-semibold text-[#1F1D1A]">
                                {person.name}
                              </p>
                            ) : (
                              <input
                                type="text"
                                defaultValue={person.name}
                                key={person.id + person.name}
                                onBlur={(e) => {
                                  if (
                                    e.target.value.trim() &&
                                    e.target.value.trim() !== person.name
                                  ) {
                                    onUpdatePerson(person.id, {
                                      name: e.target.value.trim(),
                                    });
                                  }
                                }}
                                aria-label={`Guest name for ${person.name}`}
                                className="w-full text-sm font-semibold text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-1 -ml-2 focus:outline-none"
                              />
                            )}
                          </div>

                          {/* Person Notes */}
                          {showNotesColumn && (
                            <div
                              className={`min-w-0 ${
                                readOnly ? 'lg:col-span-3' : 'lg:col-span-2'
                              }`}
                            >
                              {readOnly ? (
                                <p className="text-xs text-[#635D54]">
                                  {person.notes || '—'}
                                </p>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={person.notes}
                                  key={person.id + '_notes_' + person.notes}
                                  onBlur={(e) => {
                                    if (e.target.value !== person.notes) {
                                      onUpdatePerson(person.id, {
                                        notes: e.target.value,
                                      });
                                    }
                                  }}
                                  placeholder="Add guest note..."
                                  aria-label={`Notes for ${person.name}`}
                                  className="w-full text-xs text-[#4A453E] placeholder:text-[#9E968B] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-1 -ml-2 focus:outline-none"
                                />
                              )}
                            </div>
                          )}

                          {/* Blanket Type Dropdown */}
                          <div
                            className={`min-w-0 ${
                              readOnly && !showNotesColumn
                                ? 'lg:col-span-3'
                                : 'lg:col-span-2'
                            }`}
                          >
                            {bedView?.bed.kind === 'Pack & Play' ? (
                              <p className="text-xs text-[#635D54]">
                                No blanket or pillow (Pack &amp; Play)
                              </p>
                            ) : readOnly ? (
                              <p className="text-xs text-[#4A453E]">
                                {bedView?.bed.blanketType ??
                                  person.blanketType ??
                                  'Regular Blanket'}
                              </p>
                            ) : (
                              <div>
                                <select
                                  value={
                                    bedView?.bed.blanketType ??
                                    person.blanketType ??
                                    'Regular Blanket'
                                  }
                                  onChange={(e) =>
                                    onUpdatePerson(person.id, {
                                      blanketType: e.target.value as BlanketType,
                                    })
                                  }
                                  aria-label={`Blanket type for ${person.name}`}
                                  className="w-full rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-medium text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none cursor-pointer"
                                >
                                  {ALL_BLANKET_TYPES.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                                {bedMates.length > 0 && (
                                  <p className="mt-0.5 text-[11px] text-[#8E867B]">
                                    1 blanket for shared bed
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bed Mapping Info */}
                          <div
                            className={`min-w-0 ${
                              readOnly
                                ? showNotesColumn
                                  ? 'lg:col-span-4'
                                  : 'lg:col-span-5'
                                : 'lg:col-span-3'
                            }`}
                          >
                            {bedView ? (
                              <div className="text-sm">
                                <span className="font-medium text-[#1F1D1A]">
                                  {bedView.typeLabel}
                                </span>
                                {bedView.bed.customLabel && (
                                  <span className="text-xs text-[#635D54]">
                                    {' '}
                                    · {bedView.bed.customLabel}
                                  </span>
                                )}
                                <p className="text-xs text-[#635D54] truncate">
                                  {bedMates.length > 0
                                    ? `Shared with ${bedMates
                                        .map((m) => m.name)
                                        .join(', ')}`
                                    : 'Individual bed'}
                                  {' · '}
                                  {bedView.room
                                    ? bedView.room.name
                                    : 'Room unassigned'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-[#A36A1F]">
                                No bed assigned yet
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          {!readOnly && (
                            <div className="lg:col-span-2 flex items-center lg:justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingBedPersonId(person.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                  bedView
                                    ? 'border-[#D5CEC3] bg-white text-[#1F1D1A] hover:bg-[#F2EDE5]'
                                    : 'border-[#486B56] bg-[#EEF3EF] text-[#2A4535] hover:bg-[#E1EBE3]'
                                }`}
                              >
                                <BedDouble className="w-3.5 h-3.5" />
                                {bedView ? 'Change Bed' : 'Map Bed'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemovePerson(person.id)}
                                className="rounded-md p-1.5 text-[#8E867B] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                                aria-label={`Remove ${person.name}`}
                                title={`Remove ${person.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Guest Form */}
                {!readOnly && (
                  <form
                    onSubmit={(e) => handleAddMember(e, family.id)}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-[#EFEAE2] bg-[#FAF8F5]/60 px-5 py-3"
                  >
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) =>
                        setNewPersonDrafts((prev) => ({
                          ...prev,
                          [family.id]: { ...draft, name: e.target.value },
                        }))
                      }
                      placeholder={`Add person to ${family.name}...`}
                      className="sm:w-52 rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) =>
                        setNewPersonDrafts((prev) => ({
                          ...prev,
                          [family.id]: { ...draft, notes: e.target.value },
                        }))
                      }
                      placeholder="Optional note (arrival time, preferences...)"
                      className="flex-1 rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
                    />
                    <select
                      value={draft.blanketType}
                      onChange={(e) =>
                        setNewPersonDrafts((prev) => ({
                          ...prev,
                          [family.id]: {
                            ...draft,
                            blanketType: e.target.value as BlanketType,
                          },
                        }))
                      }
                      aria-label="New guest blanket type"
                      className="sm:w-40 rounded-lg border border-[#D5CEC3] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1F1D1A] focus:border-[#486B56] focus:outline-none cursor-pointer"
                    >
                      {ALL_BLANKET_TYPES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#486B56]" />
                      Add Person
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editingPerson && !readOnly && (
        <BedSelectorModal
          person={editingPerson}
          familyName={editingFamily?.name ?? 'Family'}
          currentBed={editingCurrentBed}
          availableBeds={bedViews}
          onClose={() => setEditingBedPersonId(null)}
          onAssignNewBed={(size, kind, label) =>
            onAssignNewBed(editingPerson.id, size, kind, label)
          }
          onUpdateExistingBed={(bedId, size, kind, label) =>
            onUpdateBed(bedId, size, kind, label)
          }
          onJoinSharedBed={(targetBedId) =>
            onJoinSharedBed(editingPerson.id, targetBedId)
          }
          onUnassignBed={() => onUnassignBed(editingPerson.id)}
        />
      )}
    </div>
  );
};
