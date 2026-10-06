import React, { useEffect, useState } from 'react';
import { ApiService, DocumentSummary } from '../services/api.js';
import { CollaborationProvider } from '../context/CollaborationContext.js';
import { DocumentEditor } from '../components/editor/DocumentEditor.js';
import { Zap, AlertCircle } from 'lucide-react';
import "./EditorPage.css";

interface EditorPageProps {
  documentId: string;
  onBackToDashboard: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
  documentId,
  onBackToDashboard,
}) => {
  const [docSummary, setDocSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadDoc = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getDocument(documentId);
        if (mounted) {
          setDocSummary(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDoc();
    return () => {
      mounted = false;
    };
  }, [documentId]);

    
  if (loading) {
    return (
      <div className="editor-status-screen">
        <Zap className="editor-status-spinner" size={32} />
        <p className="editor-status-text">
          Loading document & establishing Yjs collaboration session...
        </p>
      </div>
    );
  }

  if (error || !docSummary) {
    return (
      <div className="editor-status-screen editor-status-screen--error">
        <AlertCircle className="editor-status-icon-error" size={40} />
        <h2 className="editor-status-title">Failed to load document</h2>
        <p className="editor-status-desc">{error}</p>
        <button onClick={onBackToDashboard} className="btn btn-primary text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <CollaborationProvider
      documentId={documentId}
      initialDocument={docSummary.root}
    >
      <DocumentEditor onBackToDashboard={onBackToDashboard} />
    </CollaborationProvider>
  );
};
