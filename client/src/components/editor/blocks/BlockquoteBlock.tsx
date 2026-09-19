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
    if (!contentRef.current) return;
    const isFocused = document.activeElement === contentRef.current;
    const currentText = contentRef.current.innerText;
    const targetText = node.content || '';
    if (!isFocused || (currentText === '' && targetText !== '')) {
      if (currentText !== targetText) {
        contentRef.current.innerText = targetText;
      }
    }
  }, [node.content]);

  const handleInput = () => {
    if (isLocked) return;
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
        className={`block-editable ${isLocked ? 'opacity-70 cursor-not-allowed select-none' : ''}`}
      />
    </div>
  );
};
