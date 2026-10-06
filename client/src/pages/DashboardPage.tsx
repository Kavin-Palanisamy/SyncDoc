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
  User,
  ChevronDown
} from 'lucide-react';
import { ApiService, DocumentSummary } from '../services/api.js';
import { createDocumentAST, DocumentNode, HeadingNode, ParagraphNode, CodeBlockNode, ListNode } from '@syncdoc/shared';
  import "./DashboardPage.css";
  import Sidebar from '../components/Sidebar.jsx';

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
    <div className="dashboard-page min-h-screen text-slate-100 flex selection:bg-blue-600 selection:text-white">
  <Sidebar
    documents={documents}
    activeDocumentId={null}
    onSelectDocument={onOpenDocument}
    onNewDocument={() => handleCreateFromTemplate('blank')}
  />
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)]">
            <div className="dash-header-inner w-full px-6 flex items-center justify-between">
    <h1 className="dash-header-title">Workspace</h1>

            {/* User Profile Box */}
    <div className="profile-control" title={userName}>
      <div className="profile-avatar">
        <User size={14} />
      </div>
      <span className="profile-name">{userName}</span>
      <ChevronDown size={14} className="profile-chevron" />

    </div>
  </div>
</header>

      {/* Hero / Quick Actions */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-16 w-full">
  <div className="dash-section-header dash-section-header-row">
    <div>
      <h2 className="dash-eyebrow text-[var(--text-muted)]">
        Technical WorkSpace
      </h2>
      <p className="dash-eyebrow-desc text-[var(--text-secondary)]">
        Collabortive AST document engine with real time conflict-free synchronization
      </p>
    </div>

    <div className="validation-badge">
      <ShieldCheck size={13} />
      <span>Mongoose Recursive Validation Active</span>
    </div>
  </div>

    <div className="dash-hero-grid">
          {/* Quick Create Blank */}
          <div
            onClick={() => handleCreateFromTemplate('blank')}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFromTemplate('blank'); }}
            className="hero-card hero-card--blue group"
          >
            <div className="hero-card-top">
              <div className="hero-card-icon">
                <Plus size={18} />
              </div>
              <span className="dash-card-tag hero-card-tag">
                Quick Start
              </span>
            </div>
            <div className="hero-card-body">
              <h3 className="dash-card-title hero-card-title font-display group-hover:text-cyan-400 transition-colors">
                New Blank Document
              </h3>
              <p className="dash-card-desc hero-card-desc">
                Fresh structural canvas with block editing and real time collabortive syncing.
              </p>
            </div>
          </div>

          {/* Template: RFC Spec */}
          <div
            onClick={() => handleCreateFromTemplate('rfc')}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFromTemplate('rfc'); }}
            className="hero-card hero-card--purple group"
          >
            <div className="hero-card-top">
              <div className="hero-card-icon">
                <BookOpen size={18} />
              </div>
              <span className="dash-card-tag hero-card-tag">
                Template
              </span>
            </div>
            <div className="hero-card-body">
              <h3 className="dash-card-title hero-card-title font-display group-hover:text-purple-400 transition-colors">
                Architecture RFC
              </h3>
              <p className="dash-card-desc hero-card-desc">
                Technical design spec with problem statement, architecture, and code blocks.
              </p>
            </div>
          </div>

          {/* Template: API Spec */}
          <div
            onClick={() => handleCreateFromTemplate('api')}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFromTemplate('api'); }}
            className="hero-card hero-card--cyan group"
          >
            <div className="hero-card-top">
              <div className="hero-card-icon">
                <Code size={18} />
              </div>
              <span className="dash-card-tag hero-card-tag">
                Template
              </span>
            </div>
            <div className="hero-card-body">
              <h3 className="dash-card-title hero-card-title font-display group-hover:text-cyan-400 transition-colors">
                API Technical Spec
              </h3>
              <p className="dash-card-desc hero-card-desc">
                Pre-configured structural template with endpoints, methods, and nested lists.
              </p>
            </div>
          </div>

          {/* Markdown Importer */}
          <div
            onClick={() => setIsImportModalOpen(true)}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') setIsImportModalOpen(true); }}
            className="hero-card hero-card--emerald group"
          >
            <div className="hero-card-top">
              <div className="hero-card-icon">
                <Upload size={18} />
              </div>
              <span className="dash-card-tag hero-card-tag">
                Converter
              </span>
            </div>
            <div className="hero-card-body">
              <h3 className="dash-card-title hero-card-title font-display group-hover:text-emerald-400 transition-colors">
                Import Markdown to AST
              </h3>
              <p className="dash-card-desc hero-card-desc">
                Parse existing Markdown files into fully validated structural AST documents.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Catalog Filter */}
        <div className="dash-search-row flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="search-input-shell">
            <Search className="search-input-icon" size={16} />
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

        </div>

        {/* Document Cards Grid */}
        <div className="dash-docs-header flex items-center justify-between border-b border-slate-800/70">
          <h2 className="dash-eyebrow text-slate-500">
            Your documents
          </h2>
          {!loading && (
            <span className="dash-meta-count text-slate-600 font-mono">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </span>
          )}
        </div>
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            <Zap className="animate-spin inline-block text-blue-500 mb-2" size={24} />
            <p>Loading document catalog...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl p-8">
            <FileText className="mx-auto text-slate-600 mb-3" size={36} />
            <h3 className="dash-card-title text-slate-300 font-display mb-1">
              No documents found
            </h3>
            <p className="dash-card-desc text-slate-500 mb-4">
              Create a new document from scratch or choose a template above to get started.
            </p>
            <button
              onClick={() => handleCreateFromTemplate('blank')}
              className="dashboard-btn dashboard-btn-primary text-xs"
            >
              <Plus size={14} /> Create First Document
            </button>
          </div>
        ) : (
          <div className="dash-doc-grid">
                        {documents.map((doc, index) => {
              const nodeCount = (doc.root?.children?.length || 0) + 1;
              const snippet =
                (doc.root?.children?.[1] as { content?: string } | undefined)?.content ||
                (doc.root?.children?.[0] as { content?: string } | undefined)?.content ||
                'Empty document';
              const accentClass = ['doc-accent-verdigris', 'doc-accent-gold', 'doc-accent-indigo'][index % 3];

              return (
                <div
                  key={doc._id}
                  onClick={() => onOpenDocument(doc._id)}
                  className={`doc-card ${accentClass} cursor-pointer group`}
                >
                  <button
                    onClick={(e) => handleDeleteDocument(doc._id, e)}
                    className="doc-card-delete opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
                    title="Delete Document"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="doc-card-icon">
                    <FileText size={18} />
                  </div>

                  <h3 className="dash-card-title text-slate-100 group-hover:text-white transition-colors line-clamp-1">
                    {doc.title}
                  </h3>

                  <p className="dash-card-desc text-slate-400 line-clamp-2">
                    {snippet}
                  </p>

                  <div className="doc-card-footer">
                    <span className="dash-card-meta doc-card-meta-accent flex items-center gap-1 font-mono">
                      <Layers size={11} /> v{doc.version} &bull; {nodeCount} blocks
                    </span>
                    <span className="dash-card-meta flex items-center gap-1 text-slate-500">
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
            <div className="dash-modal-head border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="text-emerald-400" size={18} />
                <h3 className="dash-card-title font-display text-slate-100">
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

            <div className="dash-modal-body">
              <div>
                <label className="dash-card-tag block normal-case text-slate-300 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected from first heading if left blank"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  className="dashboard-input text-xs"
                />
              </div>

              <div>
                <label className="dash-card-tag block normal-case text-slate-300 mb-1">
                  Markdown Content
                </label>
                <textarea
                  rows={8}
                  placeholder="# Technical Spec&#10;&#10;Write markdown content here..."
                  value={importMarkdownText}
                  onChange={(e) => setImportMarkdownText(e.target.value)}
                  className="dashboard-input font-mono text-xs"
                />
              </div>
            </div>

            <div className="dash-modal-foot bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="dashboard-btn dashboard-btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!importMarkdownText.trim()}
                onClick={handleImportMarkdownSubmit}
                className="dashboard-btn dashboard-btn-primary text-xs"
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
