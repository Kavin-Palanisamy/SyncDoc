import React, { useRef, useEffect } from 'react';
import { HeadingNode } from '@syncdoc/shared';

interface HeadingBlockProps {
  node: HeadingNode;
  isLocked: boolean;
  onContentChange: (content: string) => void;
  onLevelChange: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const HeadingBlock: React.FC<HeadingBlockProps> = ({
  node,
  isLocked,
  onContentChange,
  onLevelChange,
  onFocus,
  onBlur,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const level = node.level || 1;

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerText !== (node.content || '')) {
      contentRef.current.innerText = node.content || '';
    }
  }, [node.content]);

  const handleInput = () => {
    if (contentRef.current) {
      onContentChange(contentRef.current.innerText);
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2 mb-1">
        <select
          value={level}
          disabled={isLocked}
          onChange={(e) => onLevelChange(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5 | 6)}
          className="text-xs bg-slate-800 text-cyan-400 font-mono px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600 focus:outline-none cursor-pointer"
        >
          <option value={1}>H1 Heading</option>
          <option value={2}>H2 Subheading</option>
          <option value={3}>H3 Section</option>
          <option value={4}>H4 Subsection</option>
          <option value={5}>H5 Minor</option>
          <option value={6}>H6 Detail</option>
        </select>
      </div>

      <div
        ref={contentRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder={`Heading ${level}...`}
        className={`block-editable block-heading block-h${level} ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
      />
    </div>
  );
};
