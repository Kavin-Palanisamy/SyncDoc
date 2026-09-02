import React, { useRef, useEffect } from 'react';
import { BlockquoteNode } from '@syncdoc/shared';

interface BlockquoteBlockProps {
  node: BlockquoteNode;
  isLocked: boolean;
  onContentChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const BlockquoteBlock: React.FC<BlockquoteBlockProps> = ({
  node,
  isLocked,
  onContentChange,
  onFocus,
  onBlur,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

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
    <div className="block-blockquote w-full">
      <div
        ref={contentRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder="Quote text..."
        className={`block-editable ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
      />
    </div>
  );
};
