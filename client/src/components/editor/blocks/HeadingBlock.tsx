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
    <div className="relative flex items-baseline gap-2 w-full group/heading">
      {/* Subtle Level Switcher Chip */}
      <div className="shrink-0 opacity-0 group-hover/heading:opacity-100 focus-within:opacity-100 transition-opacity">
        <select
          value={level}
          disabled={isLocked}
          onChange={(e) => {
            if (isLocked) return;
            onLevelChange(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5 | 6);
          }}
          className="heading-level-select"
          title="Change heading level (H1–H6)"
          aria-label="Heading level"
        >
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
          <option value={4}>H4</option>
          <option value={5}>H5</option>
          <option value={6}>H6</option>
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
        className={`block-editable block-heading block-h${level} flex-1 ${
          isLocked ? 'opacity-70 cursor-not-allowed select-none' : ''
        }`}
      />
    </div>
  );
};

