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
  CheckCircle2,
  ArrowLeft,
  Edit2,
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
    <header className="editor-toolbar-header sticky top-0 z-40 border-b border-white/[0.08] select-none">
      
      {/* Top Main Navigation Bar */}
            <div className="editor-toolbar-row">
        {/* Left: Back button & Document Title */}
        <div className="toolbar-group toolbar-group--left">
          <button
            onClick={onBackToDashboard}
            className="btn-editor-secondary"
            title="Return to Dashboard"
          >
            <ArrowLeft size={14} />
            <span className="hidden md:inline">Dashboard</span>
          </button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Title Inline Editor */}
          {isEditingTitle ? (
           <input
              type="text"
              autoFocus
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="toolbar-title-input"
            />
          ) : (
            <div
              onClick={() => {
                setLocalTitle(title);
                setIsEditingTitle(true);
              }}
              className="toolbar-title-wrap group"
              title="Click to rename document"
            >
              <h1 className="toolbar-title-text group-hover:text-blue-400">
                {title}
              </h1>
              <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}

         <ConflictIndicator version={version} />
        </div>
        <div className="toolbar-divider" />
        {/* Center: Segmented View Switcher */}
        <div className="toolbar-group toolbar-group--center hidden lg:flex editor-segmented-control" role="tablist" aria-label="View switcher">
          <button
            onClick={() => onViewModeChange('editor')}
            className={`editor-segmented-item ${viewMode === 'editor' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'editor'}
          >
            <Layout size={13} />
            <span>Editor</span>
          </button>
          <button
            onClick={() => onViewModeChange('ast')}
            className={`editor-segmented-item ${viewMode === 'ast' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'ast'}
          >
            <Network size={13} />
            <span>AST Tree</span>
          </button>
          <button
            onClick={() => onViewModeChange('markdown')}
            className={`editor-segmented-item ${viewMode === 'markdown' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'markdown'}
          >
            <Eye size={13} />
            <span>Markdown</span>
          </button>
          <button
            onClick={() => onViewModeChange('html')}
            className={`editor-segmented-item ${viewMode === 'html' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={viewMode === 'html'}
          >
            <FileCode size={13} />
            <span>HTML</span>
          </button>
        </div>

                <div className="toolbar-divider" />

        {/* Right: Presence, Undo/Redo, History, Export & Save status */}
        <div className="toolbar-group toolbar-group--right">
          <div className="toolbar-right-top">
            <CollaboratorList
              collaborators={collaborators}
              currentUser={currentUser}
              connectionStatus={connectionStatus}
            />

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            {/* Undo / Redo Group */}
            <div className="hidden sm:inline-flex btn-editor-group" aria-label="History undo and redo">
              <button
                disabled={!canUndo}
                onClick={undo}
                className="btn-editor-icon"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo size={14} />
              </button>
              <div className="btn-editor-group-divider" />
              <button
                disabled={!canRedo}
                onClick={redo}
                className="btn-editor-icon"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo size={14} />
              </button>
            </div>

            {/* Version History Button */}
            <button
              onClick={onOpenHistory}
              className="btn-editor-secondary shrink-0"
              title="Inspect version history & rollback snapshots"
            >
              <History size={14} className="text-slate-400" />
              <span className="hidden md:inline">History</span>
            </button>

            {/* Export Button (Primary Action) */}
            <button
              onClick={onOpenExport}
              className="btn-editor-primary shrink-0"
              title="Export Document as HTML, PDF, Markdown, or JSON"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>

          {/* Save Status / Live Sync Pill */}
          <div className="toolbar-right-bottom">
            {isSaving ? (
              <span className="editor-sync-pill is-saving" title="Saving changes...">
                <Save size={11} className="animate-spin text-amber-400" />
                <span>Saving...</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={triggerSave}
                className="editor-sync-pill is-saved"
                title="Click to manually save version snapshot"
              >
                <CheckCircle2 size={11} className="text-emerald-400" />
                <span>
                  {lastSavedAt
                    ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'All changes saved'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

            {/* Secondary Ribbon: Quick Block Insert Chips */}
      {/* <div className="bg-[#0b0f19]/80 border-t border-white/[0.04] px-4 sm:px-6 h-9 flex items-center text-xs overflow-x-auto"> */}
        
        {/* Quick Insert Actions
        <div className="editor-quick-insert-bar">
          <span className="text-slate-500 text-[10.5px] font-semibold tracking-wider uppercase mr-1 hidden sm:inline">
            Insert
          </span>
          <button
            onClick={() => insertBlock('paragraph', nodes.length)}
            className="btn-insert-chip"
            title="Insert Paragraph block"
          >
            <Type size={12} className="insert-chip-icon text-slate-400" />
            <span>Paragraph</span>
          </button>
          <button
            onClick={() => insertBlock('heading', nodes.length, { level: 2 })}
            className="btn-insert-chip"
            title="Insert Heading block"
          >
            <Heading size={12} className="insert-chip-icon text-purple-400" />
            <span>Heading</span>
          </button>
          <button
            onClick={() => insertBlock('code_block', nodes.length)}
            className="btn-insert-chip"
            title="Insert Code block"
          >
            <Code size={12} className="insert-chip-icon text-amber-400" />
            <span>Code</span>
          </button>
          <button
            onClick={() => insertBlock('list', nodes.length)}
            className="btn-insert-chip"
            title="Insert List block"
          >
            <List size={12} className="insert-chip-icon text-cyan-400" />
            <span>List</span>
          </button>
          <button
            onClick={() => insertBlock('blockquote', nodes.length)}
            className="btn-insert-chip"
            title="Insert Blockquote block"
          >
            <Quote size={12} className="insert-chip-icon text-pink-400" />
            <span>Quote</span>
          </button>
          <button
            onClick={() => insertBlock('divider', nodes.length)}
            className="btn-insert-chip"
            title="Insert Horizontal Divider block"
          >
            <Minus size={12} className="insert-chip-icon text-slate-400" />
            <span>Divider</span>
          </button>
         </div>
      </div> */}
    </header>
  );
};

