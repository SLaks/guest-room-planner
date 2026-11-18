import React, { useState } from 'react';
import {
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Link2,
  Loader2,
  Plus,
} from 'lucide-react';
import { extractSpreadsheetId } from '../domain/sheetCodec';
import { GoogleSignInButton } from './GoogleSignInButton';

export interface RecentSheetEntry {
  spreadsheetId: string;
  title: string;
  lastOpenedAt: string;
}

interface ConnectSheetScreenProps {
  isAuthenticated: boolean;
  userEmail?: string | null;
  isBusy: boolean;
  errorMessage: string | null;
  recentSheets: RecentSheetEntry[];
  onSignIn: () => void;
  onCreateNewSheet: (eventName: string, seedSample: boolean) => void;
  onOpenPicker: () => void;
  onConnectExistingSheet: (spreadsheetId: string) => void;
  onOpenPublicReadOnly: (spreadsheetId: string) => void;
}

export const ConnectSheetScreen: React.FC<ConnectSheetScreenProps> = ({
  isAuthenticated,
  userEmail,
  isBusy,
  errorMessage,
  recentSheets,
  onSignIn,
  onCreateNewSheet,
  onOpenPicker,
  onConnectExistingSheet,
  onOpenPublicReadOnly,
}) => {
  const [newEventName, setNewEventName] = useState('Family Reunion 2026');
  const [seedSample, setSeedSample] = useState(true);
  const [publicInput, setPublicInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!newEventName.trim()) {
      setLocalError('Please enter a name for your event spreadsheet.');
      return;
    }
    onCreateNewSheet(newEventName.trim(), seedSample);
  };

  const handleOpenPublic = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const id = extractSpreadsheetId(publicInput);
    if (!id) {
      setLocalError(
        'Enter a valid public Google Sheets URL or share link ID.'
      );
      return;
    }
    onOpenPublicReadOnly(id);
  };

  const displayError = localError || errorMessage;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Primary Setup */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-[#635D54] mb-2">
              Google Sheets Backed Event Planner
            </p>
            <h1
              className="text-3xl sm:text-4xl font-semibold text-[#1F1D1A] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              Plan every bed, room, and borrowed mattress in one calm workspace.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#635D54] max-w-2xl">
              Your families, bed assignments, room placements, and mattress source splits live directly inside a Google Spreadsheet you own and control.
            </p>
          </div>

          {displayError && (
            <div
              role="alert"
              className="rounded-lg border border-[#B85D43]/40 bg-[#FAF0EC] px-4 py-3 text-sm text-[#7E3724]"
            >
              {displayError}
            </div>
          )}

          {!isAuthenticated ? (
            <div className="rounded-xl border border-[#E2DBD0] bg-white p-6 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[#1F1D1A]">
                  Sign in to create or edit an event sheet
                </h2>
                <p className="mt-1 text-sm text-[#635D54]">
                  Connect with Google to create a new event spreadsheet or open an existing sheet from your Drive.
                </p>
                <div className="mt-4">
                  <GoogleSignInButton
                    onClick={onSignIn}
                    disabled={isBusy}
                    label={isBusy ? 'Connecting...' : 'Sign in with Google'}
                  />
                </div>
              </div>

              <div className="border-t border-[#E2DBD0] pt-5">
                <h3 className="text-sm font-semibold text-[#1F1D1A]">
                  Have a public read-only spreadsheet link?
                </h3>
                <p className="mt-1 text-xs text-[#635D54]">
                  View any publicly shared event spreadsheet without signing in.
                </p>
                <form onSubmit={handleOpenPublic} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={publicInput}
                    onChange={(e) => setPublicInput(e.target.value)}
                    placeholder="Paste public Google Sheet URL or ID..."
                    className="flex-1 rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-3 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8E867B] focus:border-[#486B56] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D5CEC3] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-[#486B56]" />
                    View Read-Only
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Create New Sheet */}
              <form
                onSubmit={handleCreate}
                className="rounded-xl border border-[#E2DBD0] bg-white p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#1F1D1A]">
                      Create a new event spreadsheet
                    </h2>
                    <p className="mt-1 text-sm text-[#635D54]">
                      Creates a pre-formatted Google Sheet in {userEmail ? `your account (${userEmail})` : 'your Google account'} with all planning tabs ready.
                    </p>
                  </div>
                  <FileSpreadsheet className="w-5 h-5 text-[#486B56] shrink-0 mt-0.5" />
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="new-event-name"
                      className="block text-xs font-medium text-[#635D54] mb-1.5"
                    >
                      Event &amp; Spreadsheet Title
                    </label>
                    <input
                      id="new-event-name"
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g., Thanksgiving Lakehouse Reunion"
                      className="w-full rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#486B56] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 text-sm text-[#4A453E] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={seedSample}
                      onChange={(e) => setSeedSample(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D5CEC3] accent-[#486B56]"
                    />
                    Include starter example families, rooms, and beds (you can edit or clear anytime)
                  </label>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#486B56] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3A5746] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Create Google Spreadsheet
                  </button>
                </div>
              </form>

              {/* Choose Existing Sheet via Google Picker */}
              <div className="rounded-xl border border-[#E2DBD0] bg-white p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1F1D1A]">
                    Open an existing Google Spreadsheet
                  </h2>
                  <p className="mt-1 text-sm text-[#635D54]">
                    Choose a specific spreadsheet from your Google Drive. This app only receives permission to access the spreadsheet you select or create here.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onOpenPicker}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#486B56] bg-[#EEF3EF] px-4 py-2.5 text-sm font-medium text-[#2E4A39] hover:bg-[#E1EBE3] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                    Choose Spreadsheet with Google Picker
                  </button>
                </div>

                {recentSheets.length > 0 && (
                  <div className="border-t border-[#E2DBD0] pt-4">
                    <p className="text-xs font-medium text-[#635D54] mb-2">
                      Recently Opened Spreadsheets
                    </p>
                    <div className="divide-y divide-[#EFEAE2] border border-[#E2DBD0] rounded-lg overflow-hidden">
                      {recentSheets.map((entry) => (
                        <div
                          key={entry.spreadsheetId}
                          className="flex items-center justify-between gap-3 bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[#1F1D1A] truncate">
                              {entry.title}
                            </p>
                            <p className="text-xs text-[#635D54] font-mono truncate">
                              {entry.spreadsheetId}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}/edit`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-[#635D54] hover:text-[#1F1D1A] rounded-md"
                              title="Open in Google Sheets"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onConnectExistingSheet(entry.spreadsheetId)}
                              className="rounded-md border border-[#D5CEC3] bg-white px-3 py-1 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Editorial Workflow Guide */}
        <aside className="lg:col-span-5 rounded-xl border border-[#E2DBD0] bg-[#F2EDE5]/70 p-6 space-y-5">
          <div>
            <h2
              className="text-lg font-semibold text-[#1F1D1A]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              How the Event Planner Works
            </h2>
            <p className="mt-1 text-sm text-[#635D54]">
              Designed for multi-family house stays, reunions, and group trips.
            </p>
          </div>

          <ol className="space-y-4 text-sm">
            <li className="border-t border-[#E2DBD0] pt-3.5">
              <p className="font-semibold text-[#1F1D1A]">
                01. Map Families &amp; Shared or Solo Beds
              </p>
              <p className="mt-0.5 text-[#635D54] leading-relaxed">
                List each family and guest with personal notes. Assign individuals to their own bed or pair couples and siblings onto a single shared bed—real mattress, any-size air mattress, toddler bed, or pack &amp; play.
              </p>
            </li>
            <li className="border-t border-[#E2DBD0] pt-3.5">
              <p className="font-semibold text-[#1F1D1A]">
                02. Drag &amp; Drop Beds into Rooms
              </p>
              <p className="mt-0.5 text-[#635D54] leading-relaxed">
                Add room names and room notes, then drag beds from the unassigned tray into rooms. Shared beds move both sleepers together.
              </p>
            </li>
            <li className="border-t border-[#E2DBD0] pt-3.5">
              <p className="font-semibold text-[#1F1D1A]">
                03. Divide Bed Types Across Sources
              </p>
              <p className="mt-0.5 text-[#635D54] leading-relaxed">
                See exact counts per mattress type and split each group across sources—such as 4 from home and 3 borrowed from Joe—with live balance verification.
              </p>
            </li>
            <li className="border-t border-[#E2DBD0] pt-3.5">
              <p className="font-semibold text-[#1F1D1A]">
                04. Share Read-Only with Relatives
              </p>
              <p className="mt-0.5 text-[#635D54] leading-relaxed">
                Generate a family-by-family summary and a read-only share link that works without login whenever your Google Sheet is set to &ldquo;Anyone with the link can view.&rdquo;
              </p>
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
};
