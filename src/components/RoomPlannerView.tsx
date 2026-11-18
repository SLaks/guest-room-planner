import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  DoorOpen,
  GripVertical,
  Move,
  Plus,
  Trash2,
} from 'lucide-react';
import { computeRoomSummaries } from '../domain/plannerMath';
import { BedView, PlannerState, Room } from '../domain/types';

interface RoomPlannerViewProps {
  state: PlannerState;
  readOnly: boolean;
  onAddRoom: (name: string, notes: string) => void;
  onUpdateRoom: (
    roomId: string,
    patch: Partial<Pick<Room, 'name' | 'notes'>>
  ) => void;
  onRemoveRoom: (roomId: string) => void;
  onMoveBedToRoom: (bedId: string, roomId: string | null) => void;
}

interface ActiveDragState {
  bedId: string;
  sourceRoomId: string | null;
  pointerX: number;
  pointerY: number;
  isTouch: boolean;
}

interface PendingPressState {
  bedId: string;
  sourceRoomId: string | null;
  pointerId: number;
  startX: number;
  startY: number;
  isTouch: boolean;
  fromHandle: boolean;
  timerId: number | null;
}

function findDropTargetAtPoint(x: number, y: number): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.elementFromPoint(x, y);
  const targetEl = el?.closest<HTMLElement>('[data-drop-target]');
  return targetEl?.dataset.dropTarget ?? null;
}

