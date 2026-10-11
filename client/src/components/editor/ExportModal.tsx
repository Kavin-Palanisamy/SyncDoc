import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, FileCode, Printer, FileText, Code2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ApiService } from '../../services/api.js';
import './ExportModal.css';

interface ExportModalProps {
  documentId: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'markdown' | 'html' | 'json' | 'pdf';

interface FormatOption {
  id: ExportFormat;
  title: string;
  extension: string;
  description: string;
  icon: React.ReactNode;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  documentId,
  title,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [downloading, setDownloading] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !downloading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, downloading, onClose]);

  // Clean status when modal reopens
  useEffect(() => {
    if (isOpen) {
      setExportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sanitizedBaseName = (title || 'untitled_document')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_') || 'document';

  const previewFilename = `${sanitizedBaseName}.${format === 'pdf' ? 'print.html' : format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'html'}`;

  const formatOptions: FormatOption[] = [
    {
      id: 'markdown',
      title: 'Markdown',
      extension: '.md',
      description: 'Standard GitHub Flavored Markdown document for docs and READMEs.',
      icon: <FileText size={16} className="text-emerald-400" />,
    },
    {
      id: 'html',
      title: 'Sanitized HTML',
      extension: '.html',
      description: 'Production-ready web layout sanitized via DOMPurify XSS protections.',
      icon: <FileCode size={16} className="text-blue-400" />,
    },
    {
      id: 'json',
      title: 'JSON / AST Tree',
      extension: '.json',
      description: 'Full Abstract Syntax Tree representation with node IDs and attributes.',
      icon: <Code2 size={16} className="text-purple-400" />,
    },
    {
      id: 'pdf',
      title: 'Print / PDF Layout',
      extension: '.html',
      description: 'Self-contained styled document ready for browser print or Save as PDF.',
      icon: <Printer size={16} className="text-cyan-400" />,
    },
  ];

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setExportStatus(null);

    try {
      const { blob, filename } = await ApiService.exportDocument(documentId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || previewFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus({
        type: 'success',
        text: `Exported "${filename || previewFilename}" successfully!`,
      });
      setTimeout(() => setExportStatus(null), 4000);
    } catch (err: any) {
      console.error('Failed to export:', err);
      setExportStatus({
        type: 'error',
        text: err.message || 'Export generation failed. Please try again.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPreview = async () => {
    if (downloading) return;
    setDownloading(true);
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
    } catch (err: any) {
      console.error('Failed to trigger print preview:', err);
      setExportStatus({
        type: 'error',
        text: err.message || 'Failed to open print preview window.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const modalContent = (
    <div
      className="export-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !downloading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="export-modal-dialog">
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-header-left">
            <div className="export-header-icon-wrap" aria-hidden="true">
              <Download size={18} />
            </div>
            <div>
              <h2 id="export-dialog-title" className="export-modal-title">
                Export Document
              </h2>
              <p className="export-modal-subtitle" title={title}>
                &ldquo;{title}&rdquo;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="export-close-btn"
            aria-label="Close export dialog"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="export-modal-body">
          <p className="export-info-text">
            Select an export pipeline for this document. Markdown and HTML outputs preserve formatted blocks and AST node hierarchy.
          </p>

          {/* Status Message */}
          {exportStatus && (
            <div
              className={`export-status-alert ${exportStatus.type}`}
              role="alert"
              aria-live="polite"
            >
              {exportStatus.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
              )}
              <span>{exportStatus.text}</span>
            </div>
          )}

          {/* Format Radio Cards */}
          <div
            className="export-card-grid"
            role="radiogroup"
            aria-label="Choose export format"
          >
            {formatOptions.map((opt) => {
              const isSelected = format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={downloading}
                  onClick={() => setFormat(opt.id)}
                  className={`export-format-card ${isSelected ? 'selected' : ''}`}
                >
                  <div className="export-card-top-row">
                    <div className="export-card-left">
                      {opt.icon}
                      <span>{opt.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="export-card-badge">{opt.extension}</span>
                      <div className="export-radio-dot" aria-hidden="true">
                        {isSelected && <div className="export-radio-inner-dot" />}
                      </div>
                    </div>
                  </div>
                  <p className="export-card-desc">{opt.description}</p>
                </button>
              );
            })}
          </div>

          {/* Filename Preview */}
          <div className="export-filename-box">
            <span className="export-filename-label">Target File</span>
            <span className="export-filename-val">{previewFilename}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="export-modal-footer">
          {format === 'pdf' ? (
            <button
              type="button"
              disabled={downloading}
              onClick={handlePrintPreview}
              className="btn-secondary flex items-center gap-2"
            >
              <Printer size={14} /> Open Print Dialog
            </button>
          ) : (
            <div />
          )}

          <div className="export-footer-actions">
            <button
              type="button"
              disabled={downloading}
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="btn-primary flex items-center gap-2"
              aria-busy={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
