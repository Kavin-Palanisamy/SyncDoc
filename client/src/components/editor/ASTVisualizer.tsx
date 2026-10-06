import React, { useState } from 'react';
import { ASTNode, DocumentNode } from '@syncdoc/shared';
import { Network, Code, ChevronRight, ChevronDown, Layers, Hash } from 'lucide-react';

interface ASTVisualizerProps {
  documentId: string;
  title: string;
  version: number;
  nodes: ASTNode[];
}

export const ASTVisualizer: React.FC<ASTVisualizerProps> = ({
  documentId,
  title,
  version,
  nodes,
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'json'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const rootAST: DocumentNode = {
    id: `doc_${documentId}`,
    type: 'document',
    title,
    version,
    parentId: null,
    children: nodes,
    order: 0,
    metadata: { updatedAt: Date.now() },
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'document':
        return 'text-blue-400 bg-blue-950/40 border-blue-800';
      case 'heading':
        return 'text-purple-400 bg-purple-950/40 border-purple-800';
      case 'paragraph':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800';
      case 'code_block':
        return 'text-amber-400 bg-amber-950/40 border-amber-800';
      case 'list':
      case 'list_item':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-800';
      case 'blockquote':
        return 'text-pink-400 bg-pink-950/40 border-pink-800';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const renderTreeNode = (node: ASTNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? true;
    const colorClass = getNodeColor(node.type);

    return (
      <div key={node.id} className="flex flex-col text-xs font-mono select-text">
        <div
          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/60 transition-colors"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="text-slate-500 hover:text-white"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          <span className={`px-2 py-0.5 rounded border uppercase text-[10px] font-bold ${colorClass}`}>
            {node.type}
          </span>

          <span className="text-slate-400 flex items-center gap-0.5">
            <Hash size={10} />
            <span className="text-slate-300">{node.id}</span>
          </span>

          {node.parentId && (
            <span className="text-slate-500 text-[10px]">
              parent: {node.parentId}
            </span>
          )}

          {'content' in node && typeof node.content === 'string' && (
            <span className="text-slate-400 truncate max-w-xs italic text-[11px]">
              &quot;{node.content}&quot;
            </span>
          )}

          {'level' in node && (
            <span className="text-purple-300 font-bold text-[10px]">
              L{node.level}
            </span>
          )}

          {'language' in node && (
            <span className="text-amber-300 text-[10px]">
              [{node.language}]
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-slate-800 ml-4">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="preview-panel">
      <div className="preview-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center">
            <Network size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">
              AST Structural Inspector
            </h3>
            <p className="text-[11px] text-slate-400">
              Live hierarchical tree &bull; {nodes.length + 1} registered nodes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'tree' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={12} /> Tree View
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === 'json' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code size={12} /> JSON AST
          </button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="bg-[#090d16] p-4 rounded-xl border border-white/[0.08] max-h-[500px] overflow-y-auto">
          {renderTreeNode(rootAST)}
        </div>
      ) : (
        <pre className="bg-[#090d16] text-cyan-300 font-mono text-xs p-4 rounded-xl border border-white/[0.08] max-h-[500px] overflow-y-auto leading-relaxed">
          {JSON.stringify(rootAST, null, 2)}
        </pre>
      )}
    </div>
  );
};