export const RoomPlannerView: React.FC<RoomPlannerViewProps> = ({
  state,
  readOnly,
  onAddRoom,
  onUpdateRoom,
  onRemoveRoom,
  onMoveBedToRoom,
}) => {
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomNotes, setNewRoomNotes] = useState('');

  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // 'unassigned' or roomId
  const [isSmallViewport, setIsSmallViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const pendingRef = useRef<PendingPressState | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastDropTargetRef = useRef<string | null>(null);
  const onMoveBedToRoomRef = useRef(onMoveBedToRoom);

  useEffect(() => {
    onMoveBedToRoomRef.current = onMoveBedToRoom;
  }, [onMoveBedToRoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsSmallViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { unassignedBeds, rooms } = useMemo(
    () => computeRoomSummaries(state),
    [state]
  );

  const bedById = useMemo(() => {
    const map = new Map<string, BedView>();
    for (const bv of unassignedBeds) map.set(bv.bed.id, bv);
    for (const r of rooms) {
      for (const bv of r.beds) map.set(bv.bed.id, bv);
    }
    return map;
  }, [unassignedBeds, rooms]);

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) map.set(r.room.id, r.room.name);
    return map;
  }, [rooms]);

  const totalPlacedBeds = rooms.reduce((sum, r) => sum + r.beds.length, 0);

  // Compact layout activates while dragging on mobile or during any touch/pen drag
  const isCompactDrag = Boolean(
    dragState && (isSmallViewport || dragState.isTouch)
  );

  const clearPendingPress = useCallback(() => {
    if (pendingRef.current?.timerId != null) {
      window.clearTimeout(pendingRef.current.timerId);
    }
    pendingRef.current = null;
  }, []);

  const startActiveDrag = useCallback(
    (
      bedId: string,
      sourceRoomId: string | null,
      x: number,
      y: number,
      isTouch: boolean,
      pointerId: number
    ) => {
      const nextDrag: ActiveDragState = {
        bedId,
        sourceRoomId,
        pointerX: x,
        pointerY: y,
        isTouch,
      };
      activeDragRef.current = nextDrag;
      activePointerIdRef.current = pointerId;
      setDragState(nextDrag);

      const initialTarget = findDropTargetAtPoint(x, y);
      lastDropTargetRef.current = initialTarget;
      setDragOverTarget(initialTarget);

      if (isTouch && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(14);
        } catch {
          // ignore vibration restrictions
        }
      }
    },
    []
  );

  const finishDrag = useCallback((shouldCommit: boolean) => {
    const currentDrag = activeDragRef.current;
    const dropTarget = lastDropTargetRef.current;

    activeDragRef.current = null;
    activePointerIdRef.current = null;
    lastDropTargetRef.current = null;
    setDragState(null);
    setDragOverTarget(null);

    if (!shouldCommit || !currentDrag || !dropTarget) return;

    const targetRoomId = dropTarget === 'unassigned' ? null : dropTarget;
    if (targetRoomId !== currentDrag.sourceRoomId) {
      onMoveBedToRoomRef.current(currentDrag.bedId, targetRoomId);
    }
  }, []);

  // Global pointer & touchmove listeners for smooth cross-device drag + edge auto-scroll
  useEffect(() => {
    let rafId: number | null = null;

    const updateHoverTarget = (x: number, y: number) => {
      const target = findDropTargetAtPoint(x, y);
      if (target !== lastDropTargetRef.current) {
        lastDropTargetRef.current = target;
        setDragOverTarget(target);
      }
    };

    const runAutoScroll = () => {
      const current = activeDragRef.current;
      if (!current) {
        rafId = null;
        return;
      }

      const topEdge = 72;
      const bottomEdge = window.innerHeight - 84;
      let delta = 0;

      if (current.pointerY < topEdge) {
        delta = -Math.max(4, Math.ceil((topEdge - current.pointerY) / 5));
      } else if (current.pointerY > bottomEdge) {
        delta = Math.max(4, Math.ceil((current.pointerY - bottomEdge) / 5));
      }

      if (delta !== 0) {
        window.scrollBy(0, delta);
        updateHoverTarget(current.pointerX, current.pointerY);
      }

      rafId = window.requestAnimationFrame(runAutoScroll);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const activeDrag = activeDragRef.current;
      if (activeDrag && activePointerIdRef.current === e.pointerId) {
        const next: ActiveDragState = {
          ...activeDrag,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
        activeDragRef.current = next;
        setDragState(next);
        updateHoverTarget(e.clientX, e.clientY);

        if (rafId === null) {
          rafId = window.requestAnimationFrame(runAutoScroll);
        }
        return;
      }

      const pending = pendingRef.current;
      if (!pending || pending.pointerId !== e.pointerId) return;

      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      const dist = Math.hypot(dx, dy);

      if (pending.fromHandle || !pending.isTouch) {
        // Immediate drag once pointer moves past tiny jitter threshold
        if (dist >= 4) {
          const { bedId, sourceRoomId, isTouch, pointerId } = pending;
          clearPendingPress();
          startActiveDrag(
            bedId,
            sourceRoomId,
            e.clientX,
            e.clientY,
            isTouch,
            pointerId
          );
          if (rafId === null) {
            rafId = window.requestAnimationFrame(runAutoScroll);
          }
        }
      } else if (dist > 8) {
        // User is scrolling on touch before long-press elapsed — cancel pending drag
        clearPendingPress();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (pendingRef.current?.pointerId === e.pointerId) {
        clearPendingPress();
      }
      if (activeDragRef.current && activePointerIdRef.current === e.pointerId) {
        finishDrag(true);
      }
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (pendingRef.current?.pointerId === e.pointerId) {
        clearPendingPress();
      }
      if (activeDragRef.current && activePointerIdRef.current === e.pointerId) {
        finishDrag(false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Lock page scrolling once touch drag has actively started
      if (activeDragRef.current?.isTouch) {
        if (e.cancelable) {
          e.preventDefault();
        }
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const next: ActiveDragState = {
            ...activeDragRef.current,
            pointerX: touch.clientX,
            pointerY: touch.clientY,
          };
          activeDragRef.current = next;
          setDragState(next);
          updateHoverTarget(touch.clientX, touch.clientY);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      clearPendingPress();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [clearPendingPress, finishDrag, startActiveDrag]);

  const handleCardPointerDown = (
    e: React.PointerEvent,
    bv: BedView,
    fromHandle: boolean
  ) => {
    if (readOnly) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement | null;
    if (!fromHandle && target?.closest('select, input, button, a, label')) {
      return;
    }

    if (fromHandle) {
      e.stopPropagation();
    }

    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const sourceRoomId = bv.room?.id ?? null;

    clearPendingPress();

    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;

    let timerId: number | null = null;
    if (isTouch && !fromHandle) {
      // Long-press anywhere on the bed card initiates touch drag without blocking scroll
      timerId = window.setTimeout(() => {
        const currentPending = pendingRef.current;
        if (!currentPending || currentPending.pointerId !== pointerId) return;
        pendingRef.current = null;
        startActiveDrag(
          bv.bed.id,
          sourceRoomId,
          currentPending.startX,
          currentPending.startY,
          true,
          pointerId
        );
      }, 210);
    }

    pendingRef.current = {
      bedId: bv.bed.id,
      sourceRoomId,
      pointerId,
      startX,
      startY,
      isTouch,
      fromHandle,
      timerId,
    };
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    onAddRoom(newRoomName.trim(), newRoomNotes.trim());
    setNewRoomName('');
    setNewRoomNotes('');
  };

  const renderBedCard = (bv: BedView) => {
    const isDragging = dragState?.bedId === bv.bed.id;
    const isShared = bv.occupants.length > 1;
    const familyNames = Array.from(
      new Set(bv.occupants.map((o) => o.familyName))
    );

    if (isCompactDrag) {
      return (
        <div
          key={bv.bed.id}
          className={`rounded-md border px-2 py-1 text-[11px] leading-tight transition-opacity ${
            isDragging
              ? 'opacity-35 border-dashed border-[#486B56] bg-[#EEF3EF]'
              : 'border-[#E2DBD0] bg-[#FAF8F5]/80 text-[#1F1D1A]'
          }`}
        >
          <p className="font-semibold truncate">{bv.occupantSummary}</p>
          <p className="text-[10px] text-[#635D54] truncate">
            {bv.typeLabel}
            {bv.bed.customLabel ? ` · ${bv.bed.customLabel}` : ''}
          </p>
        </div>
      );
    }

    return (
      <div
        key={bv.bed.id}
        onPointerDown={(e) => handleCardPointerDown(e, bv, false)}
        className={`group rounded-lg border bg-white p-3 transition-all duration-150 ${
          isDragging
            ? 'opacity-40 border-dashed border-[#486B56] scale-[0.98]'
            : 'border-[#E2DBD0] hover:border-[#B8AFA2]'
        } ${!readOnly ? 'select-none cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            {!readOnly && (
              <div
                data-drag-handle="true"
                onPointerDown={(e) => handleCardPointerDown(e, bv, true)}
                className="touch-none select-none min-w-[44px] min-h-[44px] sm:min-w-[24px] sm:min-h-[28px] -ml-2 -my-1.5 sm:-ml-1.5 sm:-my-1 flex items-center justify-center rounded-md text-[#9E968B] hover:text-[#486B56] hover:bg-[#FAF8F5] cursor-grab active:cursor-grabbing shrink-0"
                title="Drag to move bed to a room"
                aria-hidden="true"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F1D1A] leading-snug">
                {bv.occupantSummary}
              </p>
              <p className="text-xs text-[#635D54] mt-0.5">
                {bv.typeLabel}
                {bv.bed.customLabel ? ` (${bv.bed.customLabel})` : ''}
                {isShared ? ` · ${bv.occupants.length} sharing` : ''}
              </p>
              <p className="text-xs text-[#8E867B] mt-0.5 truncate">
                {familyNames.join(' & ')}
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <div className="mt-2.5 pt-2 border-t border-[#F2EDE5] flex items-center justify-between gap-2">
            <label
              htmlFor={`move-bed-${bv.bed.id}`}
              className="text-[11px] text-[#635D54] whitespace-nowrap"
            >
              Place in:
            </label>
            <select
              id={`move-bed-${bv.bed.id}`}
              value={bv.room?.id ?? ''}
              onChange={(e) =>
                onMoveBedToRoom(bv.bed.id, e.target.value || null)
              }
              className="flex-1 min-w-0 rounded-md border border-[#D5CEC3] bg-[#FAF8F5] px-2 py-1 text-xs text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="">Unassigned Tray</option>
              {rooms.map((r) => (
                <option key={r.room.id} value={r.room.id}>
                  {r.room.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  const draggingBed = dragState ? bedById.get(dragState.bedId) ?? null : null;
  const hoverTargetLabel =
    dragOverTarget === 'unassigned'
      ? 'Unassigned Tray'
      : dragOverTarget
      ? roomNameById.get(dragOverTarget) ?? null
      : null;
  const showUnassignedTray = !readOnly || unassignedBeds.length > 0;

  return (
    <div
      className={`${isCompactDrag ? 'space-y-3 select-none' : 'space-y-6'} ${
        dragState ? 'select-none' : ''
      }`}
    >
      {/* Top Bar: Add Room + Placement Counter (compacted while dragging on mobile) */}
      {isCompactDrag ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#486B56]/30 bg-[#EEF3EF] px-3 py-2 text-xs text-[#2E4A39]">
          <span className="inline-flex items-center gap-1.5 font-medium truncate">
            <Move className="w-3.5 h-3.5 text-[#486B56] shrink-0" />
            <span className="truncate">
              Drag onto any room or tray · Release to place
            </span>
          </span>
          <span className="font-mono text-[11px] tabular-nums shrink-0">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {!readOnly ? (
            <form
              onSubmit={handleCreateRoom}
              className="flex flex-col sm:flex-row flex-1 max-w-2xl items-stretch sm:items-center gap-2"
            >
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (e.g., Upstairs Loft)"
                className="sm:w-56 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
              />
              <input
                type="text"
                value={newRoomNotes}
                onChange={(e) => setNewRoomNotes(e.target.value)}
                placeholder="Optional room notes (e.g., En-suite bath, outlet by closet)"
                className="flex-1 rounded-lg border border-[#D5CEC3] bg-white px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Room
              </button>
            </form>
          ) : (
            <div />
          )}

          <div className="text-xs text-[#635D54] tabular-nums whitespace-nowrap">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} ·{' '}
            <span className="font-semibold text-[#1F1D1A]">{totalPlacedBeds}</span>{' '}
            placed
            {showUnassignedTray && (
              <>
                {' · '}
                <span
                  className={`font-semibold ${
                    unassignedBeds.length > 0 ? 'text-[#A36A1F]' : 'text-[#486B56]'
                  }`}
                >
                  {unassignedBeds.length}
                </span>{' '}
                unassigned
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Two-Column Drag & Drop Workspace (single column in readOnly if no unassigned beds) */}
      <div
        className={`grid grid-cols-1 ${
          showUnassignedTray ? 'lg:grid-cols-[330px_1fr]' : ''
        } items-start ${isCompactDrag ? 'gap-2.5' : 'gap-6'}`}
      >
        {/* Left Column: Unassigned Beds Tray */}
        {showUnassignedTray && (
          <aside
            data-drop-target="unassigned"
            className={`lg:sticky lg:top-6 rounded-xl border transition-all duration-150 overflow-hidden ${
              dragOverTarget === 'unassigned'
                ? 'border-[#486B56] bg-[#EEF3EF] ring-2 ring-[#486B56]/25'
                : 'border-[#E2DBD0] bg-[#F2EDE5]/80'
            }`}
          >
            <div
              className={`border-b border-[#E2DBD0] flex items-center justify-between gap-2 ${
                isCompactDrag ? 'px-3 py-1.5' : 'px-4 py-3.5'
              }`}
            >
              <div>
                <h2
                  className={`font-semibold text-[#1F1D1A] ${
                    isCompactDrag ? 'text-xs' : 'text-base'
                  }`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Unassigned Beds
                </h2>
                {!isCompactDrag && (
                  <p className="text-xs text-[#635D54]">
                    {readOnly
                      ? 'Beds awaiting room assignment'
                      : 'Drag handle or hold a bed to drop into any room'}
                  </p>
                )}
              </div>
              <span
                className={`font-mono font-semibold text-[#1F1D1A] tabular-nums ${
                  isCompactDrag ? 'text-xs' : 'text-sm'
                }`}
              >
                {unassignedBeds.length}
              </span>
            </div>

            <div
              className={
                isCompactDrag
                  ? 'p-2 max-h-28 overflow-y-auto'
                  : 'p-3.5 space-y-2.5 max-h-[70vh] overflow-y-auto'
              }
            >
              {unassignedBeds.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed border-[#D5CEC3] bg-white/70 text-center text-[#635D54] ${
                    isCompactDrag ? 'px-3 py-2 text-[11px]' : 'p-6 text-xs'
                  }`}
                >
                  {isCompactDrag
                    ? dragOverTarget === 'unassigned'
                      ? 'Release to unassign bed'
                      : 'Drop here to unassign'
                    : totalPlacedBeds === 0
                    ? 'Map guests to beds in the Roster & Beds tab first—they will appear here ready for room placement.'
                    : 'Every mapped bed is placed in a room. Drop a bed here to unassign it.'}
                </div>
              ) : isCompactDrag ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {unassignedBeds.map(renderBedCard)}
                </div>
              ) : (
                unassignedBeds.map(renderBedCard)
              )}
            </div>
          </aside>
        )}

        {/* Right Column: Room Drop Zones */}
        <div>
          {rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D5CEC3] bg-white p-10 text-center">
              <DoorOpen className="w-8 h-8 text-[#486B56] mx-auto mb-3" />
              <h2
                className="text-xl font-semibold text-[#1F1D1A]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {readOnly ? 'No rooms added yet' : 'Add rooms for your venue'}
              </h2>
              <p className="mt-1.5 text-sm text-[#635D54] max-w-md mx-auto">
                {readOnly
                  ? 'Rooms and bed assignments will appear here once added to this plan.'
                  : 'Enter room names above (such as Primary Suite, Upstairs Loft, or Basement Bunkhouse) and drag beds into each room.'}
              </p>
            </div>
          ) : (
            <div
              className={
                isCompactDrag
                  ? 'grid grid-cols-2 sm:grid-cols-3 gap-2'
                  : showUnassignedTray
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                  : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
              }
            >
              {rooms.map(({ room, beds, occupantCount, pillowsRequired }) => {
                const isOver = dragOverTarget === room.id;

                return (
                  <section
                    key={room.id}
                    data-drop-target={room.id}
                    className={`rounded-xl border transition-all duration-150 flex flex-col ${
                      isCompactDrag ? 'min-h-[92px]' : 'min-h-[220px]'
                    } ${
                      isOver
                        ? 'border-[#486B56] bg-[#EEF3EF]/85 ring-2 ring-[#486B56]/25'
                        : 'border-[#E2DBD0] bg-white'
                    }`}
                  >
                    {/* Room Header */}
                    <div
                      className={`border-b border-[#E2DBD0] bg-[#FAF8F5] rounded-t-xl ${
                        isCompactDrag ? 'px-2.5 py-1.5' : 'px-4 py-3 space-y-1.5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          {isCompactDrag || readOnly ? (
                            <h3
                              className={`font-semibold text-[#1F1D1A] truncate ${
                                isCompactDrag ? 'text-xs' : 'text-base'
                              }`}
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {room.name}
                            </h3>
                          ) : (
                            <input
                              type="text"
                              defaultValue={room.name}
                              key={room.id + room.name}
                              onBlur={(e) => {
                                if (
                                  e.target.value.trim() &&
                                  e.target.value.trim() !== room.name
                                ) {
                                  onUpdateRoom(room.id, {
                                    name: e.target.value.trim(),
                                  });
                                }
                              }}
                              aria-label={`Room name for ${room.name}`}
                              className="w-full text-base font-semibold text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-1.5 py-0.5 -ml-1.5 focus:outline-none"
                              style={{ fontFamily: 'var(--font-display)' }}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[#635D54] tabular-nums whitespace-nowrap ${
                              isCompactDrag ? 'text-[10px]' : 'text-xs'
                            }`}
                          >
                            {isCompactDrag
                              ? `${beds.length}b · ${occupantCount}g`
                              : `${beds.length} ${
                                  beds.length === 1 ? 'bed' : 'beds'
                                } · ${occupantCount} ${
                                  occupantCount === 1 ? 'guest' : 'guests'
                                } · ${pillowsRequired} ${
                                  pillowsRequired === 1 ? 'pillow' : 'pillows'
                                }`}
                          </span>
                          {!readOnly && !isCompactDrag && (
                            <button
                              type="button"
                              onClick={() => onRemoveRoom(room.id)}
                              className="rounded-md p-1 text-[#8E867B] hover:bg-[#FAF0EC] hover:text-[#B85D43] transition-colors cursor-pointer"
                              aria-label={`Delete room ${room.name}`}
                              title="Remove room (beds return to unassigned tray)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {!isCompactDrag &&
                        (readOnly ? (
                          room.notes ? (
                            <p className="text-xs text-[#635D54]">{room.notes}</p>
                          ) : null
                        ) : (
                          <input
                            type="text"
                            defaultValue={room.notes}
                            key={room.id + '_notes_' + room.notes}
                            onBlur={(e) => {
                              if (e.target.value !== room.notes) {
                                onUpdateRoom(room.id, { notes: e.target.value });
                              }
                            }}
                            placeholder="Add room notes (outlets, bath, crib space...)"
                            aria-label={`Notes for ${room.name}`}
                            className="w-full text-xs text-[#4A453E] placeholder:text-[#9E968B] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-1.5 py-0.5 -ml-1.5 focus:outline-none"
                          />
                        ))}
                    </div>

                    {/* Dropped Beds Container */}
                    <div
                      className={
                        isCompactDrag
                          ? 'p-1.5 space-y-1 flex-1'
                          : 'p-3.5 space-y-2.5 flex-1'
                      }
                    >
                      {beds.length === 0 ? (
                        <div
                          className={`h-full rounded-lg border border-dashed border-[#D5CEC3] bg-[#FAF8F5]/60 flex flex-col items-center justify-center text-center ${
                            isCompactDrag ? 'min-h-[46px] p-1.5' : 'min-h-[110px] p-4'
                          }`}
                        >
                          {!isCompactDrag && (
                            <BedDouble className="w-5 h-5 text-[#9E968B] mb-1.5" />
                          )}
                          <p
                            className={`text-[#635D54] ${
                              isCompactDrag ? 'text-[10px]' : 'text-xs'
                            }`}
                          >
                            {readOnly
                              ? 'No beds assigned'
                              : isOver
                              ? 'Release to place'
                              : 'Drop beds here'}
                          </p>
                        </div>
                      ) : (
                        beds.map(renderBedCard)
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Drag Card (follows finger/pointer; offset above thumb on touch) */}
      {dragState && draggingBed && (
        <div
          aria-hidden="true"
          style={{
            left: dragState.pointerX,
            top: dragState.pointerY,
            transform: dragState.isTouch
              ? 'translate(-50%, -135%)'
              : 'translate(-50%, -50%)',
          }}
          className="pointer-events-none fixed z-50 w-52 max-w-[70vw] rounded-xl border-2 border-[#486B56] bg-white px-3 py-2 shadow-xl"
        >
          <p className="text-xs font-semibold text-[#1F1D1A] truncate">
            {draggingBed.occupantSummary}
          </p>
          <p className="text-[11px] text-[#635D54] truncate">
            {draggingBed.typeLabel}
            {draggingBed.bed.customLabel
              ? ` (${draggingBed.bed.customLabel})`
              : ''}
          </p>
          <p
            className={`mt-1 text-[11px] font-semibold truncate ${
              hoverTargetLabel ? 'text-[#2E4A39]' : 'text-[#8E867B]'
            }`}
          >
            {hoverTargetLabel ? `Drop → ${hoverTargetLabel}` : 'Drag to a room'}
          </p>
        </div>
      )}
    </div>
  );
};
