import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  RefreshCw,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import { ApiService, VersionSummary } from '../../services/api.js';
import './InlineVersionHistory.css';

interface InlineVersionHistoryProps {
  documentId: string;
  currentVersion: number;
  onRollback: (versionNumber: number) => Promise<void>;
  sectionRef: React.RefObject<HTMLElement>;
}

export const InlineVersionHistory: React.FC<InlineVersionHistoryProps> = ({
  documentId,
  currentVersion,
  onRollback,
  sectionRef,
}) => {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [confirmRollbackTarget, setConfirmRollbackTarget] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const list = await ApiService.getVersionHistory(documentId);
      setVersions(list);
    } catch (err: any) {
      console.error('Failed to load version history:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Unable to retrieve version timeline from server. Please retry.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchVersions();
    }
  }, [documentId, currentVersion]);

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    setFeedbackMessage(null);
    try {
      const author = localStorage.getItem('syncdoc_user_name') || 'You';
      await ApiService.createVersionSnapshot(
        documentId,
        author,
        `Manual snapshot checkpoint at v${currentVersion}`
      );
      await fetchVersions();
      setFeedbackMessage({
        type: 'success',
        text: 'New version snapshot created successfully!',
      });
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Failed to create snapshot.',
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleConfirmRollback = async (vNumber: number) => {
    setRollingBackVersion(vNumber);
    setConfirmRollbackTarget(null);
    setFeedbackMessage(null);
    try {
      await onRollback(vNumber);
      await fetchVersions();
      setFeedbackMessage({
        type: 'success',
        text: `Document successfully restored to Version ${vNumber}!`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || `Rollback to Version ${vNumber} failed.`,
      });
    } finally {
      setRollingBackVersion(null);
    }
  };

  return (
    <section
      id="version-history-section"
      ref={sectionRef}
      className="inline-history-section"
      aria-label="Version History"
    >
      {/* Section Header */}
      <div className="history-section-header">
        <div className="history-header-left">
          <div className="history-icon-pill">
            <History size={18} />
          </div>
          <div>
            <h2 className="history-title">Version History</h2>
            <p className="history-subtitle">
              Inspect document revision checkpoints, verify AST snapshots, and rollback to prior versions
            </p>
          </div>
        </div>

        <div className="history-header-actions">
          <button
            type="button"
            onClick={fetchVersions}
            disabled={loading}
            className="btn-editor-secondary"
            title="Refresh version timeline"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="btn-editor-primary"
            title="Create and save a new version snapshot"
          >
            {isCreatingSnapshot ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Bookmark size={13} />
            )}
            <span>{isCreatingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Info Ribbon */}
      <div className="history-status-ribbon">
        <div className="history-current-pill">
          <span>Current Document State:</span>
          <span className="history-version-badge">v{currentVersion}</span>
        </div>
        <div className="history-count-tag">
          {versions.length} recorded {versions.length === 1 ? 'checkpoint' : 'checkpoints'}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`history-alert ${
            feedbackMessage.type === 'success' ? 'history-alert--success' : 'history-alert--error'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <AlertCircle size={15} className="shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-current opacity-70 hover:opacity-100 p-0.5"
            aria-label="Dismiss message"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Confirmation Modal / Banner for Rollback */}
      {confirmRollbackTarget !== null && (
        <div className="history-confirm-banner" role="region" aria-label="Confirm Rollback">
          <h3 className="history-confirm-title">
            <RotateCcw size={14} />
            Rollback to Version {confirmRollbackTarget}?
          </h3>
          <p className="history-confirm-text">
            This action will restore all document content and structural AST nodes back to snapshot v{confirmRollbackTarget}.
            The restored state will synchronize immediately across active collaborators.
          </p>
          <div className="history-confirm-actions">
            <button
              type="button"
              disabled={rollingBackVersion !== null}
              onClick={() => handleConfirmRollback(confirmRollbackTarget)}
              className="btn-rollback-confirm"
            >
              {rollingBackVersion === confirmRollbackTarget ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Restoring v{confirmRollbackTarget}...</span>
                </>
              ) : (
                <>
                  <RotateCcw size={13} />
                  <span>Confirm Rollback</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={rollingBackVersion !== null}
              onClick={() => setConfirmRollbackTarget(null)}
              className="btn-editor-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline Cards */}
      <div className="history-timeline-list">
        {loading && versions.length === 0 ? (
          <div className="history-loading-state flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-blue-400" />
            <span>Loading version history checkpoints...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="history-empty-state">
            <p className="mb-1 font-semibold text-slate-300">No version checkpoints recorded yet</p>
            <p className="text-xs text-slate-500">
              Click &quot;Save Snapshot&quot; above to capture a permanent revision checkpoint of this document.
            </p>
          </div>
        ) : (
          versions.map((v) => {
            const isCurrent = v.versionNumber === currentVersion;
            const isTargeted = confirmRollbackTarget === v.versionNumber;
            const isRolling = rollingBackVersion === v.versionNumber;

            return (
              <article
                key={v._id || `v_${v.versionNumber}`}
                className={`history-version-card ${isCurrent ? 'is-current' : ''}`}
              >
                <div className="history-card-top">
                  <div className="history-card-pills">
                    <span
                      className={`history-card-version ${
                        isCurrent ? 'history-card-version--current' : ''
                      }`}
                    >
                      v{v.versionNumber}
                    </span>
                    {isCurrent && (
                      <span className="history-active-badge">
                        <CheckCircle2 size={11} />
                        Active Current
                      </span>
                    )}
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={rollingBackVersion !== null}
                      onClick={() => setConfirmRollbackTarget(v.versionNumber)}
                      className="btn-rollback-action"
                      title={`Restore document content to version ${v.versionNumber}`}
                      aria-label={`Rollback to version ${v.versionNumber}`}
                    >
                      {isRolling ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      <span>
                        {isRolling
                          ? 'Restoring...'
                          : isTargeted
                          ? 'Confirming...'
                          : `Rollback to v${v.versionNumber}`}
                      </span>
                    </button>
                  )}
                </div>

                <p className="history-card-desc">{v.changeDescription || 'Snapshot checkpoint'}</p>

                <div className="history-card-meta">
                  <span className="history-meta-item">
                    <User size={11} className="text-slate-500" />
                    <span>{v.author || 'Collaborator'}</span>
                  </span>
                  <span className="history-meta-item">
                    <Clock size={11} className="text-slate-500" />
                    <span>
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recent'}
                    </span>
                  </span>
                  <span className="history-meta-item">
                    <Layers size={11} className="text-slate-500" />
                    <span>{v.nodeCount ?? (v.astSnapshot?.children?.length ? v.astSnapshot.children.length + 1 : 1)} blocks</span>
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
