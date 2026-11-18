import React, { useMemo, useState } from 'react';
import { Check, Copy, Printer, Search, Users } from 'lucide-react';
import { computeFamilySummaries } from '../domain/plannerMath';
import { PlannerState } from '../domain/types';

interface FamilySummaryViewProps {
  state: PlannerState;
  readOnly?: boolean;
}

export const FamilySummaryView: React.FC<FamilySummaryViewProps> = ({
  state,
  readOnly = false,
}) => {
  const summaries = useMemo(() => computeFamilySummaries(state), [state]);
  const [filterText, setFilterText] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  const query = filterText.trim().toLowerCase();
  const visibleSummaries = useMemo(() => {
    if (!query) return summaries;
    return summaries.filter((s) => {
      if (s.family.name.toLowerCase().includes(query)) return true;
      return s.rows.some(
        (r) =>
          r.person.name.toLowerCase().includes(query) ||
          r.roomName.toLowerCase().includes(query) ||
          r.bedTypeLabel.toLowerCase().includes(query)
      );
    });
  }, [summaries, query]);

  const handleCopyPlainText = async () => {
    const lines: string[] = [
      `${state.eventName} — Sleeping Assignments by Family`,
      '='.repeat(48),
      '',
    ];
    for (const fam of visibleSummaries) {
      lines.push(
        `${fam.family.name} (${fam.memberCount} guests · ${fam.bedsAssignedCount} beds)`
      );
      for (const row of fam.rows) {
        const sharedPart =
          row.sharedWith.length > 0
            ? ` (sharing with ${row.sharedWith.join(', ')})`
            : '';
        const blanketPart =
          row.bed?.kind === 'Pack & Play'
            ? ' [No blanket or pillow]'
            : ` [${
                row.bed?.blanketType ?? row.person.blanketType ?? 'Regular Blanket'
              }]`;
        const notePart = row.person.notes ? ` — Note: ${row.person.notes}` : '';
        lines.push(
          `  • ${row.person.name}: ${row.bedTypeLabel}${sharedPart}${blanketPart} → ${row.roomName}${notePart}`
        );
      }
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#8E867B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by family, guest, or room..."
            className="w-full rounded-lg border border-[#D5CEC3] bg-white pl-9 pr-3 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPlainText}
            disabled={visibleSummaries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedText ? (
              <Check className="w-3.5 h-3.5 text-[#486B56]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#635D54]" />
            )}
            {copiedText ? 'Copied Summary' : 'Copy Text Summary'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={visibleSummaries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-[#635D54]" />
            Print
          </button>
        </div>
      </div>

      {/* Print Title */}
      <div className="hidden print:block mb-4">
        <h1
          className="text-2xl font-semibold text-[#1F1D1A]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {state.eventName} — Sleeping Assignments by Family
        </h1>
      </div>

      {visibleSummaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D5CEC3] bg-white p-10 text-center max-w-xl mx-auto">
          <Users className="w-8 h-8 text-[#486B56] mx-auto mb-3" />
          <h2
            className="text-xl font-semibold text-[#1F1D1A]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {readOnly ? 'No sleeping assignments yet' : 'Nothing to summarize yet'}
          </h2>
          <p className="mt-1.5 text-sm text-[#635D54]">
            {readOnly
              ? 'Sleeping assignments by family will appear here once added to this plan.'
              : 'Add families, map guests to beds, and assign rooms to generate the family-by-family itinerary.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleSummaries.map((fam) => (
            <section
              key={fam.family.id}
              className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden break-inside-avoid"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#E2DBD0] bg-[#FAF8F5] px-5 py-3.5">
                <h2
                  className="text-lg font-semibold text-[#1F1D1A]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {fam.family.name}
                </h2>
                <p className="text-xs text-[#635D54] tabular-nums">
                  {fam.memberCount}{' '}
                  {fam.memberCount === 1 ? 'member' : 'members'} ·{' '}
                  {fam.bedsAssignedCount}{' '}
                  {fam.bedsAssignedCount === 1 ? 'bed' : 'beds'}
                  {fam.roomsUsed.length > 0
                    ? ` · ${fam.roomsUsed.join(', ')}`
                    : ''}
                </p>
              </div>

              {fam.rows.length === 0 ? (
                <div className="px-5 py-4 text-sm text-[#635D54]">
                  No guests listed in this family.
                </div>
              ) : (() => {
                const showNotesColumn =
                  !readOnly || fam.rows.some((r) => Boolean(r.person.notes.trim()));
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#EFEAE2] text-xs font-medium text-[#635D54]">
                          <th className="py-2.5 pl-5 pr-3">Guest</th>
                          <th className="py-2.5 px-3">Bed &amp; Blanket</th>
                          <th className={`py-2.5 px-3 ${showNotesColumn ? '' : 'pr-5'}`}>
                            Room
                          </th>
                          {showNotesColumn && (
                            <th className="py-2.5 pl-3 pr-5">Notes</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFEAE2] text-sm">
                        {fam.rows.map((row) => (
                          <tr key={row.person.id}>
                            <td className="py-3 pl-5 pr-3 font-semibold text-[#1F1D1A] align-top">
                              {row.person.name}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <p
                                className={
                                  row.bed
                                    ? 'text-[#1F1D1A] font-medium'
                                    : 'text-[#A36A1F] font-medium'
                                }
                              >
                                {row.bedTypeLabel}
                                {row.bed?.customLabel
                                  ? ` (${row.bed.customLabel})`
                                  : ''}
                              </p>
                              <p className="text-xs text-[#635D54] mt-0.5">
                                {row.bed?.kind === 'Pack & Play'
                                  ? 'No blanket or pillow'
                                  : row.bed?.blanketType ??
                                    row.person.blanketType ??
                                    'Regular Blanket'}
                                {row.sharedWith.length > 0
                                  ? ` · Shared with ${row.sharedWith.join(', ')}`
                                  : ''}
                              </p>
                            </td>
                            <td
                              className={`py-3 px-3 align-top ${
                                showNotesColumn ? '' : 'pr-5'
                              }`}
                            >
                              <p
                                className={
                                  row.room
                                    ? 'text-[#1F1D1A] font-medium'
                                    : 'text-[#A36A1F]'
                                }
                              >
                                {row.roomName}
                              </p>
                              {row.roomNotes && (
                                <p className="text-xs text-[#635D54] mt-0.5">
                                  {row.roomNotes}
                                </p>
                              )}
                            </td>
                            {showNotesColumn && (
                              <td className="py-3 pl-3 pr-5 text-xs text-[#635D54] align-top">
                                {row.person.notes || '—'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
