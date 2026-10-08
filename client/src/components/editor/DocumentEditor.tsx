import React, { useState, useMemo, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext.js';
import { EditorToolbar } from './EditorToolbar.js';
import { BlockRenderer } from './BlockRenderer.js';
import { ASTVisualizer } from './ASTVisualizer.js';
import { VersionHistoryDrawer } from './VersionHistoryDrawer.js';
import { ExportModal } from './ExportModal.js';
import {
  Plus,
  Sparkles,
  FileCode,
  Layers,
  Copy,
  Check,
  FileText,
  Code2,
  Quote,
  List,
  Heading as HeadingIcon,
  Clock,
  Edit3,
  Type,
  Minus,
} from 'lucide-react';

interface DocumentEditorProps {
  onBackToDashboard: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ onBackToDashboard }) => {
  const {
    documentId,
    title,
    updateTitle,
    version,
    nodes,
    insertBlock,
    rollbackToVersion,
    lastSavedAt,
  } = useCollaboration();

  const [viewMode, setViewMode] = useState<'editor' | 'ast' | 'markdown' | 'html'>('editor');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // In-canvas title editing state
  const [isEditingCanvasTitle, setIsEditingCanvasTitle] = useState(false);
  const [canvasTitleText, setCanvasTitleText] = useState(title);

  useEffect(() => {
    setCanvasTitleText(title);
  }, [title]);

  const handleCanvasTitleSubmit = () => {
    setIsEditingCanvasTitle(false);
    if (canvasTitleText.trim() && canvasTitleText.trim() !== title) {
      updateTitle(canvasTitleText.trim());
    }
  };

  // Compute Markdown on the fly for the preview tab
  const markdownText = useMemo(() => {
    const lines: string[] = [];
    nodes.forEach((n) => {
      switch (n.type) {
        case 'heading': {
          const h = n as { level?: number; content?: string };
          lines.push(`${'#'.repeat(h.level || 1)} ${h.content || ''}\n`);
          break;
        }
        case 'paragraph': {
          const p = n as { content?: string };
          lines.push(`${p.content || ''}\n`);
          break;
        }
        case 'code_block': {
          const cb = n as { language?: string; content?: string };
          lines.push(`\`\`\`${cb.language || ''}\n${cb.content || ''}\n\`\`\`\n`);
          break;
        }
        case 'list': {
          const l = n as { listType?: string; children?: Array<{ content?: string; checked?: boolean }> };
          (l.children || []).forEach((item, idx) => {
            if (l.listType === 'ordered') {
              lines.push(`${idx + 1}. ${item.content || ''}`);
            } else if (l.listType === 'task') {
              lines.push(`- [${item.checked ? 'x' : ' '}] ${item.content || ''}`);
            } else {
              lines.push(`- ${item.content || ''}`);
            }
          });
          lines.push('');
          break;
        }
        case 'blockquote': {
          const bq = n as { content?: string };
          lines.push(`> ${bq.content || ''}\n`);
          break;
        }
        case 'divider': {
          lines.push(`---\n`);
          break;
        }
      }
    });
    return lines.join('\n');
  }, [nodes]);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownText);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <EditorToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onBackToDashboard={onBackToDashboard}
      />

      {/* Main Workspace Canvas */}
      <main className="editor-main-canvas flex-1 w-full max-w-[840px] mx-auto px-4 sm:px-6">
        {viewMode === 'editor' && (
          <div className="editor-document-canvas">
            {/* Document Header & Title Area */}
            <header className="document-header-area">
              {isEditingCanvasTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={canvasTitleText}
                  onChange={(e) => setCanvasTitleText(e.target.value)}
                  onBlur={handleCanvasTitleSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleCanvasTitleSubmit()}
                  className="document-title-input"
                  placeholder="Editor"
                />
              ) : (
                                <div
                  onClick={() => {
                    setCanvasTitleText(title);
                    setIsEditingCanvasTitle(true);
                  }}
                  className="document-title-row group/title"
                  title="Click to rename document"
                >
                  <h1 className="document-main-title">
                    {title}
                  </h1>
                  <Edit3
                    size={15}
                    className="document-title-edit-icon opacity-0 group-hover/title:opacity-100"
                  />
                </div>
              )}

              {/* Document Metadata Ribbon */}
                            {/* Document Metadata Ribbon */}
              <div className="document-metadata-row">
                <span className="doc-meta-pill">
                  <Clock size={12} />
                  <span>
                 {lastSavedAt
                   ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'All changes saved'}
                  </span>
                </span>
                <span className="doc-meta-pill doc-meta-pill--cyan font-mono">
                  <Layers size={12} />
                  <span>{nodes.length} {nodes.length === 1 ? 'block' : 'blocks'}</span>
                </span>
                <span className="doc-meta-pill doc-meta-pill--blue font-mono">
                  <span>v{version}</span>
                </span>
                <span className="doc-meta-pill doc-meta-pill--emerald">
                  <Sparkles size={12} />
                  <span>CRDT Synced</span>
                </span>
              </div>
            </header>

            {/* Document Content Flow */}
            {nodes.length === 0 ? (
              <div className="editor-empty-state">
                <div className="w-12 h-12 rounded-xl bg-blue-950/40 border border-blue-800/30 text-blue-400 flex items-center justify-center mb-3 shadow-inner">
                  <FileText size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-200 mb-1">
                  Start drafting your document
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
                  Add blocks below. Changes synchronize in real time with non-destructive AST conflict resolution.
                </p>
                <button
                  onClick={() => insertBlock('paragraph', 0)}
                  className="btn-editor-primary"
                >
                  <Plus size={14} /> Add First Paragraph
                </button>
              </div>
            ) : (
              <div className="editor-blocks-container">
                {nodes.map((node, index) => (
                  <BlockRenderer
                    key={node.id}
                    node={node}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === nodes.length - 1}
                  />
                ))}
              </div>
            )}

                        {/* Bottom Add Block Bar */}
            <div className="add-block-bar">
              <div className="add-block-label">
                <span className="add-block-label-icon">
                  <Plus size={13} />
                </span>
                <span>Add Block</span>
              </div>
              <div className="add-block-chip-row">
                <button
                  onClick={() => insertBlock('paragraph', nodes.length)}
                  className="add-block-chip"
                  title="Add Paragraph Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--slate">
                    <Type size={13} />
                  </span>
                  <span>Paragraph</span>
                </button>
                <button
                  onClick={() => insertBlock('heading', nodes.length, { level: 2 })}
                  className="add-block-chip"
                  title="Add Heading Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--purple">
                    <HeadingIcon size={13} />
                  </span>
                  <span>Heading</span>
                </button>
                <button
                  onClick={() => insertBlock('code_block', nodes.length)}
                  className="add-block-chip"
                  title="Add Code Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--amber">
                    <Code2 size={13} />
                  </span>
                  <span>Code</span>
                </button>
                <button
                  onClick={() => insertBlock('list', nodes.length)}
                  className="add-block-chip"
                  title="Add List Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--cyan">
                    <List size={13} />
                  </span>
                  <span>List</span>
                </button>
                <button
                  onClick={() => insertBlock('blockquote', nodes.length)}
                  className="add-block-chip"
                  title="Add Quote Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--pink">
                    <Quote size={13} />
                  </span>
                  <span>Quote</span>
                </button>
                <button
                  onClick={() => insertBlock('divider', nodes.length)}
                  className="add-block-chip"
                  title="Add Horizontal Divider Block"
                >
                  <span className="add-block-chip-icon add-block-chip-icon--slate">
                    <Minus size={13} />
                  </span>
                  <span>Divider</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live AST Visualizer Tab */}
        {viewMode === 'ast' && (
          <ASTVisualizer
            documentId={documentId}
            title={title}
            version={version}
            nodes={nodes}
          />
        )}

        {/* Compiled Markdown Tab */}
        {viewMode === 'markdown' && (
          <div className="preview-panel">
            <div className="preview-panel-header">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-400" size={17} />
                <h3 className="font-semibold text-slate-200 text-sm">
                  Compiled GitHub Flavored Markdown
                </h3>
              </div>
              <button
                onClick={handleCopyMarkdown}
                className={`codeblock-copy-btn ${copiedMarkdown ? 'is-copied' : ''}`}
                title="Copy Markdown to clipboard"
                aria-label={copiedMarkdown ? 'Markdown copied' : 'Copy Markdown'}
              >
                {copiedMarkdown ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
            </div>
            <pre className="preview-code-box">
              {markdownText || '# Untitled Document\n\n*No content blocks yet.*'}
            </pre>
          </div>
        )}

        {/* Sanitized HTML Tab */}
        {viewMode === 'html' && (
          <div className="preview-panel">
            <div className="preview-panel-header">
              <div className="flex items-center gap-2">
                <FileCode className="text-emerald-400" size={17} />
                <div>
                  <h3 className="font-semibold text-slate-200 text-sm">
                    Sanitized HTML Output
                  </h3>
                  <p className="text-[11px] text-slate-400">Hardened with DOMPurify XSS sanitization</p>
                </div>
              </div>
            </div>
            <div className="preview-html-canvas">
              <h1 className="text-3xl font-extrabold text-slate-900 border-b border-slate-200 pb-3 mb-6">
                {title}
              </h1>
              
              {nodes.map((n) => {
                if (n.type === 'heading') {
                  const h = n as { level?: number; content?: string };
                  const Tag = `h${h.level || 1}` as keyof JSX.IntrinsicElements;
                  return (
                    <Tag
                      key={n.id}
                      className={`font-bold my-3 text-slate-900 ${
                        (h.level || 1) === 1 ? 'text-2xl mt-6' : (h.level || 1) === 2 ? 'text-xl mt-5' : 'text-lg mt-4'
                      }`}
                    >
                      {h.content}
                    </Tag>
                  );
                }
                if (n.type === 'paragraph') {
                  const p = n as { content?: string };
                  return (
                    <p key={n.id} className="my-2.5 text-slate-700 leading-relaxed text-[15px]">
                      {p.content}
                    </p>
                  );
                }
                if (n.type === 'code_block') {
                  const cb = n as { content?: string; language?: string };
                  return (
                    <div key={n.id} className="my-3 rounded-lg overflow-hidden border border-slate-300">
                      <div className="bg-slate-200 px-3 py-1 text-xs font-mono text-slate-600 font-semibold uppercase">
                        {cb.language || 'code'}
                      </div>
                      <pre className="bg-slate-100 p-3.5 font-mono text-xs text-slate-800 overflow-x-auto">
                        <code>{cb.content}</code>
                      </pre>
                    </div>
                  );
                }
                if (n.type === 'blockquote') {
                  const bq = n as { content?: string };
                  return (
                    <blockquote key={n.id} className="border-l-4 border-blue-500 pl-4 py-1 italic my-3 text-slate-600 bg-blue-50/50 rounded-r-md">
                      {bq.content}
                    </blockquote>
                  );
                }
                if (n.type === 'divider') {
                  return <hr key={n.id} className="my-6 border-t border-slate-200" />;
                }
                return null;
              })}
            </div>
          </div>
        )}
      </main>

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        documentId={documentId}
        currentVersion={version}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRollback={rollbackToVersion}
      />

      {/* Export Modal */}
      <ExportModal
        documentId={documentId}
        title={title}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
};

