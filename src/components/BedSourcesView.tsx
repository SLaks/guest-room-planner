import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Minus,
  PackageCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  computeBedTypeReports,
  computeLinenSizeReports,
  computeOverallInventorySummary,
  computeOverallLinenSummary,
  computePillowReport,
} from '../domain/plannerMath';
import {
  LinenCountSummary,
  LinenSourceAllocation,
  PillowSourceAllocation,
  PlannerState,
  SourceAllocation,
} from '../domain/types';

interface BedSourcesViewProps {
  state: PlannerState;
  readOnly: boolean;
  onAddSource: (bedTypeKey: string, sourceName: string, quantity: number) => void;
  onUpdateSource: (
    sourceId: string,
    patch: Partial<Pick<SourceAllocation, 'sourceName' | 'quantity'>>
  ) => void;
  onRemoveSource: (sourceId: string) => void;
  onAddLinenSource: (
    size: string,
    sourceName: string,
    counts: { sheets: number; blankets: number; throws: number }
  ) => void;
  onUpdateLinenSource: (
    linenSourceId: string,
    patch: Partial<
      Pick<LinenSourceAllocation, 'sourceName' | 'sheets' | 'blankets' | 'throws'>
    >
  ) => void;
  onRemoveLinenSource: (linenSourceId: string) => void;
  onAddPillowSource: (sourceName: string, quantity: number) => void;
  onUpdatePillowSource: (
    pillowSourceId: string,
    patch: Partial<Pick<PillowSourceAllocation, 'sourceName' | 'quantity'>>
  ) => void;
  onRemovePillowSource: (pillowSourceId: string) => void;
}

function renderLinenStatusText(label: string, summary: LinenCountSummary) {
  if (summary.status === 'balanced') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2E4A39] tabular-nums">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#486B56] shrink-0" />
        {label}: {summary.allocated}/{summary.required}
      </span>
    );
  }
  if (summary.status === 'needs_sourcing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6E4510] tabular-nums">
        <AlertCircle className="w-3.5 h-3.5 text-[#A36A1F] shrink-0" />
        {label}: {summary.allocated}/{summary.required} ({summary.remainingNeeded}{' '}
        needed)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1B3324] tabular-nums">
      <CheckCheck className="w-3.5 h-3.5 text-[#22422E] shrink-0" />
      {label}: {summary.allocated}/{summary.required} ({summary.overAllocated}{' '}
      extra)
    </span>
  );
}

