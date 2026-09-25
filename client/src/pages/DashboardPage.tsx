import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  FileText,
  Clock,
  Trash2,
  Upload,
  Layers,
  BookOpen,
  Code,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ApiService, DocumentSummary } from '../services/api.js';
import { createDocumentAST, DocumentNode, HeadingNode, ParagraphNode, CodeBlockNode, ListNode } from '@syncdoc/shared';

interface DashboardPageProps {
  onOpenDocument: (documentId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenDocument }) => {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMarkdownText, setImportMarkdownText] = useState('');
  const [importTitle, setImportTitle] = useState('');

  // User preferences
  const [userName, setUserName] = useState(() => localStorage.getItem('syncdoc_user_name') || 'Alex Chen');

  const fetchDocuments = async (retries = 2) => {
    setLoading(true);
    try {
      const res = await ApiService.listDocuments(searchQuery);
      setDocuments(res.documents);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => {
          fetchDocuments(retries - 1);
        }, 1200);
        return;
      }
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [searchQuery]);

  const handleCreateDocument = async (title: string, customAST?: DocumentNode) => {
    try {
      const doc = await ApiService.createDocument(title, customAST);
      onOpenDocument(doc._id);
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  const handleCreateFromTemplate = (templateType: 'rfc' | 'api' | 'blank') => {
    if (templateType === 'blank') {
      handleCreateDocument('Untitled Technical Document');
      return;
    }

    if (templateType === 'rfc') {
      const docAST = createDocumentAST('RFC: Distributed AST Conflict Resolution Engine');
      const h1: HeadingNode = {
        id: 'h_1',
        type: 'heading',
        level: 2,
        content: '1. Summary & Problem Statement',
        parentId: docAST.id,
        children: [],
        order: 1,
      };
      const p1: ParagraphNode = {
        id: 'p_1',
        type: 'paragraph',
        content: 'Multi-user real-time document editing requires non-destructive structural synchronization.',
        parentId: docAST.id,
        children: [],
        order: 2,
      };
      const h2: HeadingNode = {
        id: 'h_2',
        type: 'heading',
        level: 2,
        content: '2. Architecture & CRDT Convergence',
        parentId: docAST.id,
        children: [],
        order: 3,
      };
      const code: CodeBlockNode = {
        id: 'code_1',
        type: 'code_block',
        language: 'typescript',
        content: `interface ASTNode {\n  id: string;\n  type: string;\n  children: ASTNode[];\n}`,
        parentId: docAST.id,
        children: [],
        order: 4,
      };
      docAST.children = [docAST.children[0]!, h1, p1, h2, code];
      handleCreateDocument('RFC: Distributed AST Conflict Resolution Engine', docAST);
      return;
    }

    if (templateType === 'api') {
      const docAST = createDocumentAST('REST & WebSocket API Specification');
      const h1: HeadingNode = {
        id: 'h_api_1',
        type: 'heading',
        level: 2,
        content: 'Endpoints Overview',
        parentId: docAST.id,
        children: [],
        order: 1,
      };
      const list: ListNode = {
        id: 'list_api_1',
        type: 'list',
        listType: 'bullet',
        parentId: docAST.id,
        order: 2,
        children: [
          { id: 'li_1', type: 'list_item', content: 'GET /api/documents - Fetch document catalog', parentId: 'list_api_1', children: [], order: 0 },
          { id: 'li_2', type: 'list_item', content: 'POST /api/documents - Initialize new document with AST tree', parentId: 'list_api_1', children: [], order: 1 },
          { id: 'li_3', type: 'list_item', content: 'GET /api/documents/:id/export - Stream HTML / PDF layout', parentId: 'list_api_1', children: [], order: 2 },
        ],
      };
      docAST.children = [docAST.children[0]!, h1, list];
      handleCreateDocument('REST & WebSocket API Specification', docAST);
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this document? All version snapshots will also be removed.')) {
      try {
        await ApiService.deleteDocument(id);
        fetchDocuments();
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  const handleImportMarkdownSubmit = async () => {
    if (!importMarkdownText.trim()) return;
    try {
      const doc = await ApiService.importMarkdown(importMarkdownText, importTitle || undefined);
      setIsImportModalOpen(false);
      onOpenDocument(doc._id);
    } catch (err) {
      console.error('Failed to import markdown:', err);
    }
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('syncdoc_user_name', newName);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers className="text-white" size={22} />
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-tight text-white flex items-center gap-2">
                SyncDoc <span className="text-xs bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full font-mono">v1.0</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Collaborative AST Document Engine</p>
            </div>
          </div>

          {/* User Profile Box */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-400">User:</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => handleUpdateUserName(e.target.value)}
                className="bg-transparent text-slate-100 font-semibold outline-none w-28 hover:text-blue-400 focus:text-blue-400"
                title="Click to change your collaborator display name"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Quick Actions */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-10">
          {/* Quick Create Blank */}
          <div
            onClick={() => handleCreateFromTemplate('blank')}
            className="glass-card p-5 cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-950/80 text-blue-400 flex items-center justify-center border border-blue-800/60 group-hover:scale-110 transition-transform">
                <Plus size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900">
                Quick Start
              </span>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                New Blank Document
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Start from a clean slate with block-based editing and Yjs real-time sync.
              </p>
            </div>
          </div>

          {/* Template: RFC Spec */}
          <div
            onClick={() => handleCreateFromTemplate('rfc')}
            className="glass-card p-5 cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-950/80 text-purple-400 flex items-center justify-center border border-purple-800/60 group-hover:scale-110 transition-transform">
                <BookOpen size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900">
                Template
              </span>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white group-hover:text-purple-400 transition-colors">
                Architecture RFC
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Technical design spec with problem statement, architecture, and code blocks.
              </p>
            </div>
          </div>

          {/* Template: API Spec */}
          <div
            onClick={() => handleCreateFromTemplate('api')}
            className="glass-card p-5 cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/80 text-cyan-400 flex items-center justify-center border border-cyan-800/60 group-hover:scale-110 transition-transform">
                <Code size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900">
                Template
              </span>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white group-hover:text-cyan-400 transition-colors">
                API Technical Spec
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pre-configured structural template with endpoints, methods, and nested lists.
              </p>
            </div>
          </div>

          {/* Markdown Importer */}
          <div
            onClick={() => setIsImportModalOpen(true)}
            className="glass-card p-5 cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 text-emerald-400 flex items-center justify-center border border-emerald-800/60 group-hover:scale-110 transition-transform">
                <Upload size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900">
                Converter
              </span>
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                Import Markdown to AST
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Parse existing Markdown files into fully validated structural AST documents.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Catalog Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck size={14} /> Mongoose Recursive Validation Active
            </span>
          </div>
        </div>

        {/* Document Cards Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            <Zap className="animate-spin inline-block text-blue-500 mb-2" size={24} />
            <p>Loading document catalog...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl p-8">
            <FileText className="mx-auto text-slate-600 mb-3" size={36} />
            <h3 className="text-slate-300 font-display font-semibold text-base mb-1">
              No documents found
            </h3>
            <p className="text-slate-500 text-xs mb-4">
              Create a new document from scratch or choose a template above to get started.
            </p>
            <button
              onClick={() => handleCreateFromTemplate('blank')}
              className="btn btn-primary text-xs"
            >
              <Plus size={14} /> Create First Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const nodeCount = (doc.root?.children?.length || 0) + 1;
              const snippet =
                (doc.root?.children?.[1] as { content?: string } | undefined)?.content ||
                (doc.root?.children?.[0] as { content?: string } | undefined)?.content ||
                'Empty document';

              return (
                <div
                  key={doc._id}
                  onClick={() => onOpenDocument(doc._id)}
                  className="glass-card p-5 cursor-pointer flex flex-col justify-between group relative"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display font-bold text-base text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteDocument(doc._id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
                        title="Delete Document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                      {snippet}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-mono text-cyan-400">
                      <Layers size={11} /> v{doc.version} &bull; {nodeCount} blocks
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Markdown Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="text-emerald-400" size={18} />
                <h3 className="font-display font-bold text-slate-100 text-base">
                  Import Markdown into Structural AST
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected from first heading if left blank"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Markdown Content
                </label>
                <textarea
                  rows={8}
                  placeholder="# Technical Spec&#10;&#10;Write markdown content here..."
                  value={importMarkdownText}
                  onChange={(e) => setImportMarkdownText(e.target.value)}
                  className="input-field font-mono text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="btn btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!importMarkdownText.trim()}
                onClick={handleImportMarkdownSubmit}
                className="btn btn-primary text-xs"
              >
                <Upload size={14} /> Parse & Create Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
