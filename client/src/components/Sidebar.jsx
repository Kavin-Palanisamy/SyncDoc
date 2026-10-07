import React, { useState } from "react";
import { Layers, Plus, FileText, Settings, User,LogOut, Menu, X, Sparkles } from "lucide-react";

import "./Sidebar.css";

/**
 * @typedef {Object} SidebarDocument
 * @property {string} _id
 * @property {string} title
 */

/**
 * @typedef {Object} SidebarProps
 * @property {SidebarDocument[]} documents
 * @property {string|null} activeDocumentId
 * @property {(documentId: string) => void} onSelectDocument
 * @property {() => void} onNewDocument
 */

/** @param {SidebarProps} props */
export default function Sidebar({
  documents = [],
  activeDocumentId = null,
  onSelectDocument = () => {},
  onNewDocument = () => {},
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [docFilter, setDocFilter] = useState("");
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  const filteredDocs = docFilter.trim()
    ? documents.filter((d) => d.title.toLowerCase().includes(docFilter.toLowerCase()))
    : documents;

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen((v) => !v)}
        aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {isMobileOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? "sidebar--open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Layers size={17} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">SyncDoc</span>
            <span className="sidebar-brand-subtitle">Collaborative Workspace</span>
          </div>
        </div>

        {/* Primary Action */}
        <button
          type="button"
          className="sidebar-new-doc"
          onClick={() => {
            onNewDocument();
            setIsMobileOpen(false);
          }}
        >
          <Plus size={15} />
          <span>New Document</span>
        </button>

        {/* Documents Section */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <h2 className="sidebar-section-label">Documents</h2>
            <span className="sidebar-doc-counter">{documents.length}</span>
          </div>

          <nav className="sidebar-doc-list" aria-label="Documents catalog">
            {filteredDocs.length === 0 ? (
              <div className="sidebar-empty">
                <FileText size={14} className="sidebar-empty-icon" />
                <span>{documents.length === 0 ? "No documents yet" : "No matches"}</span>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isActive = doc._id === activeDocumentId;
                return (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => {
                      onSelectDocument(doc._id);
                      setIsMobileOpen(false);
                    }}
                    className={`sidebar-doc-item ${isActive ? "sidebar-doc-item--active" : ""}`}
                    title={doc.title}
                  >
                    <FileText size={14} className="sidebar-doc-icon" />
                    <span className="sidebar-doc-title">{doc.title}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        <div className="sidebar-spacer" />

        {/* Bottom Workspace Status & Footer */}
        <div className="sidebar-bottom">
          <div className="sidebar-workspace-pill">
            <span className="sidebar-status-dot" />
            <span className="sidebar-status-text">CRDT Engine Live</span>
            <Sparkles size={11} className="sidebar-status-sparkle" />
          </div>

          <div className="sidebar-footer-nav">
            <button type="button" className="sidebar-bottom-item" title="Workspace Settings">
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <div className="sidebar-workspace-wrapper">
  {isWorkspaceOpen && (
    <div className="sidebar-workspace-menu">
      <button type="button" className="sidebar-workspace-menu-item">
        <User size={15} />
        <span>Your Profile</span>
      </button>

      <button type="button" className="sidebar-workspace-menu-item">
        <LogOut size={15} />
        <span>Logout</span>
      </button>
    </div>
  )}

  <button
    type="button"
    className={`sidebar-bottom-item ${
      isWorkspaceOpen ? "workspace-active" : ""
    }`}
    title="Active Profile"
    onClick={() => setIsWorkspaceOpen((prev) => !prev)}
  >
    <User size={15} />
    <span>Workspace</span>
  </button>
</div>
          </div>
        </div>
      </aside>
    </>
  );
}