export const BedSourcesView: React.FC<BedSourcesViewProps> = ({
  state,
  readOnly,
  onAddSource,
  onUpdateSource,
  onRemoveSource,
  onAddLinenSource,
  onUpdateLinenSource,
  onRemoveLinenSource,
  onAddPillowSource,
  onUpdatePillowSource,
  onRemovePillowSource,
}) => {
  const reports = useMemo(() => computeBedTypeReports(state), [state]);
  const summary = useMemo(
    () => computeOverallInventorySummary(state, reports),
    [state, reports]
  );

  const linenReports = useMemo(() => computeLinenSizeReports(state), [state]);
  const linenSummary = useMemo(
    () => computeOverallLinenSummary(state, linenReports),
    [state, linenReports]
  );

  const pillowReport = useMemo(() => computePillowReport(state), [state]);

  const hasMissingBeds = reports.some((r) => r.status === 'needs_sourcing');
  const hasExtraBeds = reports.some((r) => r.status === 'over_allocated');
  const coveredBedGroupsCount = reports.filter(
    (r) => r.status !== 'needs_sourcing'
  ).length;
  const hasMissingLinens = linenReports.some(
    (lr) =>
      lr.sheets.status === 'needs_sourcing' ||
      lr.blankets.status === 'needs_sourcing' ||
      lr.throws.status === 'needs_sourcing'
  );
  const hasExtraLinens = linenReports.some(
    (lr) =>
      lr.sheets.status === 'over_allocated' ||
      lr.blankets.status === 'over_allocated' ||
      lr.throws.status === 'over_allocated'
  );
  const coveredLinenSizesCount = linenReports.filter(
    (lr) =>
      lr.sheets.status !== 'needs_sourcing' &&
      lr.blankets.status !== 'needs_sourcing' &&
      lr.throws.status !== 'needs_sourcing'
  ).length;
  const hasMissingPillows = pillowReport.status === 'needs_sourcing';
  const hasExtraPillows = pillowReport.status === 'over_allocated';

  const [sourceDrafts, setSourceDrafts] = useState<
    Record<string, { name: string; quantity: string }>
  >({});

  const [linenDrafts, setLinenDrafts] = useState<
    Record<
      string,
      { name: string; sheets: string; blankets: string; throws: string }
    >
  >({});

  const [pillowDraft, setPillowDraft] = useState<{
    name: string;
    quantity: string;
  } | null>(null);

  const [collapsedSections, setCollapsedSections] = useState<{
    beds: boolean;
    linens: boolean;
    pillows: boolean;
  }>({
    beds: false,
    linens: false,
    pillows: false,
  });

  const [collapsedBedGroups, setCollapsedBedGroups] = useState<
    Record<string, boolean>
  >({});

  const [collapsedLinenSizes, setCollapsedLinenSizes] = useState<
    Record<string, boolean>
  >({});

  const [collapsedPillowGroups, setCollapsedPillowGroups] = useState<{
    byRoom: boolean;
    sources: boolean;
  }>({
    byRoom: false,
    sources: false,
  });

  const toggleSection = (section: 'beds' | 'linens' | 'pillows') => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleBedGroup = (bedTypeKey: string) => {
    setCollapsedBedGroups((prev) => ({
      ...prev,
      [bedTypeKey]: !prev[bedTypeKey],
    }));
  };

  const toggleLinenSize = (size: string) => {
    setCollapsedLinenSizes((prev) => ({
      ...prev,
      [size]: !prev[size],
    }));
  };

  const togglePillowGroup = (key: 'byRoom' | 'sources') => {
    setCollapsedPillowGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allBedGroupsCollapsed =
    reports.length > 0 &&
    reports.every((report) => Boolean(collapsedBedGroups[report.bedTypeKey]));

  const toggleAllBedGroups = () => {
    const nextState = !allBedGroupsCollapsed;
    const next: Record<string, boolean> = {};
    for (const report of reports) {
      next[report.bedTypeKey] = nextState;
    }
    setCollapsedBedGroups(next);
  };

  const allLinenSizesCollapsed =
    linenReports.length > 0 &&
    linenReports.every((lr) => Boolean(collapsedLinenSizes[lr.size]));

  const toggleAllLinenSizes = () => {
    const nextState = !allLinenSizesCollapsed;
    const next: Record<string, boolean> = {};
    for (const lr of linenReports) {
      next[lr.size] = nextState;
    }
    setCollapsedLinenSizes(next);
  };

  const allPillowGroupsCollapsed =
    collapsedPillowGroups.byRoom && collapsedPillowGroups.sources;

  const toggleAllPillowGroups = () => {
    const nextState = !allPillowGroupsCollapsed;
    setCollapsedPillowGroups({
      byRoom: nextState,
      sources: nextState,
    });
  };

  const handleAddSource = (
    e: React.FormEvent,
    bedTypeKey: string,
    defaultQty: number
  ) => {
    e.preventDefault();
    const draft = sourceDrafts[bedTypeKey] ?? {
      name: '',
      quantity: String(Math.max(1, defaultQty)),
    };
    if (!draft.name.trim()) return;
    const qty = Math.max(0, Math.floor(Number(draft.quantity) || 0));
    onAddSource(bedTypeKey, draft.name.trim(), qty);
    setSourceDrafts((prev) => ({
      ...prev,
      [bedTypeKey]: { name: '', quantity: '' },
    }));
  };

  const handleAddLinenRow = (e: React.FormEvent, size: string) => {
    e.preventDefault();
    const draft = linenDrafts[size] ?? {
      name: '',
      sheets: '0',
      blankets: '0',
      throws: '0',
    };
    if (!draft.name.trim()) return;
    onAddLinenSource(size, draft.name.trim(), {
      sheets: Math.max(0, Math.floor(Number(draft.sheets) || 0)),
      blankets: Math.max(0, Math.floor(Number(draft.blankets) || 0)),
      throws: Math.max(0, Math.floor(Number(draft.throws) || 0)),
    });
    setLinenDrafts((prev) => ({
      ...prev,
      [size]: { name: '', sheets: '0', blankets: '0', throws: '0' },
    }));
  };

  const effectivePillowDraft = pillowDraft ?? {
    name: '',
    quantity:
      pillowReport.remainingNeeded > 0
        ? String(pillowReport.remainingNeeded)
        : '1',
  };

  const handleAddPillowRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePillowDraft.name.trim()) return;
    const qty = Math.max(0, Math.floor(Number(effectivePillowDraft.quantity) || 0));
    onAddPillowSource(effectivePillowDraft.name.trim(), qty);
    setPillowDraft({ name: '', quantity: '' });
  };

  return (
    <div className="space-y-8">
      {/* Top 4-Column Inventory KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E2DBD0] bg-white p-4">
          <p className="text-xs font-medium text-[#635D54]">
            Physical Beds Needed
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#1F1D1A] font-mono tabular-nums">
            {summary.totalPhysicalBeds}
          </p>
          <p className="mt-0.5 text-xs text-[#635D54] tabular-nums">
            Sleeps {summary.totalPeopleWithBeds} of {summary.totalPeople} guests
          </p>
        </div>

        <div className="rounded-xl border border-[#E2DBD0] bg-white p-4">
          <p className="text-xs font-medium text-[#635D54]">
            Beds Sourced
          </p>
          <p
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              reports.length === 0
                ? 'text-[#635D54]'
                : hasMissingBeds
                ? 'text-[#B85D43]'
                : hasExtraBeds
                ? 'text-[#22422E]'
                : 'text-[#486B56]'
            }`}
          >
            {coveredBedGroupsCount}/{reports.length}
          </p>
          <p className="mt-0.5 text-xs text-[#635D54] tabular-nums">
            {summary.totalAllocatedBeds} of {summary.totalPhysicalBeds} beds allocated
          </p>
        </div>

        <div className="rounded-xl border border-[#E2DBD0] bg-white p-4">
          <p className="text-xs font-medium text-[#635D54]">
            Linens &amp; Pillows Balanced
          </p>
          <p
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              linenReports.length === 0 && pillowReport.totalRequired === 0
                ? 'text-[#635D54]'
                : hasMissingLinens || hasMissingPillows
                ? 'text-[#B85D43]'
                : hasExtraLinens || hasExtraPillows
                ? 'text-[#22422E]'
                : 'text-[#486B56]'
            }`}
          >
            {coveredLinenSizesCount}/{linenSummary.totalSizesCount}
            <span className="text-sm font-normal text-[#635D54]">
              {' '}
              sizes ·{' '}
            </span>
            {pillowReport.totalAllocated}/{pillowReport.totalRequired}
            <span className="text-sm font-normal text-[#635D54]">
              {' '}
              pillows
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[#635D54] tabular-nums">
            {linenSummary.totalSheetsAllocated}/{linenSummary.totalSheetsRequired}{' '}
            sheets · {linenSummary.totalBlanketsAllocated}/
            {linenSummary.totalBlanketsRequired} blankets ·{' '}
            {linenSummary.totalThrowsAllocated}/{linenSummary.totalThrowsRequired}{' '}
            throws
          </p>
        </div>

        <div className="rounded-xl border border-[#E2DBD0] bg-white p-4">
          <p className="text-xs font-medium text-[#635D54]">
            Room Placement
          </p>
          <p
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              summary.unplacedBedsCount === 0
                ? 'text-[#486B56]'
                : 'text-[#A36A1F]'
            }`}
          >
            {summary.totalPhysicalBeds - summary.unplacedBedsCount}/
            {summary.totalPhysicalBeds}
          </p>
          <p className="mt-0.5 text-xs text-[#635D54] tabular-nums">
            {summary.unplacedBedsCount === 0
              ? 'All beds placed in rooms'
              : `${summary.unplacedBedsCount} awaiting room`}
          </p>
        </div>
      </div>

      {/* Section 1: Beds by Type & Source */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleSection('beds')}
            aria-expanded={!collapsedSections.beds}
            className="group flex-1 min-w-[260px] flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-[#F2EDE5]/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#486B56]"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {collapsedSections.beds ? (
                <ChevronRight className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              )}
              <div>
                <h2
                  className="text-xl font-semibold text-[#1F1D1A]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  01. Beds by Type &amp; Source
                </h2>
                <p className="text-xs text-[#635D54] mt-0.5">
                  {readOnly
                    ? 'Where each mattress or pack & play comes from, separating real mattresses from air mattresses.'
                    : 'Track where each mattress or pack & play comes from, separating real mattresses from air mattresses.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 pl-7 sm:pl-0">
              {reports.length > 0 && (
                <div
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums ${
                    !hasMissingBeds
                      ? hasExtraBeds
                        ? 'border-[#2E4A39]/45 bg-[#DCE7DF] text-[#1B3324]'
                        : 'border-[#486B56]/30 bg-[#EEF3EF] text-[#2E4A39]'
                      : 'border-[#E2DBD0] bg-white text-[#4A453E]'
                  }`}
                >
                  <span>
                    {summary.totalAllocatedBeds}/{summary.totalPhysicalBeds} beds sourced
                  </span>
                  <span className="text-[#C7BEB0]">·</span>
                  <span>
                    {coveredBedGroupsCount}/{reports.length}{' '}
                    {reports.length === 1 ? 'type' : 'types'}{' '}
                    {!hasMissingBeds && hasExtraBeds ? 'has extras' : 'balanced'}
                  </span>
                </div>
              )}
            </div>
          </button>

          {!collapsedSections.beds && reports.length > 1 && (
            <button
              type="button"
              onClick={toggleAllBedGroups}
              className="mt-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-xs font-medium text-[#4A453E] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {allBedGroupsCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {!collapsedSections.beds &&
          (reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D5CEC3] bg-white p-10 text-center max-w-xl mx-auto">
              <PackageCheck className="w-8 h-8 text-[#486B56] mx-auto mb-3" />
              <h3
                className="text-lg font-semibold text-[#1F1D1A]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                No beds mapped yet
              </h3>
              <p className="mt-1.5 text-sm text-[#635D54]">
                {readOnly
                  ? 'Beds and inventory sources will appear here once guests are assigned to beds.'
                  : 'Once you map guests to beds in the Roster & Beds tab, each mattress size and type will appear here so you can divide them across sources.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const isGroupCollapsed = Boolean(
                  collapsedBedGroups[report.bedTypeKey]
                );
                const draft = sourceDrafts[report.bedTypeKey] ?? {
                  name: '',
                  quantity:
                    report.remainingNeeded > 0
                      ? String(report.remainingNeeded)
                      : '1',
                };

                return (
                  <section
                    key={report.bedTypeKey}
                    className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden"
                  >
                    {/* Report Group Header */}
                    <button
                      type="button"
                      onClick={() => toggleBedGroup(report.bedTypeKey)}
                      aria-expanded={!isGroupCollapsed}
                      className={`w-full text-left flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] hover:bg-[#F2EDE5]/60 transition-colors px-5 py-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#486B56] ${
                        isGroupCollapsed ? '' : 'border-b border-[#E2DBD0]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isGroupCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[#635D54] shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#635D54] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <h3
                              className="text-lg font-semibold text-[#1F1D1A]"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {report.label}
                            </h3>
                            <span className="text-xs text-[#635D54] tabular-nums">
                              {report.requiredCount}{' '}
                              {report.requiredCount === 1 ? 'bed' : 'beds'} needed ·{' '}
                              {report.occupantCount}{' '}
                              {report.occupantCount === 1 ? 'sleeper' : 'sleepers'} ·{' '}
                              {report.sources.length}{' '}
                              {report.sources.length === 1 ? 'source' : 'sources'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explicit Status Text + Icon */}
                      <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                        {report.status === 'balanced' ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E4A39] bg-[#EEF3EF] border border-[#486B56]/30 rounded-lg px-3 py-1.5 tabular-nums">
                            <CheckCircle2 className="w-4 h-4 text-[#486B56]" />
                            Balanced ({report.allocatedCount}/{report.requiredCount})
                          </div>
                        ) : report.status === 'needs_sourcing' ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E4510] bg-[#FDF6EA] border border-[#A36A1F]/35 rounded-lg px-3 py-1.5 tabular-nums">
                            <AlertCircle className="w-4 h-4 text-[#A36A1F]" />
                            {report.remainingNeeded} still needed (
                            {report.allocatedCount}/{report.requiredCount})
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3324] bg-[#DCE7DF] border border-[#2E4A39]/45 rounded-lg px-3 py-1.5 tabular-nums">
                            <CheckCheck className="w-4 h-4 text-[#22422E]" />
                            Has Extras ({report.overAllocated} extra ·{' '}
                            {report.allocatedCount}/{report.requiredCount})
                          </div>
                        )}
                      </div>
                    </button>

                    {!isGroupCollapsed && (
                      <>
                        {report.beds.length > 0 && (
                          <div className="border-b border-[#EFEAE2] bg-[#FAF8F5]/40 px-5 py-2.5 text-xs text-[#635D54]">
                            Assigned:{' '}
                            {report.beds
                              .map(
                                (bv) =>
                                  `${bv.occupantSummary} (${
                                    bv.room?.name ?? 'Unassigned room'
                                  })`
                              )
                              .join(' · ')}
                          </div>
                        )}

                        {/* Source Allocations List */}
                        <div className="divide-y divide-[#EFEAE2]">
                    {report.sources.length === 0 ? (
                      <div className="px-5 py-3.5 text-xs text-[#635D54]">
                        {readOnly
                          ? `No sources assigned yet for ${report.label}.`
                          : `No sources assigned yet for ${report.label}. Add a source below (for example: “From Home” or “Borrowed from Joe”).`}
                      </div>
                    ) : (
                      report.sources.map((src) => (
                        <div
                          key={src.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5"
                        >
                          <div className="flex-1 min-w-[180px]">
                            {readOnly ? (
                              <span className="text-sm font-medium text-[#1F1D1A]">
                                {src.sourceName}
                              </span>
                            ) : (
                              <input
                                type="text"
                                defaultValue={src.sourceName}
                                key={src.id + src.sourceName}
                                onBlur={(e) => {
                                  if (
                                    e.target.value.trim() &&
                                    e.target.value.trim() !== src.sourceName
                                  ) {
                                    onUpdateSource(src.id, {
                                      sourceName: e.target.value.trim(),
                                    });
                                  }
                                }}
                                aria-label="Source name"
                                className="w-full max-w-sm text-sm font-medium text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-1 -ml-2 focus:outline-none"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {readOnly ? (
                              <span className="font-mono text-sm font-semibold text-[#1F1D1A] tabular-nums">
                                {src.quantity}
                              </span>
                            ) : (
                              <>
                                <div className="inline-flex items-center rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSource(src.id, {
                                        quantity: Math.max(0, src.quantity - 1),
                                      })
                                    }
                                    className="p-1.5 text-[#4A453E] hover:bg-[#EAE3D8] transition-colors cursor-pointer"
                                    aria-label={`Decrease quantity for ${src.sourceName}`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={src.quantity}
                                    onChange={(e) =>
                                      onUpdateSource(src.id, {
                                        quantity: Math.max(
                                          0,
                                          Math.floor(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    aria-label={`Quantity for ${src.sourceName}`}
                                    className="w-12 bg-white py-1 text-center font-mono text-sm font-semibold text-[#1F1D1A] tabular-nums focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSource(src.id, {
                                        quantity: src.quantity + 1,
                                      })
                                    }
                                    className="p-1.5 text-[#4A453E] hover:bg-[#EAE3D8] transition-colors cursor-pointer"
                                    aria-label={`Increase quantity for ${src.sourceName}`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onRemoveSource(src.id)}
                                  className="rounded-md p-1.5 text-[#8E867B] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                                  aria-label={`Remove source ${src.sourceName}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Source Row */}
                  {!readOnly && (
                    <form
                      onSubmit={(e) =>
                        handleAddSource(
                          e,
                          report.bedTypeKey,
                          report.remainingNeeded || 1
                        )
                      }
                      className="flex flex-wrap items-center gap-2 border-t border-[#EFEAE2] bg-[#FAF8F5]/60 px-5 py-3"
                    >
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setSourceDrafts((prev) => ({
                            ...prev,
                            [report.bedTypeKey]: { ...draft, name: e.target.value },
                          }))
                        }
                        placeholder="Source (e.g., From Home, Borrowed from Joe)"
                        className="flex-1 min-w-[200px] rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        value={draft.quantity}
                        onChange={(e) =>
                          setSourceDrafts((prev) => ({
                            ...prev,
                            [report.bedTypeKey]: {
                              ...draft,
                              quantity: e.target.value,
                            },
                          }))
                        }
                        aria-label="Source quantity"
                        className="w-20 rounded-lg border border-[#D5CEC3] bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums text-[#1F1D1A] focus:border-[#486B56] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#486B56]" />
                        Add Source
                      </button>
                      </form>
                    )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          ))}
      </div>

      {/* Section 2: Sheets, Blankets & Throws by Size & Source */}
      <div className="space-y-4 pt-4 border-t border-[#E2DBD0]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleSection('linens')}
            aria-expanded={!collapsedSections.linens}
            className="group flex-1 min-w-[260px] flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-[#F2EDE5]/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#486B56]"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {collapsedSections.linens ? (
                <ChevronRight className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              )}
              <div>
                <h2
                  className="text-xl font-semibold text-[#1F1D1A]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  02. Sheets, Blankets &amp; Throws by Size
                </h2>
                <p className="text-xs text-[#635D54] mt-0.5">
                  Combines real mattresses and air mattresses of the same size. Sheets, regular blankets, and throws count 1 per bed (Pack &amp; Plays use fitted sheets only).
                </p>
                {linenSummary.unmappedPeopleCount > 0 && (
                  <p className="text-xs font-medium text-[#A36A1F] mt-1">
                    {linenSummary.unmappedPeopleCount}{' '}
                    {linenSummary.unmappedPeopleCount === 1
                      ? 'guest has'
                      : 'guests have'}{' '}
                    no bed mapped yet
                  </p>
                )}
              </div>
            </div>

            {linenReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0 pl-7 sm:pl-0">
                <div
                  className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums ${
                    !hasMissingLinens
                      ? hasExtraLinens
                        ? 'border-[#2E4A39]/45 bg-[#DCE7DF] text-[#1B3324]'
                        : 'border-[#486B56]/30 bg-[#EEF3EF] text-[#2E4A39]'
                      : 'border-[#E2DBD0] bg-white text-[#4A453E]'
                  }`}
                >
                  <span>
                    {linenSummary.totalSheetsAllocated}/
                    {linenSummary.totalSheetsRequired} sheets
                  </span>
                  <span className="text-[#C7BEB0]">·</span>
                  <span>
                    {linenSummary.totalBlanketsAllocated}/
                    {linenSummary.totalBlanketsRequired} blankets
                  </span>
                  <span className="text-[#C7BEB0]">·</span>
                  <span>
                    {linenSummary.totalThrowsAllocated}/
                    {linenSummary.totalThrowsRequired} throws
                  </span>
                  <span className="text-[#C7BEB0]">·</span>
                  <span>
                    {coveredLinenSizesCount}/
                    {linenSummary.totalSizesCount}{' '}
                    {!hasMissingLinens && hasExtraLinens ? 'has extras' : 'balanced'}
                  </span>
                </div>
              </div>
            )}
          </button>

          {!collapsedSections.linens && linenReports.length > 1 && (
            <button
              type="button"
              onClick={toggleAllLinenSizes}
              className="mt-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-xs font-medium text-[#4A453E] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {allLinenSizesCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {!collapsedSections.linens &&
          (linenReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D5CEC3] bg-white p-8 text-center text-sm text-[#635D54]">
              {readOnly
                ? 'No beds mapped yet for sheet, blanket, and throw counts.'
                : 'Map guests to beds first to see sheet, regular blanket, and throw requirements grouped by bed size.'}
            </div>
          ) : (
            <div className="space-y-4">
              {linenReports.map((lr) => {
                const isSizeCollapsed = Boolean(collapsedLinenSizes[lr.size]);
                const sizeHasMissing =
                  lr.sheets.status === 'needs_sourcing' ||
                  lr.blankets.status === 'needs_sourcing' ||
                  lr.throws.status === 'needs_sourcing';
                const sizeHasExtras =
                  lr.sheets.status === 'over_allocated' ||
                  lr.blankets.status === 'over_allocated' ||
                  lr.throws.status === 'over_allocated';
                const draft = linenDrafts[lr.size] ?? {
                  name: '',
                  sheets: String(lr.sheets.remainingNeeded),
                  blankets: String(lr.blankets.remainingNeeded),
                  throws: String(lr.throws.remainingNeeded),
                };

                return (
                  <section
                    key={lr.size}
                    className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden"
                  >
                    {/* Size Header */}
                    <button
                      type="button"
                      onClick={() => toggleLinenSize(lr.size)}
                      aria-expanded={!isSizeCollapsed}
                      className={`w-full text-left flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] hover:bg-[#F2EDE5]/60 transition-colors px-5 py-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#486B56] ${
                        isSizeCollapsed ? '' : 'border-b border-[#E2DBD0]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isSizeCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[#635D54] mt-1.5 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#635D54] mt-1.5 shrink-0" />
                        )}
                        <div>
                          <div className="flex flex-wrap items-baseline gap-3">
                            <h3
                              className="text-lg font-semibold text-[#1F1D1A]"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {lr.size} Linens
                            </h3>
                            <span className="text-xs text-[#635D54] tabular-nums">
                              {lr.physicalBedsCount}{' '}
                              {lr.physicalBedsCount === 1 ? 'bed' : 'beds'} ·{' '}
                              {lr.occupantCount}{' '}
                              {lr.occupantCount === 1 ? 'sleeper' : 'sleepers'} ·{' '}
                              {lr.sources.length}{' '}
                              {lr.sources.length === 1 ? 'source' : 'sources'}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                            {renderLinenStatusText('Sheets', lr.sheets)}
                            {renderLinenStatusText('Regular Blankets', lr.blankets)}
                            {renderLinenStatusText('Throws', lr.throws)}
                            {lr.size === 'Pack & Play' && (
                              <span className="text-xs text-[#635D54]">
                                (Fitted sheets only — no pillows or blankets)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-6 sm:pl-0">
                        {sizeHasMissing ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E4510] bg-[#FDF6EA] border border-[#A36A1F]/35 rounded-lg px-3 py-1.5">
                            <AlertCircle className="w-4 h-4 text-[#A36A1F]" />
                            Needs adjustment
                          </div>
                        ) : sizeHasExtras ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3324] bg-[#DCE7DF] border border-[#2E4A39]/45 rounded-lg px-3 py-1.5">
                            <CheckCheck className="w-4 h-4 text-[#22422E]" />
                            Has Extras
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E4A39] bg-[#EEF3EF] border border-[#486B56]/30 rounded-lg px-3 py-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#486B56]" />
                            All {lr.size} linens balanced
                          </div>
                        )}
                      </div>
                    </button>

                    {!isSizeCollapsed && (
                      <>
                        {/* Sources Table */}
                        <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#EFEAE2] text-xs font-medium text-[#635D54]">
                          <th className="py-2.5 pl-5 pr-3">Source</th>
                          <th className="py-2.5 px-3 text-right w-28">
                            Sheets ({lr.sheets.required})
                          </th>
                          <th className="py-2.5 px-3 text-right w-32">
                            Blankets ({lr.blankets.required})
                          </th>
                          <th className="py-2.5 px-3 text-right w-28">
                            Throws ({lr.throws.required})
                          </th>
                          {!readOnly && <th className="py-2.5 pl-2 pr-5 w-12" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFEAE2] text-sm">
                        {lr.sources.length === 0 ? (
                          <tr>
                            <td
                              colSpan={readOnly ? 4 : 5}
                              className="px-5 py-3.5 text-xs text-[#635D54]"
                            >
                              {readOnly
                                ? `No linen sources listed for ${lr.size} yet.`
                                : `No linen sources added for ${lr.size} yet. Add a source below to allocate ${lr.sheets.required} sheets, ${lr.blankets.required} regular blankets, and ${lr.throws.required} throws.`}
                            </td>
                          </tr>
                        ) : (
                          lr.sources.map((ls) => (
                            <tr key={ls.id}>
                              <td className="py-2.5 pl-5 pr-3">
                                {readOnly ? (
                                  <span className="font-medium text-[#1F1D1A]">
                                    {ls.sourceName}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    defaultValue={ls.sourceName}
                                    key={ls.id + ls.sourceName}
                                    onBlur={(e) => {
                                      if (
                                        e.target.value.trim() &&
                                        e.target.value.trim() !== ls.sourceName
                                      ) {
                                        onUpdateLinenSource(ls.id, {
                                          sourceName: e.target.value.trim(),
                                        });
                                      }
                                    }}
                                    aria-label={`Linen source name for ${lr.size}`}
                                    className="w-full max-w-xs font-medium text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-1 -ml-2 focus:outline-none"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                {readOnly ? (
                                  <span>{ls.sheets}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={ls.sheets}
                                    onChange={(e) =>
                                      onUpdateLinenSource(ls.id, {
                                        sheets: Math.max(
                                          0,
                                          Math.floor(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    aria-label={`${lr.size} sheets from ${ls.sourceName}`}
                                    className="w-20 rounded-md border border-[#D5CEC3] bg-[#FAF8F5] px-2 py-1 text-right font-mono text-sm font-semibold text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                {readOnly ? (
                                  <span>{ls.blankets}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={ls.blankets}
                                    onChange={(e) =>
                                      onUpdateLinenSource(ls.id, {
                                        blankets: Math.max(
                                          0,
                                          Math.floor(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    aria-label={`${lr.size} regular blankets from ${ls.sourceName}`}
                                    className="w-20 rounded-md border border-[#D5CEC3] bg-[#FAF8F5] px-2 py-1 text-right font-mono text-sm font-semibold text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                {readOnly ? (
                                  <span>{ls.throws}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={ls.throws}
                                    onChange={(e) =>
                                      onUpdateLinenSource(ls.id, {
                                        throws: Math.max(
                                          0,
                                          Math.floor(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    aria-label={`${lr.size} throws from ${ls.sourceName}`}
                                    className="w-20 rounded-md border border-[#D5CEC3] bg-[#FAF8F5] px-2 py-1 text-right font-mono text-sm font-semibold text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                                  />
                                )}
                              </td>
                              {!readOnly && (
                                <td className="py-2.5 pl-2 pr-5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => onRemoveLinenSource(ls.id)}
                                    className="rounded-md p-1.5 text-[#8E867B] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                                    aria-label={`Remove linen source ${ls.sourceName}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#E2DBD0] bg-[#FAF8F5]/70 text-xs font-semibold text-[#1F1D1A] font-mono tabular-nums">
                          <td className="py-2.5 pl-5 pr-3 font-sans text-[#635D54]">
                            Total Allocated / Needed
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {lr.sheets.allocated} / {lr.sheets.required}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {lr.blankets.allocated} / {lr.blankets.required}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {lr.throws.allocated} / {lr.throws.required}
                          </td>
                          {!readOnly && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Add Linen Source Form */}
                  {!readOnly && (
                    <form
                      onSubmit={(e) => handleAddLinenRow(e, lr.size)}
                      className="flex flex-wrap items-center gap-2 border-t border-[#EFEAE2] bg-[#FAF8F5]/60 px-5 py-3"
                    >
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setLinenDrafts((prev) => ({
                            ...prev,
                            [lr.size]: { ...draft, name: e.target.value },
                          }))
                        }
                        placeholder={`Source for ${lr.size} linens (e.g., From Home)`}
                        className="flex-1 min-w-[180px] rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-[#635D54]">
                        Sheets
                        <input
                          type="number"
                          min={0}
                          value={draft.sheets}
                          onChange={(e) =>
                            setLinenDrafts((prev) => ({
                              ...prev,
                              [lr.size]: { ...draft, sheets: e.target.value },
                            }))
                          }
                          className="w-16 rounded-lg border border-[#D5CEC3] bg-white px-2 py-1.5 text-sm font-mono tabular-nums text-[#1F1D1A] focus:border-[#486B56] focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#635D54]">
                        Blankets
                        <input
                          type="number"
                          min={0}
                          value={draft.blankets}
                          onChange={(e) =>
                            setLinenDrafts((prev) => ({
                              ...prev,
                              [lr.size]: { ...draft, blankets: e.target.value },
                            }))
                          }
                          className="w-16 rounded-lg border border-[#D5CEC3] bg-white px-2 py-1.5 text-sm font-mono tabular-nums text-[#1F1D1A] focus:border-[#486B56] focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#635D54]">
                        Throws
                        <input
                          type="number"
                          min={0}
                          value={draft.throws}
                          onChange={(e) =>
                            setLinenDrafts((prev) => ({
                              ...prev,
                              [lr.size]: { ...draft, throws: e.target.value },
                            }))
                          }
                          className="w-16 rounded-lg border border-[#D5CEC3] bg-white px-2 py-1.5 text-sm font-mono tabular-nums text-[#1F1D1A] focus:border-[#486B56] focus:outline-none"
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#486B56]" />
                        Add Source
                      </button>
                      </form>
                    )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          ))}
      </div>

      {/* Section 3: Pillows by Room & Source (ignores bed sizes; Pack & Plays excluded) */}
      <div className="space-y-4 pt-4 border-t border-[#E2DBD0]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => toggleSection('pillows')}
            aria-expanded={!collapsedSections.pillows}
            className="group flex-1 min-w-[260px] flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-[#F2EDE5]/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#486B56]"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {collapsedSections.pillows ? (
                <ChevronRight className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#635D54] mt-1 shrink-0" />
              )}
              <div>
                <h2
                  className="text-xl font-semibold text-[#1F1D1A]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  03. Pillows by Room &amp; Source
                </h2>
                <p className="text-xs text-[#635D54] mt-0.5">
                  Counts 1 pillow per sleeper regardless of bed size. Pack &amp; Plays use no pillows and no blankets.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 pl-7 sm:pl-0">
              <div
                className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums ${
                  pillowReport.status === 'over_allocated'
                    ? 'border-[#2E4A39]/45 bg-[#DCE7DF] text-[#1B3324]'
                    : pillowReport.status === 'balanced' &&
                      (pillowReport.totalRequired > 0 ||
                        pillowReport.sources.length > 0)
                    ? 'border-[#486B56]/30 bg-[#EEF3EF] text-[#2E4A39]'
                    : 'border-[#E2DBD0] bg-white text-[#4A453E]'
                }`}
              >
                <span>
                  {pillowReport.totalAllocated}/{pillowReport.totalRequired}{' '}
                  pillows sourced
                </span>
                <span className="text-[#C7BEB0]">·</span>
                <span>
                  {pillowReport.byRoom.length}{' '}
                  {pillowReport.byRoom.length === 1 ? 'room' : 'rooms'}
                </span>
              </div>
            </div>
          </button>

          {!collapsedSections.pillows && (
            <button
              type="button"
              onClick={toggleAllPillowGroups}
              className="mt-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-xs font-medium text-[#4A453E] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {allPillowGroupsCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {!collapsedSections.pillows && (
          <div className="space-y-4">
            {/* Subsection 3A: Pillow Count by Room */}
            <section className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => togglePillowGroup('byRoom')}
                aria-expanded={!collapsedPillowGroups.byRoom}
                className={`w-full text-left flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] hover:bg-[#F2EDE5]/60 transition-colors px-5 py-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#486B56] ${
                  collapsedPillowGroups.byRoom ? '' : 'border-b border-[#E2DBD0]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {collapsedPillowGroups.byRoom ? (
                    <ChevronRight className="w-4 h-4 text-[#635D54] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#635D54] shrink-0" />
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h3
                      className="text-lg font-semibold text-[#1F1D1A]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Pillow Count by Room
                    </h3>
                    <span className="text-xs text-[#635D54] tabular-nums">
                      {pillowReport.byRoom.length}{' '}
                      {pillowReport.byRoom.length === 1 ? 'room' : 'rooms'} ·{' '}
                      {pillowReport.totalRequired}{' '}
                      {pillowReport.totalRequired === 1 ? 'pillow' : 'pillows'}{' '}
                      needed
                    </span>
                  </div>
                </div>

                <span className="font-mono text-sm font-semibold text-[#1F1D1A] tabular-nums pl-6 sm:pl-0">
                  {pillowReport.totalRequired} total
                </span>
              </button>

              {!collapsedPillowGroups.byRoom &&
                (pillowReport.byRoom.length === 0 ? (
                  <div className="px-5 py-4 text-xs text-[#635D54]">
                    {readOnly
                      ? 'No rooms or beds mapped yet.'
                      : 'Add rooms in the Room Planner and map guests to beds to see pillow counts by room.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#EFEAE2] text-xs font-medium text-[#635D54]">
                          <th className="py-2.5 pl-5 pr-3">Room</th>
                          <th className="py-2.5 px-3">Beds &amp; Sleepers</th>
                          <th className="py-2.5 pl-3 pr-5 text-right w-32">
                            Pillows Needed
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFEAE2] text-sm">
                        {pillowReport.byRoom.map((rc) => (
                          <tr key={rc.roomId ?? 'unassigned'}>
                            <td className="py-2.5 pl-5 pr-3">
                              <p
                                className={`font-medium ${
                                  rc.roomId === null
                                    ? 'text-[#A36A1F]'
                                    : 'text-[#1F1D1A]'
                                }`}
                              >
                                {rc.roomName}
                              </p>
                              {rc.roomNotes && (
                                <p className="text-xs text-[#635D54]">
                                  {rc.roomNotes}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-[#635D54] tabular-nums">
                              {rc.bedCount}{' '}
                              {rc.bedCount === 1 ? 'bed' : 'beds'} ·{' '}
                              {rc.occupantCount}{' '}
                              {rc.occupantCount === 1 ? 'sleeper' : 'sleepers'}
                              {rc.excludedPackAndPlayCount > 0 && (
                                <span className="text-[#8E867B]">
                                  {' '}
                                  · {rc.excludedPackAndPlayCount} in Pack &amp;
                                  Play (0 pillows)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-3 pr-5 text-right font-mono font-semibold text-[#1F1D1A] tabular-nums">
                              {rc.pillowsRequired}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#E2DBD0] bg-[#FAF8F5]/70 text-xs font-semibold text-[#1F1D1A] font-mono tabular-nums">
                          <td
                            colSpan={2}
                            className="py-2.5 pl-5 pr-3 font-sans text-[#635D54]"
                          >
                            Total Pillows Needed
                          </td>
                          <td className="py-2.5 pl-3 pr-5 text-right">
                            {pillowReport.totalRequired}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
            </section>

            {/* Subsection 3B: Pillow Sources (Ignores Bed Sizes) */}
            <section className="rounded-xl border border-[#E2DBD0] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => togglePillowGroup('sources')}
                aria-expanded={!collapsedPillowGroups.sources}
                className={`w-full text-left flex flex-wrap items-center justify-between gap-4 bg-[#FAF8F5] hover:bg-[#F2EDE5]/60 transition-colors px-5 py-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#486B56] ${
                  collapsedPillowGroups.sources ? '' : 'border-b border-[#E2DBD0]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {collapsedPillowGroups.sources ? (
                    <ChevronRight className="w-4 h-4 text-[#635D54] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#635D54] shrink-0" />
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h3
                      className="text-lg font-semibold text-[#1F1D1A]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Pillow Sources (All Sizes)
                    </h3>
                    <span className="text-xs text-[#635D54] tabular-nums">
                      {pillowReport.totalRequired}{' '}
                      {pillowReport.totalRequired === 1 ? 'pillow' : 'pillows'}{' '}
                      needed · {pillowReport.sources.length}{' '}
                      {pillowReport.sources.length === 1 ? 'source' : 'sources'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                  {pillowReport.status === 'balanced' ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E4A39] bg-[#EEF3EF] border border-[#486B56]/30 rounded-lg px-3 py-1.5 tabular-nums">
                      <CheckCircle2 className="w-4 h-4 text-[#486B56]" />
                      Balanced ({pillowReport.totalAllocated}/
                      {pillowReport.totalRequired})
                    </div>
                  ) : pillowReport.status === 'needs_sourcing' ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E4510] bg-[#FDF6EA] border border-[#A36A1F]/35 rounded-lg px-3 py-1.5 tabular-nums">
                      <AlertCircle className="w-4 h-4 text-[#A36A1F]" />
                      {pillowReport.remainingNeeded} still needed (
                      {pillowReport.totalAllocated}/{pillowReport.totalRequired})
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3324] bg-[#DCE7DF] border border-[#2E4A39]/45 rounded-lg px-3 py-1.5 tabular-nums">
                      <CheckCheck className="w-4 h-4 text-[#22422E]" />
                      Has Extras ({pillowReport.overAllocated} extra ·{' '}
                      {pillowReport.totalAllocated}/{pillowReport.totalRequired})
                    </div>
                  )}
                </div>
              </button>

              {!collapsedPillowGroups.sources && (
                <>
                  <div className="divide-y divide-[#EFEAE2]">
                    {pillowReport.sources.length === 0 ? (
                      <div className="px-5 py-3.5 text-xs text-[#635D54]">
                        {readOnly
                          ? 'No pillow sources listed yet.'
                          : `No pillow sources added yet. Add a source below to allocate ${pillowReport.totalRequired} ${
                              pillowReport.totalRequired === 1 ? 'pillow' : 'pillows'
                            }.`}
                      </div>
                    ) : (
                      pillowReport.sources.map((ps) => (
                        <div
                          key={ps.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5"
                        >
                          <div className="flex-1 min-w-[180px]">
                            {readOnly ? (
                              <span className="text-sm font-medium text-[#1F1D1A]">
                                {ps.sourceName}
                              </span>
                            ) : (
                              <input
                                type="text"
                                defaultValue={ps.sourceName}
                                key={ps.id + ps.sourceName}
                                onBlur={(e) => {
                                  if (
                                    e.target.value.trim() &&
                                    e.target.value.trim() !== ps.sourceName
                                  ) {
                                    onUpdatePillowSource(ps.id, {
                                      sourceName: e.target.value.trim(),
                                    });
                                  }
                                }}
                                aria-label="Pillow source name"
                                className="w-full max-w-sm text-sm font-medium text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-1 -ml-2 focus:outline-none"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {readOnly ? (
                              <span className="font-mono text-sm font-semibold text-[#1F1D1A] tabular-nums">
                                {ps.quantity}
                              </span>
                            ) : (
                              <>
                                <div className="inline-flex items-center rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdatePillowSource(ps.id, {
                                        quantity: Math.max(0, ps.quantity - 1),
                                      })
                                    }
                                    className="p-1.5 text-[#4A453E] hover:bg-[#EAE3D8] transition-colors cursor-pointer"
                                    aria-label={`Decrease pillows for ${ps.sourceName}`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={ps.quantity}
                                    onChange={(e) =>
                                      onUpdatePillowSource(ps.id, {
                                        quantity: Math.max(
                                          0,
                                          Math.floor(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    aria-label={`Pillow quantity for ${ps.sourceName}`}
                                    className="w-12 bg-white py-1 text-center font-mono text-sm font-semibold text-[#1F1D1A] tabular-nums focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdatePillowSource(ps.id, {
                                        quantity: ps.quantity + 1,
                                      })
                                    }
                                    className="p-1.5 text-[#4A453E] hover:bg-[#EAE3D8] transition-colors cursor-pointer"
                                    aria-label={`Increase pillows for ${ps.sourceName}`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onRemovePillowSource(ps.id)}
                                  className="rounded-md p-1.5 text-[#8E867B] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                                  aria-label={`Remove pillow source ${ps.sourceName}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {!readOnly && (
                    <form
                      onSubmit={handleAddPillowRow}
                      className="flex flex-wrap items-center gap-2 border-t border-[#EFEAE2] bg-[#FAF8F5]/60 px-5 py-3"
                    >
                      <input
                        type="text"
                        value={effectivePillowDraft.name}
                        onChange={(e) =>
                          setPillowDraft({
                            ...effectivePillowDraft,
                            name: e.target.value,
                          })
                        }
                        placeholder="Source for pillows (e.g., From Home, Borrowed from Joe)"
                        className="flex-1 min-w-[200px] rounded-lg border border-[#D5CEC3] bg-white px-3 py-1.5 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        value={effectivePillowDraft.quantity}
                        onChange={(e) =>
                          setPillowDraft({
                            ...effectivePillowDraft,
                            quantity: e.target.value,
                          })
                        }
                        aria-label="Pillow source quantity"
                        className="w-20 rounded-lg border border-[#D5CEC3] bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums text-[#1F1D1A] focus:border-[#486B56] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#486B56]" />
                        Add Source
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
