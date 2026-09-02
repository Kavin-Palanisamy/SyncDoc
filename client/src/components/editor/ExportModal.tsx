import React, { useState } from 'react';
import { Download, X, FileCode, Printer, FileText, Code2 } from 'lucide-react';
import { ApiService } from '../../services/api.js';

interface ExportModalProps {
  documentId: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  documentId,
  title,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'html' | 'pdf' | 'markdown' | 'json'>('html');
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await ApiService.exportDocument(documentId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPreview = async () => {
    try {
      const { blob } = await ApiService.exportDocument(documentId, 'pdf');
      const text = await blob.text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(text);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (err) {
      console.error('Failed to trigger print preview:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="text-blue-400" size={18} />
            <h3 className="font-display font-bold text-slate-100 text-base">
              Export Document: &quot;{title}&quot;
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400">
            Select an export pipeline format. All HTML and PDF outputs are sanitized through the DOMPurify security pipeline.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* HTML option */}
            <button
              onClick={() => setFormat('html')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'html'
                  ? 'bg-blue-950/50 border-blue-500 shadow-md'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                <FileCode size={16} /> Sanitized HTML
              </div>
              <span className="text-[11px] text-slate-400">
                Clean web HTML with DOMPurify XSS protections.
              </span>
            </button>

            {/* PDF / Print option */}
            <button
              onClick={() => setFormat('pdf')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'pdf'
                  ? 'bg-blue-950/50 border-blue-500 shadow-md'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                <Printer size={16} /> Print / PDF Layout
              </div>
              <span className="text-[11px] text-slate-400">
                Self-contained printable typography & print media layout.
              </span>
            </button>

            {/* Markdown option */}
            <button
              onClick={() => setFormat('markdown')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'markdown'
                  ? 'bg-blue-950/50 border-blue-500 shadow-md'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FileText size={16} /> Markdown (.md)
              </div>
              <span className="text-[11px] text-slate-400">
                Compiled standard GitHub Flavored Markdown.
              </span>
            </button>

            {/* JSON AST option */}
            <button
              onClick={() => setFormat('json')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'json'
                  ? 'bg-blue-950/50 border-blue-500 shadow-md'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                <Code2 size={16} /> Structural AST (.json)
              </div>
              <span className="text-[11px] text-slate-400">
                Full tree structure with node IDs and metadata.
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          {format === 'pdf' ? (
            <button
              onClick={handlePrintPreview}
              className="btn btn-secondary text-xs"
            >
              <Printer size={14} /> Open Print / Save as PDF
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost text-xs">
              Cancel
            </button>
            <button
              disabled={downloading}
              onClick={handleDownload}
              className="btn btn-primary text-xs"
            >
              <Download size={14} />
              {downloading ? 'Compiling...' : `Download ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
