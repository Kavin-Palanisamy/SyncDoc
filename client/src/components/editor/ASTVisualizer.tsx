import React, { useState, useMemo } from 'react';
import { ASTNode, DocumentNode } from '@syncdoc/shared';
import {
  Network,
  Code,
  ChevronRight,
  ChevronDown,
  Layers,
  Hash,
  Search,
  Copy,
  Check,
  Heading as HeadingIcon,
  AlignLeft,
  Code2,
  List as ListIcon,
  Quote,
  Minus,
  FileText,
  Maximize2,
  Minimize2,
} from 'lucide-react';

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
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedNode, setSelectedNode] = useState<ASTNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [copiedJson, setCopiedJson] = useState(false);

  const rootAST: DocumentNode = useMemo(
    () => ({
      id: `doc_${documentId}`,
      type: 'document',
      title,
      version,
      parentId: null,
      children: nodes,
      order: 0,
      metadata: { updatedAt: Date.now() },
    }),
    [documentId, title, version, nodes]
  );

  const totalNodeCount = useMemo(() => {
    let count = 1;
    const countSub = (list: ASTNode[]) => {
      count += list.length;
      list.forEach((n) => {
        if (n.children && n.children.length > 0) countSub(n.children);
      });
    };
    countSub(nodes);
    return count;
  }, [nodes]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = { [rootAST.id]: true };
    const expandRec = (list: ASTNode[]) => {
      list.forEach((n) => {
        allExpanded[n.id] = true;
        if (n.children && n.children.length > 0) expandRec(n.children);
      });
    };
    expandRec(nodes);
    setExpandedNodes(allExpanded);
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = { [rootAST.id]: false };
    const collapseRec = (list: ASTNode[]) => {
      list.forEach((n) => {
        allCollapsed[n.id] = false;
        if (n.children && n.children.length > 0) collapseRec(n.children);
      });
    };
    collapseRec(nodes);
    setExpandedNodes(allCollapsed);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(rootAST, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText size={12} className="text-blue-400" />;
      case 'heading':
        return <HeadingIcon size={12} className="text-purple-400" />;
      case 'paragraph':
        return <AlignLeft size={12} className="text-emerald-400" />;
      case 'code_block':
        return <Code2 size={12} className="text-amber-400" />;
      case 'list':
      case 'list_item':
        return <ListIcon size={12} className="text-cyan-400" />;
      case 'blockquote':
        return <Quote size={12} className="text-pink-400" />;
      case 'divider':
        return <Minus size={12} className="text-slate-400" />;
      default:
        return <Layers size={12} className="text-slate-400" />;
    }
  };

  const getNodeBadgeClass = (type: string) => {
    switch (type) {
      case 'document':
        return 'text-blue-400 bg-blue-950/50 border-blue-800/60';
      case 'heading':
        return 'text-purple-400 bg-purple-950/50 border-purple-800/60';
      case 'paragraph':
        return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60';
      case 'code_block':
        return 'text-amber-400 bg-amber-950/50 border-amber-800/60';
      case 'list':
      case 'list_item':
        return 'text-cyan-400 bg-cyan-950/50 border-cyan-800/60';
      case 'blockquote':
        return 'text-pink-400 bg-pink-950/50 border-pink-800/60';
      case 'divider':
        return 'text-slate-400 bg-slate-900 border-slate-700';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  const matchesSearch = (node: ASTNode): boolean => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const typeMatch = node.type.toLowerCase().includes(q);
    const idMatch = node.id.toLowerCase().includes(q);
    const contentMatch = 'content' in node && typeof (node as any).content === 'string' && (node as any).content.toLowerCase().includes(q);
    const childrenMatch = node.children && node.children.some((child) => matchesSearch(child));
    return typeMatch || idMatch || contentMatch || Boolean(childrenMatch);
  };

  const renderTreeNode = (node: ASTNode, depth: number = 0) => {
    if (!matchesSearch(node)) return null;

    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedNodes[node.id] ?? true;
    const isSelected = selectedNode?.id === node.id;
    const badgeClass = getNodeBadgeClass(node.type);

    return (
      <div key={node.id} className="flex flex-col select-text font-mono text-xs">
        <div
          onClick={() => setSelectedNode(node)}
          className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer ${
            isSelected
              ? 'bg-blue-600/20 border border-blue-500/50 text-white shadow-sm'
              : 'hover:bg-white/[0.04] text-slate-300'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(node.id, e)}
              className="text-slate-500 hover:text-white p-0.5"
              title={isExpanded ? 'Collapse node' : 'Expand node'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {getNodeIcon(node.type)}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}`}>
              {node.type}
            </span>
          </div>

          <span className="text-slate-500 text-[11px] flex items-center shrink-0">
            <Hash size={10} className="mr-0.5 text-slate-600" />
            <span className="text-slate-400 font-mono">{node.id}</span>
          </span>

          {'level' in node && (
            <span className="text-purple-300 text-[10.5px] font-semibold bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-800/40">
              H{(node as any).level}
            </span>
          )}

          {'language' in node && (
            <span className="text-amber-300 text-[10.5px] font-semibold bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40">
              {(node as any).language || 'code'}
            </span>
          )}

          {'content' in node && typeof (node as any).content === 'string' && (
            <span className="text-slate-400 truncate max-w-sm italic text-[11px] font-sans">
              &quot;{(node as any).content}&quot;
            </span>
          )}

          {hasChildren && (
            <span className="text-[10px] text-slate-500 font-mono ml-auto shrink-0">
              {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-white/[0.08] ml-4">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="preview-panel">
      {/* Top Header */}
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
              Abstract Syntax Tree hierarchy &bull; {totalNodeCount} nodes total
            </p>
          </div>
        </div>

        {/* View mode toggle */}
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

      {/* Sub-toolbar: Search & Expand/Collapse */}
      <div className="px-4 py-2 bg-[#090d16] border-b border-white/[0.06] flex items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter AST nodes by ID, type, or text..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-900/70 border border-white/[0.08] rounded-md pl-8 pr-3 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'tree' && (
            <>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/[0.05]"
                title="Expand all tree branches"
              >
                <Maximize2 size={12} /> Expand
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/[0.05]"
                title="Collapse all tree branches"
              >
                <Minimize2 size={12} /> Collapse
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleCopyJson}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              copiedJson ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40' : 'text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]'
            }`}
            title="Copy AST JSON to clipboard"
          >
            {copiedJson ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedJson ? 'Copied' : 'Copy AST'}</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'tree' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-[#070b14] min-h-[420px]">
          {/* Left Tree Hierarchy */}
          <div className="lg:col-span-2 p-4 max-h-[560px] overflow-y-auto space-y-0.5 border-r border-white/[0.06]">
            {nodes.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                Document is currently empty. Add blocks to populate the AST.
              </div>
            ) : (
              renderTreeNode(rootAST)
            )}
          </div>

          {/* Right Selected Node Inspector */}
          <div className="p-4 bg-[#090d16] flex flex-col justify-between max-h-[560px] overflow-y-auto">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
                <Layers size={14} className="text-blue-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Node Inspector</h4>
              </div>

              {selectedNode ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Type</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getNodeBadgeClass(selectedNode.type)}`}>
                      {selectedNode.type}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Node ID</span>
                    <span className="font-mono text-cyan-300 text-xs select-all bg-black/40 px-2 py-1 rounded block border border-white/[0.06]">
                      {selectedNode.id}
                    </span>
                  </div>

                  {selectedNode.parentId && (
                    <div>
                      <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Parent Node</span>
                      <span className="font-mono text-slate-400 text-xs bg-black/40 px-2 py-1 rounded block border border-white/[0.06]">
                        {selectedNode.parentId}
                      </span>
                    </div>
                  )}

                  {'content' in selectedNode && (
                    <div>
                      <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Content</span>
                      <p className="text-slate-200 text-xs bg-black/40 p-2.5 rounded border border-white/[0.06] leading-relaxed whitespace-pre-wrap font-sans">
                        {(selectedNode as any).content || '(empty)'}
                      </p>
                    </div>
                  )}

                  {'level' in selectedNode && (
                    <div>
                      <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Heading Level</span>
                      <span className="font-mono text-purple-300 font-bold">H{(selectedNode as any).level}</span>
                    </div>
                  )}

                  {'language' in selectedNode && (
                    <div>
                      <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Language</span>
                      <span className="font-mono text-amber-300">{(selectedNode as any).language || 'plain text'}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10.5px] uppercase font-bold text-slate-500 block mb-1">Order Index</span>
                    <span className="font-mono text-slate-400">Position #{selectedNode.order ?? 0}</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Click any node in the AST hierarchy to inspect its structural properties.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.06] text-[11px] text-slate-500 flex items-center justify-between">
              <span>Canonical AST State</span>
              <span className="text-emerald-400 font-medium">Valid</span>
            </div>
          </div>
        </div>
      ) : (
        <pre className="bg-[#090d16] text-cyan-300 font-mono text-xs p-5 rounded-b-xl max-h-[560px] overflow-y-auto leading-relaxed border-t border-white/[0.06]">
          {JSON.stringify(rootAST, null, 2)}
        </pre>
      )}
    </div>
  );
};
