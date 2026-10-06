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
  ArrowRight,
  RefreshCw,
  Check,
  LogOut,
} from 'lucide-react';
import { ApiService, DocumentSummary } from '../services/api.js';
import { createDocumentAST, DocumentNode, HeadingNode, ParagraphNode, CodeBlockNode, ListNode, TeamMember } from '@syncdoc/shared';
import "./DashboardPage.css";
import Sidebar from '../components/Sidebar.jsx';
import { TeamMembersPanel } from '../components/TeamMembersPanel.js';
import { getSharedSocket } from '../services/socket.js';

interface DashboardPageProps {
  onOpenDocument: (documentId: string) => void;
  onLogout?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenDocument, onLogout }) => {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMarkdownText, setImportMarkdownText] = useState('');
  const [importTitle, setImportTitle] = useState('');

  // Team presence state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // User preferences
  const [userName, setUserName] = useState(() => localStorage.getItem('syncdoc_user_name') || 'Kavin');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // Load team members and synchronize real-time presence via Socket.IO
  useEffect(() => {
    let isMounted = true;

    const fetchTeam = async () => {
      setLoadingTeam(true);
      try {
        const list = await ApiService.getTeamMembers();
        if (isMounted) setTeamMembers(list);
      } catch (err) {
        console.warn('Unable to fetch team members via REST:', err);
      } finally {
        if (isMounted) setLoadingTeam(false);
      }
    };

    fetchTeam();

    const socket = getSharedSocket();
    const normalizedName = userName.trim() || 'Kavin';
    const userId =
      localStorage.getItem('syncdoc_user_id') ||
      `user_${normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const registerUser = () => {
      socket.emit('register-presence', {
        userId,
        userName: normalizedName,
        userColor: '#3b82f6',
      });
    };

    if (socket.connected) {
      registerUser();
    } else {
      socket.on('connect', registerUser);
    }

    const handlePresenceSync = (data: { members: TeamMember[]; onlineCount: number }) => {
      if (isMounted && data && Array.isArray(data.members)) {
        setTeamMembers(data.members);
      }
    };

    socket.on('team-presence-sync', handlePresenceSync);
    socket.emit('request-team-presence');

    return () => {
      isMounted = false;
      socket.off('connect', registerUser);
      socket.off('team-presence-sync', handlePresenceSync);
    };
  }, [userName]);

  const fetchDocuments = async (retries = 2) => {
    setLoading(true);
    setErrorMessage(null);
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
      setErrorMessage('Unable to connect to document catalog. Please check server status.');
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

  const handleSaveUserName = () => {
    const trimmed = tempName.trim() || 'Kavin';
    setUserName(trimmed);
    localStorage.setItem('syncdoc_user_name', trimmed);
    sessionStorage.setItem('syncdoc_user_name', trimmed);
    setIsEditingName(false);

    const socket = getSharedSocket();
    const userId =
      localStorage.getItem('syncdoc_user_id') ||
      `user_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    socket.emit('register-presence', {
      userId,
      userName: trimmed,
      userColor: '#3b82f6',
    });
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar Navigation */}
      <Sidebar
        documents={documents}
        activeDocumentId={null}
        onSelectDocument={onOpenDocument}
        onNewDocument={() => handleCreateFromTemplate('blank')}
      />

      {/* Main Content Area */}
      <div className="dashboard-content-area">
        {/* Top Navbar */}
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-inner">
            <div className="dashboard-topbar-left">
              <span className="dashboard-workspace-crumb">Workspace</span>
              <span className="dashboard-crumb-separator">/</span>
              <span className="dashboard-crumb-current">All Documents</span>
            </div>

            <div className="dashboard-topbar-actions">
              {/* User Identity Box */}
              <div className="dashboard-user-pill">
                <div className="dashboard-user-avatar">
                  {userName.trim().charAt(0).toUpperCase() || 'U'}
                </div>

                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={handleSaveUserName}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveUserName()}
                      className="dashboard-name-input"
                    />
                    <button
                      onClick={handleSaveUserName}
                      className="text-emerald-400 hover:text-emerald-300 p-0.5"
                      title="Save name"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setTempName(userName);
                      setIsEditingName(true);
                    }}
                    className="dashboard-name-btn"
                    title="Click to change your display name"
                  >
                    <span>{userName}</span>
                  </button>
                )}
              </div>

              {/* Logout Button */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="dashboard-logout-btn"
                  title="Sign out of SyncDoc workspace"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}

              {/* Primary New Document CTA */}
              <button
                onClick={() => handleCreateFromTemplate('blank')}
                className="dashboard-primary-btn"
              >
                <Plus size={15} />
                <span>New Document</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="dashboard-main-container">
          <div className="dashboard-layout-row">
            {/* Left / Center Column: Workspace Hero & Document Catalog */}
            <div className="dashboard-layout-main">
          {/* Workspace Hero */}
          <section className="dashboard-hero-section">
            <div className="dashboard-hero-header">
              <div>
                <h1 className="dashboard-hero-title">Technical Workspace</h1>
                <p className="dashboard-hero-desc">
                  Collaborative AST document engine with real-time conflict-free synchronization.
                </p>
              </div>

              <div className="dashboard-engine-badge">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Mongoose Recursive AST Validation</span>
              </div>
            </div>

            {/* Quick Action / Templates Grid */}
            <div className="dashboard-action-grid">
              {/* Quick Blank Doc */}
              <div
                onClick={() => handleCreateFromTemplate('blank')}
                className="action-card action-card--primary group"
              >
                <div className="action-card-header">
                  <div className="action-card-icon action-card-icon--blue">
                    <Plus size={18} />
                  </div>
                  <span className="action-card-badge action-card-badge--blue">Instant</span>
                </div>
                <div className="action-card-body">
                  <h3 className="action-card-title">Blank Document</h3>
                  <p className="action-card-desc">
                    Fresh structural canvas with block editing and real-time collaborative syncing.
                  </p>
                </div>
                <div className="action-card-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* RFC Template */}
              <div
                onClick={() => handleCreateFromTemplate('rfc')}
                className="action-card group"
              >
                <div className="action-card-header">
                  <div className="action-card-icon action-card-icon--purple">
                    <BookOpen size={18} />
                  </div>
                  <span className="action-card-badge action-card-badge--purple">Template</span>
                </div>
                <div className="action-card-body">
                  <h3 className="action-card-title">Architecture RFC</h3>
                  <p className="action-card-desc">
                    Engineering design document with problem statement, design goals, and code snippets.
                  </p>
                </div>
                <div className="action-card-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* API Spec Template */}
              <div
                onClick={() => handleCreateFromTemplate('api')}
                className="action-card group"
              >
                <div className="action-card-header">
                  <div className="action-card-icon action-card-icon--cyan">
                    <Code size={18} />
                  </div>
                  <span className="action-card-badge action-card-badge--cyan">Template</span>
                </div>
                <div className="action-card-body">
                  <h3 className="action-card-title">API Technical Spec</h3>
                  <p className="action-card-desc">
                    Structured service contract with endpoint listings, data types, and method definitions.
                  </p>
                </div>
                <div className="action-card-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Markdown Importer */}
              <div
                onClick={() => setIsImportModalOpen(true)}
                className="action-card group"
              >
                <div className="action-card-header">
                  <div className="action-card-icon action-card-icon--emerald">
                    <Upload size={18} />
                  </div>
                  <span className="action-card-badge action-card-badge--emerald">Parser</span>
                </div>
                <div className="action-card-body">
                  <h3 className="action-card-title">Import Markdown</h3>
                  <p className="action-card-desc">
                    Parse and validate external Markdown files directly into full structural AST trees.
                  </p>
                </div>
                <div className="action-card-arrow">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </section>

          {/* Search & Filter Bar */}
          <section className="dashboard-catalog-section">
            <div className="dashboard-filter-row">
              <div className="dashboard-search-wrap">
                <Search size={15} className="dashboard-search-icon" />
                <input
                  type="text"
                  placeholder="Filter documents by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="dashboard-search-input"
                />
              </div>

              <div className="dashboard-filter-meta">
                <span className="dashboard-doc-count-badge">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                </span>
              </div>
            </div>

            {/* Error State */}
            {errorMessage && (
              <div className="dashboard-error-banner">
                <p>{errorMessage}</p>
                <button onClick={() => fetchDocuments()} className="dashboard-retry-btn">
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading && !errorMessage ? (
              <div className="dashboard-docs-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="doc-skeleton-card">
                    <div className="doc-skeleton-icon" />
                    <div className="doc-skeleton-title" />
                    <div className="doc-skeleton-snippet" />
                    <div className="doc-skeleton-snippet short" />
                    <div className="doc-skeleton-footer">
                      <div className="doc-skeleton-badge" />
                      <div className="doc-skeleton-time" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !loading && documents.length === 0 ? (
              /* Empty State */
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-icon-wrap">
                  <FileText size={28} className="text-slate-400" />
                </div>
                <h3 className="dashboard-empty-title">
                  {searchQuery ? 'No matching documents found' : 'No documents in workspace'}
                </h3>
                <p className="dashboard-empty-desc">
                  {searchQuery
                    ? `No documents matched "${searchQuery}". Clear your search or create a new document.`
                    : 'Start creating technical documents with collaborative real-time AST conflict resolution.'}
                </p>
                <div className="dashboard-empty-actions">
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="dashboard-secondary-btn"
                    >
                      Clear Search
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleCreateFromTemplate('blank')}
                    className="dashboard-primary-btn"
                  >
                    <Plus size={15} /> Create First Document
                  </button>
                </div>
              </div>
            ) : (
              /* Document Grid */
              <div className="dashboard-docs-grid">
                {documents.map((doc) => {
                  const nodeCount = (doc.root?.children?.length || 0) + 1;
                  const snippet =
                    (doc.root?.children?.[1] as { content?: string } | undefined)?.content ||
                    (doc.root?.children?.[0] as { content?: string } | undefined)?.content ||
                    'Clean structural document';

                  return (
                    <article
                      key={doc._id}
                      onClick={() => onOpenDocument(doc._id)}
                      className="doc-card group"
                    >
                      <button
                        onClick={(e) => handleDeleteDocument(doc._id, e)}
                        className="doc-card-delete-btn"
                        title="Delete Document"
                        aria-label="Delete Document"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="doc-card-top">
                        <div className="doc-card-icon-pill">
                          <FileText size={16} />
                        </div>
                        <span className="doc-card-version-pill font-mono">
                          v{doc.version}
                        </span>
                      </div>

                      <h3 className="doc-card-heading" title={doc.title}>
                        {doc.title}
                      </h3>

                      <p className="doc-card-preview">
                        {snippet}
                      </p>

                      <div className="doc-card-bottom">
                        <div className="doc-card-meta-pill">
                          <Layers size={11} />
                          <span>{nodeCount} {nodeCount === 1 ? 'block' : 'blocks'}</span>
                        </div>
                        <div className="doc-card-time-pill">
                          <Clock size={11} />
                          <span>{new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: TEAM MEMBERS PANEL */}
        <TeamMembersPanel
          currentUserName={userName}
          members={teamMembers}
          loading={loadingTeam}
        />
      </div>
    </main>
  </div>

      {/* Markdown Import Modal */}
      {isImportModalOpen && (
        <div className="dashboard-modal-backdrop">
          <div className="dashboard-modal-card animate-modal-enter">
            <div className="dashboard-modal-header">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                  <Upload size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Import Markdown to AST</h3>
                  <p className="text-xs text-slate-400">Generates validated AST nodes from Markdown</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                &times;
              </button>
            </div>

            <div className="dashboard-modal-body">
              <div className="form-group">
                <label className="form-label">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected from first heading if left blank"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Markdown Source
                </label>
                <textarea
                  rows={8}
                  placeholder="# Technical Spec&#10;&#10;Write or paste markdown content here..."
                  value={importMarkdownText}
                  onChange={(e) => setImportMarkdownText(e.target.value)}
                  className="form-textarea font-mono"
                />
              </div>
            </div>

            <div className="dashboard-modal-footer">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="dashboard-secondary-btn"
              >
                Cancel
              </button>
              <button
                disabled={!importMarkdownText.trim()}
                onClick={handleImportMarkdownSubmit}
                className="dashboard-primary-btn"
              >
                <Upload size={14} /> Parse & Initialize Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
