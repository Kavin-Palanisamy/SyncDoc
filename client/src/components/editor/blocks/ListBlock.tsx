import React, { useRef, useEffect } from 'react';
import { ListNode, ListItemNode, generateNodeId } from '@syncdoc/shared';
import { Plus, Trash2 } from 'lucide-react';

interface ListBlockProps {
  node: ListNode;
  isLocked: boolean;
  onUpdateItems: (items: ListItemNode[]) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export const ListBlock: React.FC<ListBlockProps> = ({
  node,
  isLocked,
  onUpdateItems,
  onFocus,
  onBlur,
}) => {
  const items = node.children || [];

  const handleItemChange = (idx: number, newContent: string) => {
    if (isLocked) return;
    const updated = [...items];
    if (updated[idx]) {
      updated[idx] = { ...updated[idx], content: newContent };
      onUpdateItems(updated);
    }
  };

  const handleToggleCheck = (idx: number) => {
    if (isLocked) return;
    const updated = [...items];
    if (updated[idx]) {
      updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
      onUpdateItems(updated);
    }
  };

  const handleAddItem = (idx: number) => {
    if (isLocked) return;
    const updated = [...items];
    const newItem: ListItemNode = {
      id: generateNodeId('li'),
      type: 'list_item',
      content: '',
      checked: node.listType === 'task' ? false : undefined,
      parentId: node.id,
      children: [],
      order: idx + 1,
    };
    updated.splice(idx + 1, 0, newItem);
    updated.forEach((item, i) => (item.order = i));
    onUpdateItems(updated);
  };

  const handleDeleteItem = (idx: number) => {
    if (isLocked || items.length <= 1) return;
    const updated = items.filter((_, i) => i !== idx);
    updated.forEach((item, i) => (item.order = i));
    onUpdateItems(updated);
  };

  return (
    <div className="flex flex-col gap-1 w-full my-1">
      {items.length === 0 ? (
        <button
          disabled={isLocked}
          onClick={() => {
            if (!isLocked) handleAddItem(-1);
          }}
          className={`text-xs text-cyan-400 flex items-center gap-1 hover:underline ${
            isLocked ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <Plus size={12} /> Add item
        </button>
      ) : (
        items.map((item, idx) => (
          <ListItemRow
            key={item.id}
            item={item}
            index={idx}
            listType={node.listType}
            isLocked={isLocked}
            onContentChange={(content) => handleItemChange(idx, content)}
            onToggleCheck={() => handleToggleCheck(idx)}
            onEnterPress={() => handleAddItem(idx)}
            onDelete={() => handleDeleteItem(idx)}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        ))
      )}
    </div>
  );
};

interface ListItemRowProps {
  item: ListItemNode;
  index: number;
  listType: 'bullet' | 'ordered' | 'task';
  isLocked: boolean;
  onContentChange: (content: string) => void;
  onToggleCheck: () => void;
  onEnterPress: () => void;
  onDelete: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const ListItemRow: React.FC<ListItemRowProps> = ({
  item,
  index,
  listType,
  isLocked,
  onContentChange,
  onToggleCheck,
  onEnterPress,
  onDelete,
  onFocus,
  onBlur,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    const isFocused = document.activeElement === contentRef.current;
    const currentText = contentRef.current.innerText;
    const targetText = item.content || '';
    if (!isFocused || (currentText === '' && targetText !== '')) {
      if (currentText !== targetText) {
        contentRef.current.innerText = targetText;
      }
    }
  }, [item.content]);

  const handleInput = () => {
    if (isLocked) return;
    if (contentRef.current) {
      onContentChange(contentRef.current.innerText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterPress();
    } else if (e.key === 'Backspace' && item.content === '') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div className="group/item flex items-start gap-2 w-full">
      {listType === 'bullet' && <div className="list-bullet-bullet" />}
      {listType === 'ordered' && <div className="list-bullet-number">{index + 1}.</div>}
      {listType === 'task' && (
        <input
          type="checkbox"
          checked={!!item.checked}
          disabled={isLocked}
          onChange={() => {
            if (!isLocked) onToggleCheck();
          }}
          className="mt-1 cursor-pointer accent-blue-500 w-4 h-4 rounded"
        />
      )}

      <div
        ref={contentRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder="List item..."
        className={`block-editable flex-1 text-slate-200 ${item.checked ? 'line-through text-slate-500' : ''} ${
          isLocked ? 'opacity-70 cursor-not-allowed select-none' : ''
        }`}
      />

      <button
        disabled={isLocked}
        onClick={() => {
          if (!isLocked) onDelete();
        }}
        className={`opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity ${
          isLocked ? 'pointer-events-none' : ''
        }`}
        title="Delete item"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};
