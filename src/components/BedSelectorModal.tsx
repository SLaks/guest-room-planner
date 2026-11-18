import React, { useMemo, useState } from 'react';
import { BedDouble, Users, X } from 'lucide-react';
import { formatBedTypeLabel } from '../domain/plannerMath';
import {
  BedKind,
  BedView,
  MATTRESS_SIZES,
  Person,
} from '../domain/types';

interface BedSelectorModalProps {
  person: Person;
  familyName: string;
  currentBed: BedView | null;
  availableBeds: BedView[];
  onClose: () => void;
  onAssignNewBed: (size: string, kind: BedKind, customLabel: string) => void;
  onUpdateExistingBed: (bedId: string, size: string, kind: BedKind, customLabel: string) => void;
  onJoinSharedBed: (targetBedId: string) => void;
  onUnassignBed: () => void;
}

export const BedSelectorModal: React.FC<BedSelectorModalProps> = ({
  person,
  familyName,
  currentBed,
  availableBeds,
  onClose,
  onAssignNewBed,
  onUpdateExistingBed,
  onJoinSharedBed,
  onUnassignBed,
}) => {
  const otherBeds = useMemo(
    () => availableBeds.filter((bv) => bv.bed.id !== currentBed?.bed.id),
    [availableBeds, currentBed]
  );

  const [mode, setMode] = useState<'new' | 'share'>('new');
  const [kind, setKind] = useState<BedKind>(currentBed?.bed.kind ?? 'Real Mattress');
  const initialSize = currentBed?.bed.size ?? 'Twin';
  const isPresetSize = (MATTRESS_SIZES as string[]).includes(initialSize);
  const [sizeSelection, setSizeSelection] = useState<string>(
    isPresetSize ? initialSize : 'Custom'
  );
  const [customSize, setCustomSize] = useState<string>(
    isPresetSize ? '' : initialSize
  );
  const [customLabel, setCustomLabel] = useState<string>(
    currentBed?.bed.customLabel ?? ''
  );

  const isSoleOccupant = currentBed !== null && currentBed.occupants.length === 1;
  const isSharedBed = currentBed !== null && currentBed.occupants.length > 1;

  const resolvedSize =
    kind === 'Pack & Play'
      ? 'Pack & Play'
      : kind === 'Toddler Bed'
      ? 'Toddler'
      : sizeSelection === 'Custom'
      ? customSize.trim() || 'Queen'
      : sizeSelection;

  const handleSaveNewOrUpdate = (e: React.FormEvent, updateInPlace: boolean) => {
    e.preventDefault();
    if (updateInPlace && currentBed) {
      onUpdateExistingBed(currentBed.bed.id, resolvedSize, kind, customLabel);
    } else {
      onAssignNewBed(resolvedSize, kind, customLabel);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D1A]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bed-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#D5CEC3] bg-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2DBD0] bg-[#FAF8F5] px-5 py-4">
          <div>
            <p className="text-xs font-medium text-[#635D54]">{familyName}</p>
            <h2
              id="bed-modal-title"
              className="text-lg font-semibold text-[#1F1D1A]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Bed assignment for {person.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#635D54] hover:bg-[#EAE3D8] hover:text-[#1F1D1A] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {currentBed && (
            <div className="rounded-lg border border-[#E2DBD0] bg-[#FAF8F5] px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-[#1F1D1A]">
                  Current: {currentBed.typeLabel}
                </p>
                <p className="text-xs text-[#635D54] truncate">
                  {isSharedBed
                    ? `Shared with ${currentBed.occupants
                        .filter((o) => o.id !== person.id)
                        .map((o) => o.name)
                        .join(', ')}`
                    : 'Individual bed'}
                  {currentBed.room ? ` · ${currentBed.room.name}` : ' · Unassigned room'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUnassignBed();
                  onClose();
                }}
                className="text-xs font-medium text-[#B85D43] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Remove from bed
              </button>
            </div>
          )}

          {/* Mode Tabs: Individual/New Bed vs Share Existing Bed */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F2EDE5] p-1">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'new'
                  ? 'bg-white text-[#1F1D1A] shadow-xs'
                  : 'text-[#635D54] hover:text-[#1F1D1A]'
              }`}
            >
              <BedDouble className="w-3.5 h-3.5" />
              {isSoleOccupant ? 'Bed Type / New Bed' : 'Assign Individual Bed'}
            </button>
            <button
              type="button"
              onClick={() => setMode('share')}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'share'
                  ? 'bg-white text-[#1F1D1A] shadow-xs'
                  : 'text-[#635D54] hover:text-[#1F1D1A]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Share Existing Bed ({otherBeds.length})
            </button>
          </div>

          {mode === 'new' ? (
            <form
              onSubmit={(e) => handleSaveNewOrUpdate(e, isSoleOccupant)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-[#635D54] mb-1.5">
                  Mattress / Bed Kind
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      'Real Mattress',
                      'Air Mattress',
                      'Toddler Bed',
                      'Pack & Play',
                    ] as BedKind[]
                  ).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setKind(option)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                        kind === option
                          ? 'border-[#486B56] bg-[#EEF3EF] text-[#2A4535]'
                          : 'border-[#E2DBD0] bg-white text-[#1F1D1A] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {(kind === 'Real Mattress' || kind === 'Air Mattress') && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-medium text-[#635D54]">
                    {kind === 'Air Mattress' ? 'Air Mattress Size' : 'Mattress Size'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[...MATTRESS_SIZES, 'Custom'].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSizeSelection(sz)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                          sizeSelection === sz
                            ? 'border-[#486B56] bg-[#EEF3EF] text-[#2A4535]'
                            : 'border-[#E2DBD0] bg-white text-[#1F1D1A] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  {sizeSelection === 'Custom' && (
                    <input
                      type="text"
                      value={customSize}
                      onChange={(e) => setCustomSize(e.target.value)}
                      placeholder="e.g., Twin XL, California King, Cot, Sofa Bed"
                      className="w-full rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                    />
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="bed-custom-label"
                  className="block text-xs font-medium text-[#635D54] mb-1.5"
                >
                  Optional Bed Note (e.g. &ldquo;Double-high&rdquo;, &ldquo;Bunk top&rdquo;)
                </label>
                <input
                  id="bed-custom-label"
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Optional label shown on room cards"
                  className="w-full rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-[#E2DBD0] bg-[#FAF8F5] px-3.5 py-2.5 text-xs text-[#635D54]">
                Preview:{' '}
                <span className="font-semibold text-[#1F1D1A]">
                  {formatBedTypeLabel(resolvedSize, kind)}
                </span>
                {customLabel.trim() ? ` (${customLabel.trim()})` : ''}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E2DBD0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#D5CEC3] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {isSharedBed && (
                  <button
                    type="button"
                    onClick={(e) => handleSaveNewOrUpdate(e, true)}
                    className="rounded-lg border border-[#486B56] bg-[#EEF3EF] px-3.5 py-2 text-sm font-medium text-[#2A4535] hover:bg-[#E1EBE3] transition-colors cursor-pointer"
                  >
                    Change Shared Bed Type
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] transition-colors cursor-pointer"
                >
                  {isSoleOccupant
                    ? 'Save Bed Type'
                    : isSharedBed
                    ? `Split ${person.name} onto Own Bed`
                    : 'Assign Bed'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#635D54]">
                Pick an existing bed below so {person.name} shares that physical mattress instead of counting as an extra bed.
              </p>

              {otherBeds.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D5CEC3] bg-[#FAF8F5] p-6 text-center text-sm text-[#635D54]">
                  No other beds have been created yet. Assign someone else to a bed first, then share it here.
                </div>
              ) : (
                <div className="divide-y divide-[#EFEAE2] rounded-lg border border-[#E2DBD0] overflow-hidden">
                  {otherBeds.map((bv) => {
                    const sameFamily = bv.occupants.some(
                      (o) => o.familyId === person.familyId
                    );
                    return (
                      <button
                        key={bv.bed.id}
                        type="button"
                        onClick={() => {
                          onJoinSharedBed(bv.bed.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between gap-3 bg-white px-3.5 py-3 text-left hover:bg-[#EEF3EF]/60 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1F1D1A] truncate">
                            {bv.typeLabel}
                            {bv.bed.customLabel ? ` · ${bv.bed.customLabel}` : ''}
                          </p>
                          <p className="text-xs text-[#635D54] truncate">
                            Currently: {bv.occupantSummary}
                            {sameFamily ? ' · Same family' : ''}
                            {bv.room ? ` · ${bv.room.name}` : ' · Unassigned room'}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-[#486B56] whitespace-nowrap shrink-0">
                          Share bed
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
