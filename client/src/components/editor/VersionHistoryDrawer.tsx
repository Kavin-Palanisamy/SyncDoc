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
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="text-blue-400" size={18} />
          <h3 className="font-display font-bold text-slate-100 text-base">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Version Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Loading version timeline...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No recorded snapshots yet.</div>
        ) : (
          versions.map((v) => {
            const isCurrent = v.versionNumber === currentVersion;
            return (
              <div
                key={v._id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-950/50'
                    : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-blue-300">
                      v{v.versionNumber}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </div>

                  {!isCurrent && (
                    <button
                      disabled={rollingBackVersion === v.versionNumber}
                      onClick={() => handleRollback(v.versionNumber)}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-900/40 transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>{rollingBackVersion === v.versionNumber ? 'Reverting...' : 'Rollback'}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-300 mb-2 font-medium">
                  {v.changeDescription}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <User size={10} /> {v.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={10} /> {v.nodeCount} nodes
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
