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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-menu-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center">
              <Download size={16} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                Export Document
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">&quot;{title}&quot;</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-editor-icon"
            title="Close modal"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose an export pipeline. HTML and PDF outputs are sanitized through the DOMPurify security pipeline.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* HTML option */}
            <button
              onClick={() => setFormat('html')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'html'
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                <FileCode size={15} /> Sanitized HTML
              </div>
              <span className="text-[11px] text-slate-400 leading-snug">
                Web document with DOMPurify XSS protections.
              </span>
            </button>

            {/* PDF / Print option */}
            <button
              onClick={() => setFormat('pdf')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'pdf'
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Printer size={15} /> Print / PDF Layout
              </div>
              <span className="text-[11px] text-slate-400 leading-snug">
                Self-contained printable layout with custom CSS.
              </span>
            </button>

            {/* Markdown option */}
            <button
              onClick={() => setFormat('markdown')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'markdown'
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <FileText size={15} /> Markdown (.md)
              </div>
              <span className="text-[11px] text-slate-400 leading-snug">
                Standard GitHub Flavored Markdown document.
              </span>
            </button>

            {/* JSON AST option */}
            <button
              onClick={() => setFormat('json')}
              className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                format === 'json'
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/50'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                <Code2 size={15} /> Structural AST (.json)
              </div>
              <span className="text-[11px] text-slate-400 leading-snug">
                Full AST tree structure with node IDs.
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#090d16]/80 border-t border-white/[0.08] flex items-center justify-between">
          {format === 'pdf' ? (
            <button
              onClick={handlePrintPreview}
              className="btn-editor-secondary"
            >
              <Printer size={13} /> Open Print Preview
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-editor-secondary">
              Cancel
            </button>
            <button
              disabled={downloading}
              onClick={handleDownload}
              className="btn-editor-primary"
            >
              <Download size={13} />
              {downloading ? 'Compiling...' : `Download ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
