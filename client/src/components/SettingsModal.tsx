import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Settings,
  Building,
  Palette,
  Sliders,
  Activity,
  Check,
  User,
  Shield,
  Layers,
  Server,
  Database,
  Radio,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { getSharedSocket } from '../services/socket.js';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
  onUpdateUserName?: (newName: string) => void;
  memberCount: number;
  documentCount: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUserName,
  onUpdateUserName,
  memberCount,
  documentCount,
}) => {
  const [activeTab, setActiveTab] = useState<'workspace' | 'appearance' | 'editor' | 'status'>('workspace');

  // Workspace Settings (Draft values)
  const [workspaceName, setWorkspaceName] = useState(() => localStorage.getItem('syncdoc_workspace_name') || 'SyncDoc Engineering');
  const [workspaceDesc, setWorkspaceDesc] = useState(() => localStorage.getItem('syncdoc_workspace_desc') || 'Collaborative technical documentation & specifications');
  const [userName, setUserName] = useState(currentUserName);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('syncdoc_user_role') || 'Lead Developer');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Appearance Settings
  const [theme, setTheme] = useState(() => localStorage.getItem('syncdoc_theme') || 'slate');
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    () => (localStorage.getItem('syncdoc_density') as 'comfortable' | 'compact') || 'comfortable'
  );
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem('syncdoc_reduced_motion') === 'true'
  );

  // Editor Preferences
  const [defaultView, setDefaultView] = useState<'editor' | 'ast' | 'markdown' | 'html'>(
    () => (localStorage.getItem('syncdoc_default_view') as any) || 'editor'
  );
  const [showPresence, setShowPresence] = useState(
    () => localStorage.getItem('syncdoc_show_presence') !== 'false'
  );
  const [autoSaveStrategy, setAutoSaveStrategy] = useState(
    () => localStorage.getItem('syncdoc_autosave_strategy') || 'realtime'
  );

  // Backend Live Health Check
  const [healthStatus, setHealthStatus] = useState<{
    status: 'checking' | 'healthy' | 'offline';
    uptime?: number;
    version?: string;
    loading: boolean;
  }>({ status: 'checking', loading: true });

  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Sync current user name prop
  useEffect(() => {
    setUserName(currentUserName);
  }, [currentUserName]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Check backend health & socket connection
  const checkHealth = () => {
    setHealthStatus((prev) => ({ ...prev, loading: true }));
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Health check error');
        return res.json();
      })
      .then((data) => {
        setHealthStatus({
          status: 'healthy',
          uptime: data.uptime,
          version: data.version || '1.0.0',
          loading: false,
        });
      })
      .catch(() => {
        setHealthStatus({ status: 'offline', loading: false });
      });

    const socket = getSharedSocket();
    setSocketConnected(socket.connected);
  };

  useEffect(() => {
    if (!isOpen) return;
    checkHealth();
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerSavedFeedback = (msg = 'Saved') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleSaveWorkspace = () => {
    if (!workspaceName.trim()) {
      setWorkspaceError('Workspace name cannot be empty.');
      return;
    }
    setWorkspaceError(null);

    localStorage.setItem('syncdoc_workspace_name', workspaceName.trim());
    localStorage.setItem('syncdoc_workspace_desc', workspaceDesc.trim());
    localStorage.setItem('syncdoc_user_role', userRole.trim());

    if (userName.trim() && userName.trim() !== currentUserName && onUpdateUserName) {
      onUpdateUserName(userName.trim());
    }

    triggerSavedFeedback('Workspace profile saved');
  };

  const handleCancelWorkspace = () => {
    setWorkspaceName(localStorage.getItem('syncdoc_workspace_name') || 'SyncDoc Engineering');
    setWorkspaceDesc(localStorage.getItem('syncdoc_workspace_desc') || 'Collaborative technical documentation & specifications');
    setUserName(currentUserName);
    setUserRole(localStorage.getItem('syncdoc_user_role') || 'Lead Developer');
    setWorkspaceError(null);
  };

  const handleSaveTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('syncdoc_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    triggerSavedFeedback(`Theme set to ${newTheme}`);
  };

  const handleSaveDensity = (newDensity: 'comfortable' | 'compact') => {
    setDensity(newDensity);
    localStorage.setItem('syncdoc_density', newDensity);
    if (newDensity === 'compact') {
      document.body.classList.add('density-compact');
    } else {
      document.body.classList.remove('density-compact');
    }
    triggerSavedFeedback(`Density set to ${newDensity}`);
  };

  const handleSaveReducedMotion = (newMotion: boolean) => {
    setReducedMotion(newMotion);
    localStorage.setItem('syncdoc_reduced_motion', String(newMotion));
    if (newMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
    triggerSavedFeedback(newMotion ? 'Reduced motion enabled' : 'Subtle animations restored');
  };

  const handleSaveEditorPref = (
    view: 'editor' | 'ast' | 'markdown' | 'html',
    presence: boolean,
    strategy: string
  ) => {
    setDefaultView(view);
    setShowPresence(presence);
    setAutoSaveStrategy(strategy);

    localStorage.setItem('syncdoc_default_view', view);
    localStorage.setItem('syncdoc_show_presence', String(presence));
    localStorage.setItem('syncdoc_autosave_strategy', strategy);

    triggerSavedFeedback('Preferences updated');
  };

  const modalContent = (
    <div
      className="settings-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div className="settings-modal-dialog">
        {/* Header */}
        <div className="settings-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center">
              <Settings size={16} />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-sm font-bold text-white">
                Workspace & Preferences
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure profile, theme aesthetics, editor defaults & diagnostic health
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-medium">
                <Check size={11} /> {savedNotice}
              </span>
            )}
            <button
              onClick={onClose}
              className="btn-editor-icon"
              title="Close Settings"
              aria-label="Close Settings"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Layout: Sidebar Nav + Content */}
        <div className="settings-modal-body">
          {/* Nav Tabs */}
          <nav className="settings-nav-sidebar" aria-label="Settings navigation">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`settings-nav-btn ${activeTab === 'workspace' ? 'is-active' : ''}`}
            >
              <Building size={14} />
              <span>Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appearance')}
              className={`settings-nav-btn ${activeTab === 'appearance' ? 'is-active' : ''}`}
            >
              <Palette size={14} />
              <span>Appearance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`settings-nav-btn ${activeTab === 'editor' ? 'is-active' : ''}`}
            >
              <Sliders size={14} />
              <span>Editor Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`settings-nav-btn ${activeTab === 'status' ? 'is-active' : ''}`}
            >
              <Activity size={14} />
              <span>System & Status</span>
            </button>
          </nav>

          {/* Tab Content Panes */}
          <div className="settings-tab-content">
            {/* 1. WORKSPACE TAB */}
            {activeTab === 'workspace' && (
              <div className="settings-pane space-y-4">
                <div>
                  <h3 className="settings-section-title">Workspace Profile</h3>
                  <p className="settings-section-desc">Manage workspace branding, your identity, and team role.</p>
                </div>

                <div className="settings-field">
                  <label className="settings-label">Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value);
                      if (workspaceError) setWorkspaceError(null);
                    }}
                    className={`settings-input ${workspaceError ? 'is-invalid' : ''}`}
                    placeholder="e.g. SyncDoc Engineering"
                  />
                  {workspaceError && <p className="settings-error-text">{workspaceError}</p>}
                </div>

                <div className="settings-field">
                  <label className="settings-label">Workspace Description</label>
                  <input
                    type="text"
                    value={workspaceDesc}
                    onChange={(e) => setWorkspaceDesc(e.target.value)}
                    className="settings-input"
                    placeholder="Brief description of this workspace"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="settings-field">
                    <label className="settings-label">Your Display Name</label>
                    <div className="relative">
                      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="settings-input pl-8"
                        placeholder="Your name"
                      />
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Your Role</label>
                    <div className="relative">
                      <Shield size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        className="settings-input pl-8"
                      >
                        <option value="Lead Developer">Lead Developer</option>
                        <option value="Editor">Editor</option>
                        <option value="Collaborator">Collaborator</option>
                        <option value="Reviewer">Reviewer</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Workspace Stats Overview */}
                <div className="settings-stats-card">
                  <div className="settings-stat-item">
                    <span className="stat-label">Documents</span>
                    <span className="stat-value">{documentCount}</span>
                  </div>
                  <div className="settings-stat-divider" />
                  <div className="settings-stat-item">
                    <span className="stat-label">Team Members</span>
                    <span className="stat-value">{memberCount || 1}</span>
                  </div>
                  <div className="settings-stat-divider" />
                  <div className="settings-stat-item">
                    <span className="stat-label">Collaboration</span>
                    <span className="stat-value text-emerald-400">Live</span>
                  </div>
                </div>

                <div className="settings-actions-bar">
                  <button
                    type="button"
                    onClick={handleCancelWorkspace}
                    className="settings-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWorkspace}
                    className="settings-btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="settings-pane space-y-4">
                <div>
                  <h3 className="settings-section-title">Interface Appearance</h3>
                  <p className="settings-section-desc">Tailor theme tones, layout spacing, and motion preferences.</p>
                </div>

                {/* Theme Options */}
                <div className="settings-field">
                  <label className="settings-label">Color Theme</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'slate', name: 'Slate Dark', desc: 'Deep slate with crisp cyan/blue accents' },
                      { id: 'midnight', name: 'Midnight', desc: 'Indigo canvas with purple highlights' },
                      { id: 'obsidian', name: 'Obsidian', desc: 'Ultra-contrast monochromatic black' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSaveTheme(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          theme === t.id
                            ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-950/60 ring-1 ring-blue-500/50'
                            : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{t.name}</span>
                          {theme === t.id && <Check size={12} className="text-blue-400" />}
                        </div>
                        <p className="text-[10.5px] text-slate-400 leading-tight">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editor Density */}
                <div className="settings-field">
                  <label className="settings-label">Editor Density</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'comfortable', name: 'Comfortable', desc: 'Standard breathing room between block elements' },
                      { id: 'compact', name: 'Compact', desc: 'Tighter line spacing and smaller margins for dense writing' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleSaveDensity(d.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          density === d.id
                            ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-950/60 ring-1 ring-blue-500/50'
                            : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{d.name}</span>
                          {density === d.id && <Check size={12} className="text-blue-400" />}
                        </div>
                        <p className="text-[10.5px] text-slate-400 leading-tight">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motion Preferences */}
                <label className="settings-checkbox-row">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Reduce Motion</span>
                    <p className="text-[11px] text-slate-500">Disable subtle animations and transitions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => handleSaveReducedMotion(e.target.checked)}
                    className="settings-checkbox"
                  />
                </label>
              </div>
            )}

            {/* 3. EDITOR PREFERENCES TAB */}
            {activeTab === 'editor' && (
              <div className="settings-pane space-y-4">
                <div>
                  <h3 className="settings-section-title">Editor Preferences</h3>
                  <p className="settings-section-desc">Default view modes, collaboration display, and saving behaviors.</p>
                </div>

                {/* Default View Mode */}
                <div className="settings-field">
                  <label className="settings-label">Default Document View Mode</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'editor', name: 'Editor', icon: Layers },
                      { id: 'ast', name: 'AST Tree', icon: Radio },
                      { id: 'markdown', name: 'Markdown', icon: FileText },
                      { id: 'html', name: 'HTML', icon: Server },
                    ].map((v) => {
                      const Icon = v.icon;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSaveEditorPref(v.id as any, showPresence, autoSaveStrategy)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                            defaultView === v.id
                              ? 'bg-blue-950/50 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                              : 'bg-white/[0.02] border-white/[0.08] text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon size={15} />
                          <span className="text-xs font-medium">{v.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Collaboration Indicators */}
                <label className="settings-checkbox-row">
                  <div>
                    <span className="text-xs font-medium text-slate-200">Show Collaborator Indicators</span>
                    <p className="text-[11px] text-slate-500">Render active peer presence avatars in the editor toolbar</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={showPresence}
                    onChange={(e) => handleSaveEditorPref(defaultView, e.target.checked, autoSaveStrategy)}
                    className="settings-checkbox"
                  />
                </label>

                {/* Auto-Save Strategy */}
                <div className="settings-field">
                  <label className="settings-label">Auto-Save & Snapshot Strategy</label>
                  <select
                    value={autoSaveStrategy}
                    onChange={(e) => handleSaveEditorPref(defaultView, showPresence, e.target.value)}
                    className="settings-input"
                  >
                    <option value="realtime">Continuous Real-time Sync (Default)</option>
                    <option value="periodic">Periodic 30-Second Snapshots</option>
                    <option value="manual">Manual Snapshot Creation</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4. SYSTEM & STATUS TAB */}
            {activeTab === 'status' && (
              <div className="settings-pane space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="settings-section-title">Engine Health & Diagnostics</h3>
                    <p className="settings-section-desc">Live status of backend REST API, database, and Socket.IO engine.</p>
                  </div>
                  <button
                    type="button"
                    onClick={checkHealth}
                    disabled={healthStatus.loading}
                    className="btn-editor-secondary h-7 px-2 text-xs flex items-center gap-1"
                    title="Refresh health diagnostics"
                  >
                    <RefreshCw size={12} className={healthStatus.loading ? 'animate-spin' : ''} />
                    <span>Check</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {/* Backend Status Card */}
                  <div className="status-row-card">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          healthStatus.loading
                            ? 'bg-slate-800 border border-slate-700 text-slate-400'
                            : healthStatus.status === 'healthy'
                            ? 'bg-emerald-950/60 border border-emerald-800/40 text-emerald-400'
                            : 'bg-rose-950/60 border border-rose-800/40 text-rose-400'
                        }`}
                      >
                        <Server size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">REST API Service</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              healthStatus.loading
                                ? 'bg-slate-500/20 text-slate-400'
                                : healthStatus.status === 'healthy'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {healthStatus.loading
                              ? 'CHECKING'
                              : healthStatus.status === 'healthy'
                              ? 'HEALTHY'
                              : 'UNAVAILABLE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">http://localhost:5000/api</p>
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-400">
                      v{healthStatus.version || '1.0.0'}
                    </div>
                  </div>

                  {/* Socket.IO Collaboration Engine */}
                  <div className="status-row-card">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          socketConnected
                            ? 'bg-blue-950/60 border border-blue-800/40 text-blue-400'
                            : 'bg-amber-950/60 border border-amber-800/40 text-amber-400'
                        }`}
                      >
                        <Radio size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">Socket.IO Collaboration</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              socketConnected
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {socketConnected ? 'CONNECTED' : 'DISCONNECTED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Real-time CRDT updates & team presence broadcast</p>
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-emerald-400">
                      {socketConnected ? 'Live' : 'Standby'}
                    </div>
                  </div>

                  {/* Database Engine */}
                  <div className="status-row-card">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          healthStatus.status === 'healthy'
                            ? 'bg-purple-950/60 border border-purple-800/40 text-purple-400'
                            : 'bg-rose-950/60 border border-rose-800/40 text-rose-400'
                        }`}
                      >
                        <Database size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">MongoDB Database Engine</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              healthStatus.status === 'healthy'
                                ? 'bg-purple-500/15 text-purple-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {healthStatus.status === 'healthy' ? 'ACTIVE' : 'UNAVAILABLE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Document AST trees & version snapshots stored</p>
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-400">
                      {healthStatus.status === 'healthy' ? 'Persistent' : 'Offline'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                  <span>Server Uptime</span>
                  <span className="font-mono text-slate-200">
                    {healthStatus.uptime !== undefined
                      ? `${Math.floor(healthStatus.uptime / 60)}m ${Math.floor(healthStatus.uptime % 60)}s`
                      : healthStatus.status === 'healthy'
                      ? 'Active'
                      : 'Unavailable'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
