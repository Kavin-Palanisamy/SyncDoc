import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, Clock, User, FileText, CheckCircle2 } from 'lucide-react';
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
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleRollback = async (vNumber: number) => {
    if (window.confirm(`Are you sure you want to rollback to Version ${vNumber}? Current changes will be archived in a new version snapshot.`)) {
      setRollingBackVersion(vNumber);
      try {
        await onRollback(vNumber);
        await fetchVersions();
      } finally {
        setRollingBackVersion(null);
      }
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#0d121f]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 flex flex-col animate-fade-in">
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

      {/* Version Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading version timeline...
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No recorded snapshots yet. Edit and save to generate versions.
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
                      onClick={() => handleRollback(v.versionNumber)}
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
                    <Clock size={10} /> {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
