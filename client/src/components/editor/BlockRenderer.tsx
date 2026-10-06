import React, { useState, useRef, useEffect } from 'react';
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
    currentUser,
    clientId,
  } = useCollaboration();

  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  // Check if any remote collaborator is currently editing/locking this block
  const remoteLock = blockLocks[node.id];
  const isLockedByMe = Boolean(
    clientId && remoteLock?.lockedBy === clientId
  );

  const isLockedByOther = Boolean(
    remoteLock &&
    remoteLock.isLocked &&
    !isLockedByMe
  );

  // Check which remote collaborators are viewing or editing this block (exclude local user by clientId)
  const activeCollaboratorsOnBlock = collaborators.filter(
    (c) => c.activeBlockId === node.id && (clientId ? c.clientId !== clientId : c.userId !== currentUser.userId)
  );

  const isLocalActive = activeBlockId === node.id;

  // Blur grace period timer (1200ms) to prevent premature lock release during tab/window switching
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeBlockIdRef = useRef<string | null>(activeBlockId);
  activeBlockIdRef.current = activeBlockId;

  const handleFocus = () => {
    if (isLockedByOther) return;
    // Cancel pending unlock if user returns to this block
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setBlockFocus(node.id, 'editing');
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      // Only release if this block is still the active block being edited
      if (activeBlockIdRef.current === node.id) {
        setBlockFocus(null, 'idle');
      }
      blurTimeoutRef.current = null;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  const renderContent = () => {
    switch (node.type) {
      case 'heading':
        return (
          <HeadingBlock
            node={node as HeadingNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => {
              if (isLockedByOther) return;
              updateBlockContent(node.id, content);
            }}
            onLevelChange={(level) => {
              if (isLockedByOther) return;
              updateBlockProperties(node.id, { level });
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'paragraph':
        return (
          <ParagraphBlock
            node={node as ParagraphNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => {
              if (isLockedByOther) return;
              updateBlockContent(node.id, content);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'code_block':
        return (
          <CodeBlock
            node={node as CodeBlockNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => {
              if (isLockedByOther) return;
              updateBlockContent(node.id, content);
            }}
            onLanguageChange={(language) => {
              if (isLockedByOther) return;
              updateBlockProperties(node.id, { language });
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'list':
        return (
          <ListBlock
            node={node as ListNode}
            isLocked={isLockedByOther}
            onUpdateItems={(items: ListItemNode[]) => {
              if (isLockedByOther) return;
              updateBlockProperties(node.id, { children: items });
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'blockquote':
        return (
          <BlockquoteBlock
            node={node as BlockquoteNode}
            isLocked={isLockedByOther}
            onContentChange={(content) => {
              if (isLockedByOther) return;
              updateBlockContent(node.id, content);
            }}
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
    <div className="relative group/block-item">
      {/* Insert gap trigger line ABOVE block */}
      <div
        className="insert-gap-btn"
        onClick={() => setShowInsertMenu(!showInsertMenu)}
        title="Add content here"
        role="button"
        tabIndex={0}
      >
        <div className="insert-gap-line" />
        <div className="insert-gap-chip">
          <Plus size={11} />
          <span>Add content</span>
        </div>
      </div>

      {/* Insert Block Dropdown Menu */}
      {showInsertMenu && (
        <div className="absolute top-2 left-10 z-30 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-wrap gap-1 max-w-sm animate-menu-enter">
          <button
            onClick={() => {
              insertBlock('paragraph', index);
              setShowInsertMenu(false);
            }}
            className="btn-insert-chip"
          >
            <Type size={12} className="insert-chip-icon text-slate-400" />
            <span>Paragraph</span>
          </button>
          <button
            onClick={() => {
              insertBlock('heading', index, { level: 2 });
              setShowInsertMenu(false);
            }}
            className="btn-insert-chip"
          >
            <Heading size={12} className="insert-chip-icon text-purple-400" />
            <span>Heading</span>
          </button>
          <button
            onClick={() => {
              insertBlock('code_block', index);
              setShowInsertMenu(false);
            }}
            className="btn-insert-chip"
          >
            <Code size={12} className="insert-chip-icon text-amber-400" />
            <span>Code</span>
          </button>
          <button
            onClick={() => {
              insertBlock('list', index);
              setShowInsertMenu(false);
            }}
            className="btn-insert-chip"
          >
            <List size={12} className="insert-chip-icon text-cyan-400" />
            <span>List</span>
          </button>
          <button
            onClick={() => {
              insertBlock('blockquote', index);
              setShowInsertMenu(false);
            }}
            className="btn-insert-chip"
          >
            <Quote size={12} className="insert-chip-icon text-pink-400" />
            <span>Quote</span>
          </button>
        </div>
      )}

      {/* Main Block Item */}
      <div
        className={`block-wrapper ${isLocalActive ? 'is-active-local' : ''} ${
          isLockedByOther ? 'is-locked-remote is-active-remote' : ''
        }`}
        style={{
          boxShadow: isLockedByOther
            ? `inset 3px 0 0 0 ${remoteLock?.userColor || '#f43f5e'}`
            : isLocalActive
            ? 'inset 2px 0 0 0 var(--accent-primary)'
            : undefined,
        }}
      >
        {/* Prominent Remote Lock Banner directly above block content */}
        {isLockedByOther && remoteLock && (
          <div
            className="remote-lock-banner"
            style={{
              borderColor: remoteLock.userColor ? `${remoteLock.userColor}40` : 'rgba(59, 130, 246, 0.25)',
              backgroundColor: remoteLock.userColor ? `${remoteLock.userColor}15` : 'rgba(59, 130, 246, 0.1)',
            }}
          >
            <div
              className="remote-lock-badge"
              style={{ backgroundColor: remoteLock.userColor || '#3b82f6' }}
            >
              <Lock size={10} className="text-white shrink-0" />
              <span className="text-white font-bold text-[11px]">
                {remoteLock.lockedByName || 'Collaborator'}
              </span>
            </div>
            <span className="text-[11px] text-slate-300 font-medium">
              is actively editing &bull; Read-only lock
            </span>
          </div>
        )}

        {/* Remote Viewing Presence Badge (when viewing and not locked) */}
        {!isLockedByOther && activeCollaboratorsOnBlock.length > 0 && (
          <div
            className="remote-presence-badge"
            style={{ backgroundColor: activeCollaboratorsOnBlock[0]?.userColor || '#3b82f6' }}
          >
            <span>
              {activeCollaboratorsOnBlock.map((c) => c.userName).join(', ')} viewing
            </span>
          </div>
        )}

        {/* Left Actions Toolbar */}
        <div className="block-actions" aria-label="Block controls">
          <button
            disabled={isFirst || isLockedByOther}
            onClick={() => {
              if (!isLockedByOther) moveBlock(node.id, 'up');
            }}
            className="gutter-control-btn"
            title={isLockedByOther ? 'Block is locked' : 'Move block up'}
            aria-label="Move block up"
          >
            <ChevronUp size={13} />
          </button>

          <button
            disabled={isLast || isLockedByOther}
            onClick={() => {
              if (!isLockedByOther) moveBlock(node.id, 'down');
            }}
            className="gutter-control-btn"
            title={isLockedByOther ? 'Block is locked' : 'Move block down'}
            aria-label="Move block down"
          >
            <ChevronDown size={13} />
          </button>

          {/* Type switcher dropdown trigger */}
          <div className="relative">
            <button
              disabled={isLockedByOther}
              onClick={() => {
                if (!isLockedByOther) setShowTypeMenu(!showTypeMenu);
              }}
              className="gutter-control-btn"
              title={isLockedByOther ? 'Block is locked' : 'Change block type'}
              aria-label="Change block type"
            >
              <Type size={13} />
            </button>

            {showTypeMenu && !isLockedByOther && (
              <div className="absolute left-full top-0 ml-1.5 z-30 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1.5 w-36 animate-menu-enter">
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'paragraph');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Type size={13} className="text-slate-400" /> Paragraph
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'heading');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Heading size={13} className="text-purple-400" /> Heading
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'code_block');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Code size={13} className="text-amber-400" /> Code Block
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'list');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <List size={13} className="text-cyan-400" /> List
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'blockquote');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Quote size={13} className="text-pink-400" /> Quote
                </button>
                <button
                  onClick={() => {
                    changeBlockType(node.id, 'divider');
                    setShowTypeMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Minus size={13} className="text-slate-400" /> Divider
                </button>
              </div>
            )}
          </div>

          <button
            disabled={isLockedByOther}
            onClick={() => {
              if (!isLockedByOther) deleteBlock(node.id);
            }}
            className="gutter-control-btn is-delete"
            title={isLockedByOther ? 'Block is locked' : 'Delete block'}
            aria-label="Delete block"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Node Content */}
        {renderContent()}
      </div>
    </div>
  );
});
