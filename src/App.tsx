import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FolderSync,
  Loader2,
  LogOut,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BedSourcesView } from './components/BedSourcesView';
import {
  ConnectSheetScreen,
  RecentSheetEntry,
} from './components/ConnectSheetScreen';
import { FamilySummaryView } from './components/FamilySummaryView';
import { RoomPlannerView } from './components/RoomPlannerView';
import { RosterView } from './components/RosterView';
import {
  ConfirmSyncModal,
  ShareLinkModal,
} from './components/ShareAndSyncModals';
import {
  addFamily,
  addLinenSourceAllocation,
  addPerson,
  addPillowSourceAllocation,
  addRoom,
  addSourceAllocation,
  assignPersonToExistingBed,
  assignPersonToNewBed,
  createEmptyPlannerState,
  createSamplePlannerState,
  moveBedToRoom,
  removeFamily,
  removeLinenSourceAllocation,
  removePerson,
  removePillowSourceAllocation,
  removeRoom,
  removeSourceAllocation,
  unassignPersonBed,
  updateBed,
  updateFamily,
  updateLinenSourceAllocation,
  updatePerson,
  updatePillowSourceAllocation,
  updateRoom,
  updateSourceAllocation,
} from './domain/plannerMath';
import { BedKind, BlanketType, PlannerState } from './domain/types';
import {
  clearCachedToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import { pickSpreadsheetWithGooglePicker } from './services/googlePicker';
import {
  createPlannerSpreadsheet,
  loadPlannerFromSpreadsheet,
  loadPublicReadOnlyPlanner,
  SheetsApiError,
  writePlannerToSpreadsheet,
} from './services/sheetsApi';

type ActiveTab = 'roster' | 'rooms' | 'sources' | 'summary';

const RECENT_SHEETS_STORAGE_KEY = 'hearth_bunk_recent_sheets_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'hearth_bunk_active_session_v1';

interface StoredWorkspaceSession {
  spreadsheetId: string;
  spreadsheetTitle: string;
  activeTab: ActiveTab;
  plannerState: PlannerState;
  hasUnsavedChanges: boolean;
  lastSyncedAt: string | null;
}

function loadActiveSession(): StoredWorkspaceSession | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWorkspaceSession>;
    if (!parsed || typeof parsed.spreadsheetId !== 'string' || !parsed.plannerState) {
      return null;
    }
    return {
      spreadsheetId: parsed.spreadsheetId,
      spreadsheetTitle: parsed.spreadsheetTitle || '',
      activeTab: parsed.activeTab || 'roster',
      plannerState: {
        ...createEmptyPlannerState(),
        ...parsed.plannerState,
        linenSources: Array.isArray(parsed.plannerState.linenSources)
          ? parsed.plannerState.linenSources
          : [],
        pillowSources: Array.isArray(parsed.plannerState.pillowSources)
          ? parsed.plannerState.pillowSources
          : [],
      },
      hasUnsavedChanges: Boolean(parsed.hasUnsavedChanges),
      lastSyncedAt: parsed.lastSyncedAt ?? null,
    };
  } catch {
    return null;
  }
}

function saveActiveSession(session: StoredWorkspaceSession | null) {
  try {
    if (!session) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_SESSION_STORAGE_KEY,
        JSON.stringify(session)
      );
    }
  } catch {
    // ignore storage errors
  }
}

