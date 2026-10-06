import React, { useEffect, useState } from 'react';
import { ApiService, DocumentSummary } from '../services/api.js';
import { CollaborationProvider } from '../context/CollaborationContext.js';
import { DocumentEditor } from '../components/editor/DocumentEditor.js';
import { Zap, AlertCircle } from 'lucide-react';

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
      <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center mb-3 text-blue-400 shadow-lg shadow-blue-950/50">
          <Zap className="animate-pulse" size={20} />
        </div>
        <p className="text-slate-300 font-semibold text-sm mb-1">
          Connecting to document session...
        </p>
        <p className="text-slate-500 text-xs font-mono">
          Initializing Yjs CRDT synchronization & AST validation
        </p>
      </div>
    );
  }

  if (error || !docSummary) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center mb-3 text-rose-400 shadow-lg">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-200 mb-1.5">Failed to load document</h2>
        <p className="text-slate-400 text-xs max-w-sm mb-5 leading-relaxed">
          {error || 'The requested document could not be retrieved from the catalog.'}
        </p>
        <button onClick={onBackToDashboard} className="dashboard-primary-btn text-xs">
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
