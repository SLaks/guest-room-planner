import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import { buildSyncSummaryDescription } from '../domain/sheetCodec';
import { PlannerState } from '../domain/types';
import { loadPublicReadOnlyPlanner } from '../services/sheetsApi';

interface ConfirmSyncModalProps {
  spreadsheetTitle: string;
  spreadsheetId: string;
  state: PlannerState;
  isSyncing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmSyncModal: React.FC<ConfirmSyncModalProps> = ({
  spreadsheetTitle,
  spreadsheetId,
  state,
  isSyncing,
  onConfirm,
  onCancel,
}) => {
  const summaryDesc = buildSyncSummaryDescription(state);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D1A]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-confirm-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#D5CEC3] bg-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DBD0] bg-[#FAF8F5] px-5 py-4">
          <div>
            <p className="text-xs font-medium text-[#635D54]">Google Sheets Sync</p>
            <h2
              id="sync-confirm-title"
              className="text-lg font-semibold text-[#1F1D1A]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Save changes to spreadsheet?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSyncing}
            className="rounded-md p-1.5 text-[#635D54] hover:bg-[#EAE3D8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-[#4A453E]">
          <p className="leading-relaxed">
            This will update <span className="font-semibold text-[#1F1D1A]">{spreadsheetTitle}</span> across all 8 planning tabs (<span className="font-mono text-xs">EventMeta, Families, People, Beds, Rooms, BedSources, LinenSources, PillowSources</span>) with:
          </p>

          <div className="rounded-lg border border-[#E2DBD0] bg-[#FAF8F5] px-3.5 py-3 text-sm font-medium text-[#1F1D1A]">
            {summaryDesc}
          </div>

          <p className="text-xs text-[#635D54] font-mono truncate">
            Sheet ID: {spreadsheetId}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2DBD0]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSyncing}
              className="rounded-lg border border-[#D5CEC3] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#486B56] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A5746] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSyncing ? 'Saving...' : 'Confirm & Save to Sheet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShareLinkModalProps {
  spreadsheetId: string;
  spreadsheetTitle: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  spreadsheetId,
  spreadsheetTitle,
  hasUnsavedChanges,
  onClose,
}) => {
  const shareUrl = `${window.location.origin}/?share=${encodeURIComponent(
    spreadsheetId
  )}`;
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    status: 'idle' | 'public' | 'private';
    message: string;
  }>({ status: 'idle', message: '' });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback selection handled silently
    }
  };

  const handleVerifyPublicAccess = async () => {
    setChecking(true);
    try {
      await loadPublicReadOnlyPlanner(spreadsheetId);
      setCheckResult({
        status: 'public',
        message:
          'Public read access verified. Anyone with this link can view the sleeping plan without logging in.',
      });
    } catch (err) {
      setCheckResult({
        status: 'private',
        message:
          err instanceof Error
            ? err.message
            : 'Spreadsheet is not publicly readable yet.',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1D1A]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#D5CEC3] bg-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DBD0] bg-[#FAF8F5] px-5 py-4">
          <div>
            <p className="text-xs font-medium text-[#635D54]">{spreadsheetTitle}</p>
            <h2
              id="share-modal-title"
              className="text-lg font-semibold text-[#1F1D1A]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Read-Only Share Link
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#635D54] hover:bg-[#EAE3D8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {hasUnsavedChanges && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#A36A1F]/40 bg-[#FDF6EA] px-3.5 py-2.5 text-xs text-[#6E4510]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                You have unsaved edits locally. Save to Google Sheets first so guests opening this link see the latest plan.
              </span>
            </div>
          )}

          <p className="text-[#4A453E] leading-relaxed">
            Anyone can open this read-only link <strong>without signing in</strong>, as long as the underlying Google Spreadsheet is shared as &ldquo;Anyone with the link can view.&rdquo;
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-lg border border-[#D5CEC3] bg-[#FAF8F5] px-3 py-2 text-xs font-mono text-[#1F1D1A] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#486B56] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#3A5746] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          <div className="rounded-lg border border-[#E2DBD0] bg-[#FAF8F5] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#1F1D1A]">
                Public Read Access Check
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#486B56] hover:underline"
                >
                  Open Sheet Settings
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={handleVerifyPublicAccess}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#D5CEC3] bg-white px-2.5 py-1 text-xs font-medium text-[#1F1D1A] hover:bg-[#F2EDE5] cursor-pointer"
                >
                  {checking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Share2 className="w-3 h-3 text-[#486B56]" />
                  )}
                  {checking ? 'Checking...' : 'Test Public Access'}
                </button>
              </div>
            </div>

            {checkResult.status === 'public' && (
              <div className="flex items-start gap-2 text-xs text-[#2E4A39]">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#486B56]" />
                <span>{checkResult.message}</span>
              </div>
            )}

            {checkResult.status === 'private' && (
              <div className="flex items-start gap-2 text-xs text-[#7E3724]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B85D43]" />
                <span>{checkResult.message}</span>
              </div>
            )}

            {checkResult.status === 'idle' && (
              <p className="text-xs text-[#635D54]">
                In Google Sheets, click <strong>Share → General access → Anyone with the link (Viewer)</strong>, then click &ldquo;Test Public Access.&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
