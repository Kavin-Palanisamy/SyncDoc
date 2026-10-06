import React, { useRef, useEffect, useState } from 'react';
import { CodeBlockNode } from '@syncdoc/shared';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  node: CodeBlockNode;
  isLocked: boolean;
  onContentChange: (content: string) => void;
  onLanguageChange: (language: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

const POPULAR_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'sql',
  'html',
  'css',
  'json',
  'bash',
  'markdown',
];

export const CodeBlock: React.FC<CodeBlockProps> = ({
  node,
  isLocked,
  onContentChange,
  onLanguageChange,
  onFocus,
  onBlur,
}) => {
  const codeRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!codeRef.current) return;
    const isFocused = document.activeElement === codeRef.current;
    const currentText = codeRef.current.innerText;
    const targetText = node.content || '';
    if (!isFocused || (currentText === '' && targetText !== '')) {
      if (currentText !== targetText) {
        codeRef.current.innerText = targetText;
      }
    }
  }, [node.content]);

  const handleInput = () => {
    if (isLocked) return;
    if (codeRef.current) {
      onContentChange(codeRef.current.innerText);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(node.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="codeblock-container w-full shadow-lg">
      <div className="codeblock-header">
        <div className="flex items-center gap-2">
          <select
            value={node.language || 'typescript'}
            disabled={isLocked}
            onChange={(e) => {
              if (isLocked) return;
              onLanguageChange(e.target.value);
            }}
            className="codeblock-lang-select"
            title="Select code language"
            aria-label="Code language"
          >
            {POPULAR_LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-slate-900 text-slate-200">
                {lang}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">Code Snippet</span>
        </div>

        <button
          onClick={handleCopy}
          className={`codeblock-copy-btn ${copied ? 'is-copied' : ''}`}
          title="Copy code to clipboard"
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <pre
        ref={codeRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder="// Write or paste code snippet here..."
        className={`codeblock-editor block-editable ${isLocked ? 'opacity-70 cursor-not-allowed select-none' : ''}`}
      />
    </div>
  );
};