function loadRecentSheets(): RecentSheetEntry[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SHEETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSheetEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecentSheet(spreadsheetId: string, title: string): RecentSheetEntry[] {
  const existing = loadRecentSheets().filter(
    (s) => s.spreadsheetId !== spreadsheetId
  );
  const next: RecentSheetEntry[] = [
    {
      spreadsheetId,
      title: title || 'Untitled Event',
      lastOpenedAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 6);
  try {
    window.localStorage.setItem(RECENT_SHEETS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

function isShareUrlPresent(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(new URLSearchParams(window.location.search).get('share'));
}

export default function App() {
  const initialSession = isShareUrlPresent() ? null : loadActiveSession();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialSession?.activeTab ?? 'roster'
  );
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(
    initialSession?.spreadsheetId ?? null
  );
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>(
    initialSession?.spreadsheetTitle ?? ''
  );
  const [readOnlyMode, setReadOnlyMode] = useState(false);

  const [plannerState, setPlannerState] = useState<PlannerState>(
    () => initialSession?.plannerState ?? createEmptyPlannerState()
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(
    initialSession?.hasUnsavedChanges ?? false
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialSession?.lastSyncedAt ?? null
  );

  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recentSheets, setRecentSheets] = useState<RecentSheetEntry[]>(() =>
    loadRecentSheets()
  );

  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Initialize Firebase auth listener (remembers signed-in user across page reloads)
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setHasToken(true);
        setAuthReady(true);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setHasToken(Boolean(getAccessToken()));
        setAuthReady(true);
      }
    );
    return unsubscribe;
  }, []);

  // Persist active editor workspace session (never stores any OAuth token)
  useEffect(() => {
    if (readOnlyMode) return;
    if (spreadsheetId) {
      saveActiveSession({
        spreadsheetId,
        spreadsheetTitle,
        activeTab,
        plannerState,
        hasUnsavedChanges,
        lastSyncedAt,
      });
    } else if (authReady) {
      saveActiveSession(null);
    }
  }, [
    authReady,
    readOnlyMode,
    spreadsheetId,
    spreadsheetTitle,
    activeTab,
    plannerState,
    hasUnsavedChanges,
    lastSyncedAt,
  ]);

  // If Firebase confirms user is signed out (and not in ?share= read-only view), return to connect screen
  useEffect(() => {
    if (authReady && !user && !readOnlyMode && !isShareUrlPresent() && spreadsheetId) {
      setSpreadsheetId(null);
      setSpreadsheetTitle('');
      setHasUnsavedChanges(false);
      saveActiveSession(null);
    }
  }, [authReady, user, readOnlyMode, spreadsheetId]);

  const openPublicShare = useCallback(
    async (id: string, updateUrl = false) => {
      setIsBusy(true);
      setErrorMessage(null);
      try {
        const res = await loadPublicReadOnlyPlanner(id);
        setSpreadsheetId(res.spreadsheetId);
        setSpreadsheetTitle(res.state.eventName || 'Shared Family Event');
        setPlannerState(res.state);
        setReadOnlyMode(true);
        setHasUnsavedChanges(false);
        setActiveTab('summary');
        if (updateUrl) {
          const nextUrl = `${window.location.pathname}?share=${encodeURIComponent(id)}`;
          window.history.replaceState({}, '', nextUrl);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to open this shared spreadsheet.'
        );
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  // Handle ?share=<spreadsheetId> on initial load without requiring login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      void openPublicShare(shareId, false);
    }
  }, [openPublicShare]);

  const handleSignIn = async (loginHintEmail?: string | null): Promise<string | null> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn(loginHintEmail);
      if (res) {
        setUser(res.user);
        setHasToken(true);
        return res.accessToken;
      }
      return null;
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Google sign-in failed. Please try again.'
      );
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    saveActiveSession(null);
    if (!readOnlyMode) {
      setSpreadsheetId(null);
      setSpreadsheetTitle('');
      setHasUnsavedChanges(false);
    }
  };

  const handleCreateNewSheet = async (eventName: string, seedSample: boolean) => {
    let token = getAccessToken();
    if (!token) {
      token = await handleSignIn(user?.email);
      if (!token) return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const initialState = seedSample
        ? { ...createSamplePlannerState(), eventName }
        : createEmptyPlannerState(eventName);

      const created = await createPlannerSpreadsheet(
        token,
        eventName,
        initialState
      );

      setSpreadsheetId(created.spreadsheetId);
      setSpreadsheetTitle(created.title);
      setPlannerState(initialState);
      setReadOnlyMode(false);
      setHasUnsavedChanges(false);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setRecentSheets(saveRecentSheet(created.spreadsheetId, created.title));
      setActiveTab('roster');
      window.history.replaceState({}, '', window.location.pathname);
      showToast('Created new Google Spreadsheet');
    } catch (err) {
      if (err instanceof SheetsApiError && err.status === 401) {
        clearCachedToken();
        setHasToken(false);
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to create Google Spreadsheet.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenGooglePicker = async () => {
    let token = getAccessToken();
    if (!token) {
      token = await handleSignIn(user?.email);
      if (!token) return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const picked = await pickSpreadsheetWithGooglePicker(token);
      if (picked) {
        await handleConnectExistingSheet(picked.spreadsheetId);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to open Google Picker. Please try again.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConnectExistingSheet = async (id: string) => {
    let token = getAccessToken();
    if (!token) {
      token = await handleSignIn(user?.email);
      if (!token) return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      const loaded = await loadPlannerFromSpreadsheet(token, id);
      setSpreadsheetId(loaded.summary.spreadsheetId);
      setSpreadsheetTitle(loaded.summary.title);
      setPlannerState(loaded.state);
      setReadOnlyMode(false);
      setHasUnsavedChanges(false);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setRecentSheets(
        saveRecentSheet(loaded.summary.spreadsheetId, loaded.summary.title)
      );
      setActiveTab('roster');
      window.history.replaceState({}, '', window.location.pathname);

      if (loaded.initializedMissingTabs.length > 0) {
        showToast(
          `Connected sheet and initialized tabs: ${loaded.initializedMissingTabs.join(
            ', '
          )}`
        );
      } else {
        showToast('Loaded plan from Google Sheets');
      }
    } catch (err) {
      if (err instanceof SheetsApiError && err.status === 401) {
        clearCachedToken();
        setHasToken(false);
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to load Google Spreadsheet.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleReloadFromSheet = async () => {
    if (!spreadsheetId) return;
    if (readOnlyMode) {
      await openPublicShare(spreadsheetId, false);
      showToast('Refreshed read-only view');
      return;
    }
    await handleConnectExistingSheet(spreadsheetId);
  };

  const handleConfirmSyncToSheet = async () => {
    if (!spreadsheetId) return;
    let token = getAccessToken();
    if (!token) {
      token = await handleSignIn(user?.email);
      if (!token) return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await writePlannerToSpreadsheet(token, spreadsheetId, plannerState);
      setHasUnsavedChanges(false);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setShowSyncConfirm(false);
      setRecentSheets(
        saveRecentSheet(spreadsheetId, plannerState.eventName || spreadsheetTitle)
      );
      showToast('Saved changes to Google Sheets');
    } catch (err) {
      if (err instanceof SheetsApiError && err.status === 401) {
        clearCachedToken();
        setHasToken(false);
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save to Google Sheets.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const applyEdit = useCallback(
    (updater: (prev: PlannerState) => PlannerState) => {
      if (readOnlyMode) return;
      setPlannerState((prev) => updater(prev));
      setHasUnsavedChanges(true);
    },
    [readOnlyMode]
  );

  const handleSwitchSheet = () => {
    saveActiveSession(null);
    setSpreadsheetId(null);
    setSpreadsheetTitle('');
    setReadOnlyMode(false);
    setHasUnsavedChanges(false);
    setErrorMessage(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const hasActiveSheet = Boolean(spreadsheetId);
  const isSignedIn = Boolean(user) || hasToken;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1F1D1A]">
      {/* Strictly 3-Zone Top Navigation Bar */}
      <header className="no-print border-b border-[#E2DBD0] bg-white">
        <div className="mx-auto max-w-[1440px] px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (!hasActiveSheet) return;
              setActiveTab('roster');
            }}
            className="text-xl font-semibold tracking-tight text-[#1F1D1A] whitespace-nowrap shrink-0 cursor-pointer"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Hearth &amp; Bunk
          </button>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {hasActiveSheet ? (
              <>
                {(
                  [
                    { id: 'roster', label: 'Roster & Beds' },
                    { id: 'rooms', label: 'Room Planner' },
                    { id: 'sources', label: 'Bed Sources' },
                    { id: 'summary', label: 'Family Summary' },
                  ] as const
                ).map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-[#486B56] text-[#1F1D1A]'
                          : 'border-transparent text-[#635D54] hover:text-[#1F1D1A]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </>
            ) : (
              <span className="text-sm text-[#635D54] whitespace-nowrap shrink-0">
                Family Sleeping Arrangement Planner
              </span>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {hasActiveSheet && !readOnlyMode ? (
              <button
                type="button"
                onClick={() => setShowSyncConfirm(true)}
                disabled={isBusy}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-[#486B56] text-white hover:bg-[#3A5746]'
                    : 'border border-[#D5CEC3] bg-[#FAF8F5] text-[#1F1D1A] hover:bg-[#F2EDE5]'
                }`}
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderSync className="w-4 h-4" />
                )}
                {hasUnsavedChanges ? 'Save to Sheet' : 'Saved to Sheet'}
              </button>
            ) : hasActiveSheet && readOnlyMode ? (
              <button
                type="button"
                onClick={() => {
                  if (spreadsheetId) {
                    void handleConnectExistingSheet(spreadsheetId);
                  }
                }}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Edit with Google
              </button>
            ) : isSignedIn ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D5CEC3] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#635D54]" />
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Strip (when sheet active) */}
        {hasActiveSheet && (
          <div className="md:hidden border-t border-[#EFEAE2] px-4 flex items-center gap-4 overflow-x-auto">
            {(
              [
                { id: 'roster', label: 'Roster & Beds' },
                { id: 'rooms', label: 'Room Planner' },
                { id: 'sources', label: 'Bed Sources' },
                { id: 'summary', label: 'Family Summary' },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-[#486B56] text-[#1F1D1A]'
                      : 'border-transparent text-[#635D54]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Workspace Sub-Bar (when sheet active) */}
      {hasActiveSheet && spreadsheetId && (
        <div className="no-print border-b border-[#E2DBD0] bg-[#F2EDE5]/65">
          <div className="mx-auto max-w-[1440px] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              {readOnlyMode ? (
                <span className="text-sm font-semibold text-[#1F1D1A]">
                  {plannerState.eventName || spreadsheetTitle}
                </span>
              ) : (
                <input
                  type="text"
                  value={plannerState.eventName}
                  onChange={(e) =>
                    applyEdit((prev) => ({ ...prev, eventName: e.target.value }))
                  }
                  aria-label="Event title"
                  className="text-sm font-semibold text-[#1F1D1A] bg-transparent border border-transparent hover:border-[#D5CEC3] focus:border-[#486B56] focus:bg-white rounded-md px-2 py-0.5 -ml-2 focus:outline-none"
                />
              )}

              <span className="text-xs text-[#635D54]">
                {readOnlyMode
                  ? 'Read-only shared view (no login required)'
                  : hasUnsavedChanges
                  ? 'Unsaved edits · click Save to Sheet'
                  : lastSyncedAt
                  ? `Synced at ${lastSyncedAt}`
                  : 'Connected to Google Sheets'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/${
                  readOnlyMode ? 'view' : 'edit'
                }`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1.5 font-medium text-[#1F1D1A] hover:bg-[#FAF8F5] transition-colors whitespace-nowrap"
              >
                Open Sheet
                <ExternalLink className="w-3 h-3 text-[#635D54]" />
              </a>

              <button
                type="button"
                onClick={() => void handleReloadFromSheet()}
                disabled={isBusy}
                className="inline-flex items-center gap-1 rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1.5 font-medium text-[#1F1D1A] hover:bg-[#FAF8F5] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3 h-3 text-[#635D54] ${isBusy ? 'animate-spin' : ''}`} />
                Reload
              </button>

              {!readOnlyMode && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1.5 font-medium text-[#1F1D1A] hover:bg-[#FAF8F5] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3 h-3 text-[#486B56]" />
                  Share Link
                </button>
              )}

              <button
                type="button"
                onClick={handleSwitchSheet}
                className="rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1.5 font-medium text-[#635D54] hover:text-[#1F1D1A] hover:bg-[#FAF8F5] transition-colors cursor-pointer whitespace-nowrap"
              >
                Switch Sheet
              </button>

              {user && !readOnlyMode && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-md px-2 py-1.5 font-medium text-[#635D54] hover:text-[#B85D43] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {!hasActiveSheet ? (
          <ConnectSheetScreen
            isAuthenticated={isSignedIn}
            userEmail={user?.email}
            isBusy={isBusy}
            errorMessage={errorMessage}
            recentSheets={recentSheets}
            onSignIn={() => void handleSignIn()}
            onCreateNewSheet={(name, seed) => void handleCreateNewSheet(name, seed)}
            onOpenPicker={() => void handleOpenGooglePicker()}
            onConnectExistingSheet={(id) => void handleConnectExistingSheet(id)}
            onOpenPublicReadOnly={(id) => void openPublicShare(id, true)}
          />
        ) : (
          <div className="mx-auto max-w-[1440px] px-6 py-7 space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-lg border border-[#B85D43]/40 bg-[#FAF0EC] px-4 py-3 text-sm text-[#7E3724]"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-xs font-medium underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {activeTab === 'roster' && (
              <RosterView
                state={plannerState}
                readOnly={readOnlyMode}
                onAddFamily={(name) => applyEdit((s) => addFamily(s, name))}
                onUpdateFamily={(id, name) =>
                  applyEdit((s) => updateFamily(s, id, name))
                }
                onRemoveFamily={(id) => applyEdit((s) => removeFamily(s, id))}
                onAddPerson={(
                  famId,
                  name,
                  notes,
                  blanketType: BlanketType
                ) =>
                  applyEdit(
                    (s) => addPerson(s, famId, name, notes, blanketType).state
                  )
                }
                onUpdatePerson={(id, patch) =>
                  applyEdit((s) => updatePerson(s, id, patch))
                }
                onRemovePerson={(id) => applyEdit((s) => removePerson(s, id))}
                onAssignNewBed={(personId, size, kind: BedKind, label) =>
                  applyEdit(
                    (s) => assignPersonToNewBed(s, personId, size, kind, label).state
                  )
                }
                onUpdateBed={(bedId, size, kind: BedKind, label) =>
                  applyEdit((s) =>
                    updateBed(s, bedId, { size, kind, customLabel: label })
                  )
                }
                onJoinSharedBed={(personId, targetBedId) =>
                  applyEdit((s) =>
                    assignPersonToExistingBed(s, personId, targetBedId)
                  )
                }
                onUnassignBed={(personId) =>
                  applyEdit((s) => unassignPersonBed(s, personId))
                }
              />
            )}

            {activeTab === 'rooms' && (
              <RoomPlannerView
                state={plannerState}
                readOnly={readOnlyMode}
                onAddRoom={(name, notes) =>
                  applyEdit((s) => addRoom(s, name, notes))
                }
                onUpdateRoom={(roomId, patch) =>
                  applyEdit((s) => updateRoom(s, roomId, patch))
                }
                onRemoveRoom={(roomId) => applyEdit((s) => removeRoom(s, roomId))}
                onMoveBedToRoom={(bedId, roomId) =>
                  applyEdit((s) => moveBedToRoom(s, bedId, roomId))
                }
              />
            )}

            {activeTab === 'sources' && (
              <BedSourcesView
                state={plannerState}
                readOnly={readOnlyMode}
                onAddSource={(bedTypeKey, sourceName, qty) =>
                  applyEdit((s) =>
                    addSourceAllocation(s, bedTypeKey, sourceName, qty)
                  )
                }
                onUpdateSource={(sourceId, patch) =>
                  applyEdit((s) => updateSourceAllocation(s, sourceId, patch))
                }
                onRemoveSource={(sourceId) =>
                  applyEdit((s) => removeSourceAllocation(s, sourceId))
                }
                onAddLinenSource={(size, sourceName, counts) =>
                  applyEdit((s) =>
                    addLinenSourceAllocation(s, size, sourceName, counts)
                  )
                }
                onUpdateLinenSource={(linenSourceId, patch) =>
                  applyEdit((s) =>
                    updateLinenSourceAllocation(s, linenSourceId, patch)
                  )
                }
                onRemoveLinenSource={(linenSourceId) =>
                  applyEdit((s) => removeLinenSourceAllocation(s, linenSourceId))
                }
                onAddPillowSource={(sourceName, qty) =>
                  applyEdit((s) => addPillowSourceAllocation(s, sourceName, qty))
                }
                onUpdatePillowSource={(pillowSourceId, patch) =>
                  applyEdit((s) =>
                    updatePillowSourceAllocation(s, pillowSourceId, patch)
                  )
                }
                onRemovePillowSource={(pillowSourceId) =>
                  applyEdit((s) =>
                    removePillowSourceAllocation(s, pillowSourceId)
                  )
                }
              />
            )}

            {activeTab === 'summary' && (
              <FamilySummaryView state={plannerState} readOnly={readOnlyMode} />
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showSyncConfirm && spreadsheetId && (
        <ConfirmSyncModal
          spreadsheetTitle={plannerState.eventName || spreadsheetTitle}
          spreadsheetId={spreadsheetId}
          state={plannerState}
          isSyncing={isBusy}
          onConfirm={() => void handleConfirmSyncToSheet()}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}

      {showShareModal && spreadsheetId && (
        <ShareLinkModal
          spreadsheetId={spreadsheetId}
          spreadsheetTitle={plannerState.eventName || spreadsheetTitle}
          hasUnsavedChanges={hasUnsavedChanges}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="no-print fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-lg border border-[#486B56]/40 bg-[#1F1D1A] px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <Check className="w-4 h-4 text-[#8BC49E]" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
