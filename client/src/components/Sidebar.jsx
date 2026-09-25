import React, { useState } from "react";
import { Layers, Plus, FileText, Settings, User, Menu, X } from "lucide-react";
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

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen((v) => !v)}
        aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Layers size={18} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">SyncDoc</span>
            <span className="sidebar-brand-subtitle">Collaborative workspace</span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-new-doc"
          onClick={onNewDocument}
        >
          <Plus size={16} />
          <span>New Document</span>
        </button>

        <div className="sidebar-section">
          <h2 className="sidebar-section-label">Documents</h2>

          <nav className="sidebar-doc-list">
            {documents.length === 0 ? (
              <p className="sidebar-empty">No documents yet</p>
            ) : (
              documents.map((doc) => {
                const isActive = doc._id === activeDocumentId;
                return (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => onSelectDocument(doc._id)}
                    className={`sidebar-doc-item ${isActive ? "sidebar-doc-item--active" : ""}`}
                    title={doc.title}
                  >
                    <FileText size={15} className="sidebar-doc-icon" />
                    <span className="sidebar-doc-title">{doc.title}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-bottom">
          {/* No existing Settings/Profile functionality found — styled as
              inert placeholders. Add onClick handlers here once real
              functionality exists. */}
          <button type="button" className="sidebar-bottom-item">
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button type="button" className="sidebar-bottom-item">
            <User size={16} />
            <span>Profile</span>
          </button>
        </div>
      </aside>
    </>
  );
}