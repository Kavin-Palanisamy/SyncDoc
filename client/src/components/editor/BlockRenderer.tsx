import React, { useState } from 'react';
import {
  ASTNode,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  DividerNode,
} from '@syncdoc/shared';
import { useCollaboration } from '../../context/CollaborationContext.js';
import { HeadingBlock } from './blocks/HeadingBlock.js';
import { ParagraphBlock } from './blocks/ParagraphBlock.js';
import { CodeBlock } from './blocks/CodeBlock.js';
import { ListBlock } from './blocks/ListBlock.js';
import { BlockquoteBlock } from './blocks/BlockquoteBlock.js';
import { DividerBlock } from './blocks/DividerBlock.js';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Type,
  Heading,
  Code,
  List,
  Quote,
  Minus,
  Lock,
} from 'lucide-react';

interface BlockRendererProps {
  node: ASTNode;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}

export const BlockRenderer: React.FC<BlockRendererProps> = React.memo(({
  node,
  index,
  isFirst,
  isLast,
}) => {
  const {
    updateBlockContent,
    updateBlockProperties,
    insertBlock,
    deleteBlock,
    moveBlock,
    changeBlockType,
    setBlockFocus,
    activeBlockId,
    blockLocks,
    collaborators,
  } = useCollaboration();

  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  // Check if any remote collaborator is currently editing/locking this block
  const remoteLock = blockLocks[node.id];
  const isLockedByOther = !!remoteLock && remoteLock.isLocked;

  // Check which collaborators are viewing or editing this block
  const activeCollaboratorsOnBlock = collaborators.filter(
    (c) => c.activeBlockId === node.id
  );

  const isLocalActive = activeBlockId === node.id;

  const handleFocus = () => {
    setBlockFocus(node.id, 'editing');
  };

  const handleBlur = () => {
    setBlockFocus(null, 'idle');
  };

  const renderContent = () => {
    switch (node.type) {
      case 'heading':
        return (
          <HeadingBlock
            node={node as HeadingNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => updateBlockContent(node.id, content)}
            onLevelChange={(level) => updateBlockProperties(node.id, { level })}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'paragraph':
        return (
          <ParagraphBlock
            node={node as ParagraphNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => updateBlockContent(node.id, content)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'code_block':
        return (
          <CodeBlock
            node={node as CodeBlockNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => updateBlockContent(node.id, content)}
            onLanguageChange={(language) => updateBlockProperties(node.id, { language })}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'list':
        return (
          <ListBlock
            node={node as ListNode}
            isLocked={isLockedByOther}
            onUpdateItems={(items: ListItemNode[]) => updateBlockProperties(node.id, { children: items })}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'blockquote':
        return (
          <BlockquoteBlock
            node={node as BlockquoteNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => updateBlockContent(node.id, content)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'divider':
        return <DividerBlock node={node as DividerNode} />;

      default:
        return null;
    }
  };

  return (
    <div className="relative group">
      {/* Insert gap button ABOVE block */}
      <div
        className="insert-gap-btn"
        onClick={() => setShowInsertMenu(!showInsertMenu)}
        title="Insert block here"
      >
        <div className="insert-gap-line" />
        <div className="insert-gap-icon">
          <Plus size={12} />
        </div>
      </div>

      {showInsertMenu && (
        <div className="absolute top-0 left-12 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 flex gap-1 animate-fade-in">
          <button
            onClick={() => {
              insertBlock('paragraph', index);
              setShowInsertMenu(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <Type size={14} /> Paragraph
          </button>
          <button
            onClick={() => {
              insertBlock('heading', index, { level: 2 });
              setShowInsertMenu(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <Heading size={14} /> Heading
          </button>
          <button
            onClick={() => {
              insertBlock('code_block', index);
              setShowInsertMenu(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <Code size={14} /> Code
          </button>
          <button
            onClick={() => {
              insertBlock('list', index);
              setShowInsertMenu(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <List size={14} /> List
          </button>
          <button
            onClick={() => {
              insertBlock('blockquote', index);
              setShowInsertMenu(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <Quote size={14} /> Quote
          </button>
        </div>
      )}

      {/* Main Block Item */}
      <div
        className={`block-wrapper ${isLocalActive ? 'is-active-local' : ''} ${
          isLockedByOther ? 'is-active-remote' : ''
        }`}
        style={{
          borderLeftColor: isLockedByOther ? remoteLock.userColor : undefined,
        }}
      >
        {/* Remote Presence / Lock Badge */}
        {activeCollaboratorsOnBlock.length > 0 && (
          <div
            className="remote-presence-badge"
            style={{ backgroundColor: activeCollaboratorsOnBlock[0]?.userColor || '#3b82f6' }}
          >
            {isLockedByOther && <Lock size={10} />}
            <span>
              {activeCollaboratorsOnBlock.map((c) => c.userName).join(', ')}{' '}
              {isLockedByOther ? 'editing' : 'viewing'}
            </span>
          </div>
        )}

        {/* Left Actions Toolbar */}
        <div className="block-actions">
          <button
            disabled={isFirst}
            onClick={() => moveBlock(node.id, 'up')}
            className={`p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white ${
              isFirst ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            title="Move block up"
          >
            <ChevronUp size={12} />
          </button>

          <button
            disabled={isLast}
            onClick={() => moveBlock(node.id, 'down')}
            className={`p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white ${
              isLast ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            title="Move block down"
          >
            <ChevronDown size={12} />
          </button>

          {/* Type switcher dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400"
              title="Change block type"
            >
              <Type size={12} />
            </button>

            {showTypeMenu && (
              <div className="absolute left-full top-0 ml-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 w-32 animate-fade-in">
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'paragraph');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <Type size={12} /> Paragraph
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'heading');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <Heading size={12} /> Heading
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'code_block');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <Code size={12} /> Code Block
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'list');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <List size={12} /> List
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'blockquote');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <Quote size={12} /> Quote
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'divider');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                >
                  <Minus size={12} /> Divider
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => deleteBlock(node.id)}
            className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
            title="Delete block"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Node Content */}
        {renderContent()}
      </div>
    </div>
  );
});
