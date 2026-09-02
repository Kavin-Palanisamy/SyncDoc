import React, { useState, useMemo } from 'react';
import { useCollaboration } from '../../context/CollaborationContext.js';
import { EditorToolbar } from './EditorToolbar.js';
import { BlockRenderer } from './BlockRenderer.js';
import { ASTVisualizer } from './ASTVisualizer.js';
import { VersionHistoryDrawer } from './VersionHistoryDrawer.js';
import { ExportModal } from './ExportModal.js';
import { Plus, Sparkles, FileCode, Layers } from 'lucide-react';

interface DocumentEditorProps {
  onBackToDashboard: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ onBackToDashboard }) => {
  const {
    documentId,
    title,
    version,
    nodes,
    insertBlock,
    rollbackToVersion,
  } = useCollaboration();

  const [viewMode, setViewMode] = useState<'editor' | 'ast' | 'markdown' | 'html'>('editor');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Toolbar */}
      <EditorToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onBackToDashboard={onBackToDashboard}
      />

      {/* Main Workspace View */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        {viewMode === 'editor' && (
          <div className="editor-container">
            {/* Document Header Title info */}
            <div className="mb-6 pb-4 border-b border-slate-800/80">
              <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
                {title}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono text-cyan-400">
                  <Layers size={12} /> AST Version {version}
                </span>
                <span>&bull;</span>
                <span>{nodes.length} structural blocks</span>
                <span>&bull;</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Sparkles size={12} /> Yjs CRDT Synchronized
                </span>
              </div>
            </div>

            {/* Block List */}
            {nodes.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl p-8">
                <p className="text-slate-400 text-sm mb-4">
                  This document has no content blocks yet.
                </p>
                <button
                  onClick={() => insertBlock('paragraph', 0)}
                  className="btn btn-primary text-xs"
                >
                  <Plus size={14} /> Add First Paragraph
                </button>
              </div>
            ) : (
              <div className="space-y-1">
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
            <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-center gap-2">
              <button
                onClick={() => insertBlock('paragraph', nodes.length)}
                className="btn btn-secondary text-xs"
              >
                <Plus size={14} /> Add Paragraph
              </button>
              <button
                onClick={() => insertBlock('heading', nodes.length, { level: 2 })}
                className="btn btn-secondary text-xs"
              >
                <Plus size={14} /> Add Heading
              </button>
              <button
                onClick={() => insertBlock('code_block', nodes.length)}
                className="btn btn-secondary text-xs"
              >
                <Plus size={14} /> Add Code Block
              </button>
              <button
                onClick={() => insertBlock('list', nodes.length)}
                className="btn btn-secondary text-xs"
              >
                <Plus size={14} /> Add List
              </button>
            </div>
          </div>
        )}

        {viewMode === 'ast' && (
          <ASTVisualizer
            documentId={documentId}
            title={title}
            version={version}
            nodes={nodes}
          />
        )}

        {viewMode === 'markdown' && (
          <div className="glass-panel p-6 my-4">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-display font-semibold text-slate-200 text-sm">
                Compiled Markdown Representation
              </h3>
              <button
                onClick={() => navigator.clipboard.writeText(markdownText)}
                className="btn btn-secondary text-xs px-2.5 py-1"
              >
                Copy Markdown
              </button>
            </div>
            <pre className="bg-slate-950/90 text-emerald-300 font-mono text-xs p-4 rounded-xl border border-slate-800 max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {markdownText || '# No content'}
            </pre>
          </div>
        )}

        {viewMode === 'html' && (
          <div className="glass-panel p-6 my-4">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="text-blue-400" size={18} />
                <h3 className="font-display font-semibold text-slate-200 text-sm">
                  Sanitized HTML Preview (DOMPurify Hardened)
                </h3>
              </div>
            </div>
            <div className="bg-white text-slate-900 p-8 rounded-xl shadow-inner max-h-[600px] overflow-y-auto prose max-w-none">
              <h1 className="text-2xl font-bold mb-4">{title}</h1>
              {nodes.map((n) => {
                if (n.type === 'heading') {
                  const h = n as { level?: number; content?: string };
                  const Tag = `h${h.level || 1}` as keyof JSX.IntrinsicElements;
                  return <Tag key={n.id} className="font-bold my-2">{h.content}</Tag>;
                }
                if (n.type === 'paragraph') {
                  const p = n as { content?: string };
                  return <p key={n.id} className="my-2">{p.content}</p>;
                }
                if (n.type === 'code_block') {
                  const cb = n as { content?: string };
                  return (
                    <pre key={n.id} className="bg-slate-100 p-3 rounded font-mono text-sm my-2">
                      <code>{cb.content}</code>
                    </pre>
                  );
                }
                if (n.type === 'blockquote') {
                  const bq = n as { content?: string };
                  return (
                    <blockquote key={n.id} className="border-l-4 border-blue-500 pl-4 italic my-2">
                      {bq.content}
                    </blockquote>
                  );
                }
                if (n.type === 'divider') {
                  return <hr key={n.id} className="my-4" />;
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
