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
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center">
        <Zap className="animate-spin text-blue-500 mb-3" size={32} />
        <p className="text-slate-400 font-display font-medium text-sm">
          Loading document & establishing Yjs collaboration session...
        </p>
      </div>
    );
  }

  if (error || !docSummary) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="text-rose-500 mb-3" size={40} />
        <h2 className="text-lg font-bold text-slate-200 mb-2">Failed to load document</h2>
        <p className="text-slate-400 text-xs max-w-md mb-6">{error}</p>
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
