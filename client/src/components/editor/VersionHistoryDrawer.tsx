import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  X,
  Clock,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Bookmark,
} from 'lucide-react';
import { ApiService, VersionSummary } from '../../services/api.js';

interface VersionHistoryDrawerProps {
  documentId: string;
  currentVersion: number;
  isOpen: boolean;
  onClose: () => void;
  onRollback: (versionNumber: number) => Promise<void>;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  documentId,
  currentVersion,
  isOpen,
  onClose,
  onRollback,
}) => {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [confirmRollbackTarget, setConfirmRollbackTarget] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const list = await ApiService.getVersionHistory(documentId);
      setVersions(list);
    } catch (err) {
      console.error('Failed to load version history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setFeedbackMessage(null);
      setConfirmRollbackTarget(null);
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const author = localStorage.getItem('syncdoc_user_name') || 'You';
      await ApiService.createVersionSnapshot(documentId, author, 'Manual snapshot saved');
      await fetchVersions();
      setFeedbackMessage({ type: 'success', text: 'New version snapshot created successfully!' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to create snapshot' });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const executeRollback = async (vNumber: number) => {
    setRollingBackVersion(vNumber);
    setConfirmRollbackTarget(null);
    try {
      await onRollback(vNumber);
      await fetchVersions();
      setFeedbackMessage({ type: 'success', text: `Document restored to Version ${vNumber}!` });
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || `Rollback to Version ${vNumber} failed.` });
    } finally {
      setRollingBackVersion(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-[#0d121f]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center">
            <History size={16} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Version History</h3>
            <p className="text-[11px] text-slate-400">Archived snapshots & rollback timeline</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="btn-editor-icon"
          title="Close version history"
          aria-label="Close version history"
        >
          <X size={16} />
        </button>
      </div>

      {/* Snapshot Action Bar */}
      <div className="px-5 py-2.5 bg-black/20 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[11.5px] text-slate-400">
          Current State: <span className="text-blue-400 font-mono font-bold">v{currentVersion}</span>
        </span>
        <button
          type="button"
          disabled={isCreatingSnapshot}
          onClick={handleCreateSnapshot}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/50 border border-blue-800/40 hover:bg-blue-900/50 transition-colors"
        >
          <Bookmark size={12} />
          <span>{isCreatingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/40'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 size={13} className="shrink-0" />
          ) : (
            <AlertCircle size={13} className="shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Confirmation Modal / Banner for Rollback */}
      {confirmRollbackTarget !== null && (
        <div className="p-4 bg-amber-950/40 border-b border-amber-800/50 text-xs">
          <p className="text-amber-200 font-semibold mb-1">
            Rollback to Version {confirmRollbackTarget}?
          </p>
          <p className="text-amber-300/80 text-[11.5px] mb-3">
            Your document content will be reverted to this snapshot. A new snapshot will be created preserving current edits.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => executeRollback(confirmRollbackTarget)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded text-xs transition-colors"
            >
              Confirm Rollback
            </button>
            <button
              onClick={() => setConfirmRollbackTarget(null)}
              className="px-3 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Version Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading version timeline...
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No snapshots recorded yet. Use &quot;Save Snapshot&quot; above to capture version checkpoints.
          </div>
        ) : (
          versions.map((v) => {
            const isCurrent = v.versionNumber === currentVersion;
            return (
              <div
                key={v._id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-blue-950/30 border-blue-500/40 shadow-md shadow-blue-950/40'
                    : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/40">
                      v{v.versionNumber}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </div>

                  {!isCurrent && (
                    <button
                      disabled={rollingBackVersion === v.versionNumber}
                      onClick={() => setConfirmRollbackTarget(v.versionNumber)}
                      className="btn-editor-secondary h-6 px-2 text-[11px] text-cyan-400 border-cyan-800/40 hover:bg-cyan-950/40"
                      title={`Rollback to version ${v.versionNumber}`}
                      aria-label={`Rollback to version ${v.versionNumber}`}
                    >
                      <RotateCcw size={11} />
                      <span>{rollingBackVersion === v.versionNumber ? 'Reverting...' : 'Rollback'}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-200 mb-2 font-medium leading-relaxed">
                  {v.changeDescription}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <User size={10} /> {v.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />{' '}
                    {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={10} /> {v.nodeCount} blocks
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
