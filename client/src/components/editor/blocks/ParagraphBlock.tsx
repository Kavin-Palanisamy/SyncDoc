import React, { useRef, useEffect } from 'react';
import { ParagraphNode } from '@syncdoc/shared';

interface ParagraphBlockProps {
  node: ParagraphNode;
  isLocked: boolean;
  onContentChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
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
    if (contentRef.current) {
      onContentChange(contentRef.current.innerText);
    }
  };

  return (
    <div
      ref={contentRef}
      contentEditable={!isLocked}
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={onFocus}
      onBlur={onBlur}
      data-placeholder="Type paragraph content..."
      className={`block-editable block-paragraph ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
    />
  );
};
