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
    <div className="codeblock-container w-full">
      <div className="codeblock-header">
        <div className="flex items-center gap-2">
          <select
            value={node.language || 'typescript'}
            disabled={isLocked}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="text-xs bg-slate-900 text-blue-400 font-mono px-2 py-1 rounded border border-slate-700 hover:border-slate-600 focus:outline-none cursor-pointer"
          >
            {POPULAR_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 font-mono">AST Code Block</span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          title="Copy Code"
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
        data-placeholder="// Write code here..."
        className={`codeblock-editor block-editable ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
      />
    </div>
  );
};
