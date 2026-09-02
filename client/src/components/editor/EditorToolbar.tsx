import React, { useState } from 'react';
import {
  Undo,
  Redo,
  Save,
  Download,
  History,
  Network,
  Eye,
  FileCode,
  Layout,
  Heading,
  Type,
  Code,
  List,
  Quote,
  Minus,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { useCollaboration } from '../../context/CollaborationContext.js';
import { CollaboratorList } from './CollaboratorList.js';
import { ConflictIndicator } from './ConflictIndicator.js';

interface EditorToolbarProps {
  viewMode: 'editor' | 'ast' | 'markdown' | 'html';
  onViewModeChange: (mode: 'editor' | 'ast' | 'markdown' | 'html') => void;
  onOpenHistory: () => void;
  onOpenExport: () => void;
  onBackToDashboard: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  viewMode,
  onViewModeChange,
  onOpenHistory,
  onOpenExport,
  onBackToDashboard,
}) => {
  const {
    title,
    updateTitle,
    version,
    nodes,
    collaborators,
    currentUser,
    connectionStatus,
    canUndo,
    canRedo,
    undo,
    redo,
    isSaving,
    lastSavedAt,
    triggerSave,
    insertBlock,
  } = useCollaboration();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (localTitle.trim() && localTitle !== title) {
      updateTitle(localTitle.trim());
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-md">
      {/* Top Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Back button & Document Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
            title="Return to Dashboard"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline font-medium">Dashboard</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="bg-slate-900 text-white font-display font-bold text-base px-2 py-0.5 rounded border border-blue-500 outline-none w-64"
            />
          ) : (
            <h1
              onClick={() => {
                setLocalTitle(title);
                setIsEditingTitle(true);
              }}
              className="font-display font-bold text-base text-slate-100 hover:text-blue-400 cursor-pointer truncate max-w-xs transition-colors"
              title="Click to rename document"
            >
              {title}
            </h1>
          )}

          <ConflictIndicator version={version} />
        </div>

        {/* Center: View Switcher */}
        <div className="hidden md:flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => onViewModeChange('editor')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'editor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout size={13} /> Editor
          </button>
          <button
            onClick={() => onViewModeChange('ast')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'ast'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network size={13} /> AST Tree
          </button>
          <button
            onClick={() => onViewModeChange('markdown')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'markdown'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye size={13} /> Markdown
          </button>
          <button
            onClick={() => onViewModeChange('html')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'html'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode size={13} /> HTML
          </button>
        </div>

        {/* Right: Collaborators & Action Buttons */}
        <div className="flex items-center gap-2">
          <CollaboratorList
            collaborators={collaborators}
            currentUser={currentUser}
            connectionStatus={connectionStatus}
          />

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Undo / Redo */}
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              disabled={!canUndo}
              onClick={undo}
              className={`p-1.5 rounded text-slate-400 hover:text-white ${
                !canUndo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800'
              }`}
              title="Undo"
            >
              <Undo size={14} />
            </button>
            <button
              disabled={!canRedo}
              onClick={redo}
              className={`p-1.5 rounded text-slate-400 hover:text-white ${
                !canRedo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800'
              }`}
              title="Redo"
            >
              <Redo size={14} />
            </button>
          </div>

          {/* Version History Button */}
          <button
            onClick={onOpenHistory}
            className="btn btn-secondary text-xs px-2.5 py-1.5"
            title="Inspect version snapshots"
          >
            <History size={14} />
            <span className="hidden lg:inline">History</span>
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            className="btn btn-primary text-xs px-3 py-1.5"
            title="Export HTML, PDF, Markdown, JSON"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Secondary Action Toolbar: Quick Insert & Save Status */}
      <div className="bg-slate-900/50 border-t border-slate-800/50 px-4 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-400 overflow-x-auto">
          <span className="text-slate-500 text-[11px] mr-1 hidden sm:inline">Insert:</span>
          <button
            onClick={() => insertBlock('paragraph', nodes.length)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Type size={12} /> Paragraph
          </button>
          <button
            onClick={() => insertBlock('heading', nodes.length, { level: 2 })}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Heading size={12} /> Heading
          </button>
          <button
            onClick={() => insertBlock('code_block', nodes.length)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Code size={12} /> Code Block
          </button>
          <button
            onClick={() => insertBlock('list', nodes.length)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <List size={12} /> List
          </button>
          <button
            onClick={() => insertBlock('blockquote', nodes.length)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Quote size={12} /> Quote
          </button>
          <button
            onClick={() => insertBlock('divider', nodes.length)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Minus size={12} /> Divider
          </button>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          {isSaving ? (
            <span className="text-amber-400 flex items-center gap-1">
              <Save size={11} className="animate-spin" /> Saving...
            </span>
          ) : (
            <span
              onClick={triggerSave}
              className="text-slate-400 hover:text-emerald-400 cursor-pointer flex items-center gap-1 transition-colors"
              title="Click to manually save snapshot"
            >
              <CheckCircle size={11} className="text-emerald-400" />
              {lastSavedAt
                ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Auto-saved'}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
