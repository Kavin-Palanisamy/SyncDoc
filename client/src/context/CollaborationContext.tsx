import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import {
  ASTNode,
  ASTNodeType,
  DocumentNode,
  UserPresence,
  BlockLockState,
  createNode,
  cloneAST,
} from '@syncdoc/shared';
import { SyncDocYjsProvider } from '../services/yjsProvider.js';
import { ApiService } from '../services/api.js';

export interface UserProfile {
  userId: string;
  userName: string;
  userColor: string;
}

interface CollaborationContextValue {
  documentId: string;
  title: string;
  version: number;
  nodes: ASTNode[];
  collaborators: UserPresence[];
  blockLocks: Record<string, BlockLockState>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  currentUser: UserProfile;
  clientId: string;
  activeBlockId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  updateTitle: (newTitle: string) => void;
  updateBlockContent: (blockId: string, content: string) => void;
  updateBlockProperties: (blockId: string, props: Partial<ASTNode>) => void;
  insertBlock: (type: ASTNodeType, atIndex: number, options?: { content?: string; level?: 1 | 2 | 3 | 4 | 5 | 6; language?: string }) => void;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: 'up' | 'down') => void;
  changeBlockType: (blockId: string, newType: ASTNodeType) => void;
  setBlockFocus: (blockId: string | null, state: 'editing' | 'viewing' | 'idle') => void;
  undo: () => void;
  redo: () => void;
  triggerSave: () => Promise<void>;
  rollbackToVersion: (versionNumber: number) => Promise<void>;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

const COLOR_PALETTE = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
];

function getRandomUser(): UserProfile {
  const names = ['Alex Chen', 'Sam Rivera', 'Taylor Kim', 'Jordan Vance', 'Morgan Lee', 'Casey Smith'];
  const storedName = localStorage.getItem('syncdoc_user_name');
  const storedId = localStorage.getItem('syncdoc_user_id') || `user_${Date.now().toString(36)}`;
  const storedColor = localStorage.getItem('syncdoc_user_color') || COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]!;

  const userName = storedName || names[Math.floor(Math.random() * names.length)]!;
  localStorage.setItem('syncdoc_user_id', storedId);
  localStorage.setItem('syncdoc_user_name', userName);
  localStorage.setItem('syncdoc_user_color', storedColor);

  return {
    userId: storedId,
    userName,
    userColor: storedColor,
  };
}

export const CollaborationProvider: React.FC<{
  documentId: string;
  initialDocument?: DocumentNode;
  children: React.ReactNode;
}> = ({ documentId, initialDocument, children }) => {
  const [currentUser] = useState<UserProfile>(getRandomUser);
  const [title, setTitle] = useState<string>(initialDocument?.title || 'Untitled Document');
  const [version, setVersion] = useState<number>(initialDocument?.version || 1);
  const [nodes, setNodes] = useState<ASTNode[]>(initialDocument?.children || []);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);
  const [blockLocks, setBlockLocks] = useState<Record<string, BlockLockState>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [clientId, setClientId] = useState<string>('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const providerRef = useRef<SyncDocYjsProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  useEffect(() => {
    const provider = new SyncDocYjsProvider({
      documentId,
      user: currentUser,
      onStatusChange: (status, socketId) => {
        setConnectionStatus(status);
        if (socketId) setClientId(socketId);
        else if (status === 'disconnected') setClientId('');
      },
      onPresenceChange: (users) => {
        setCollaborators(users);
        const myPresence = users.find((u) => u.userId === currentUser.userId);
        if (myPresence?.clientId) {
          setClientId(myPresence.clientId);
        }
      },
      onBlockLocksChange: (locks) => setBlockLocks(locks),
      onDocChange: (updatedNodes, updatedTitle, updatedVersion) => {
        setNodes([...updatedNodes]);
        setTitle(updatedTitle);
        setVersion(updatedVersion);
      },
    });

    providerRef.current = provider;

    const undoManager = new Y.UndoManager([provider.yNodes, provider.yMeta]);
    undoManagerRef.current = undoManager;

    undoManager.on('stack-item-added', () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });
    undoManager.on('stack-item-popped', () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });

    return () => {
      provider.destroy();
      providerRef.current = null;
      undoManager.destroy();
    };
  }, [documentId]);

  const updateTitle = useCallback((newTitle: string) => {
    setTitle(newTitle);
    const provider = providerRef.current;
    if (provider) {
      provider.doc.transact(() => {
        provider.yMeta.set('title', newTitle);
      });
    }
  }, []);

  const updateBlockContent = useCallback((blockId: string, content: string) => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.doc.transact(() => {
      const idx = provider.yNodes.toArray().findIndex((n) => n.id === blockId);
      if (idx !== -1) {
        const existingNode = provider.yNodes.get(idx);
        const updatedNode = {
          ...cloneAST(existingNode),
          content,
          metadata: {
            ...(existingNode.metadata || {}),
            updatedAt: Date.now(),
            lastEditedBy: currentUser.userName,
          },
        };
        provider.yNodes.delete(idx, 1);
        provider.yNodes.insert(idx, [updatedNode]);
      }
    });
  }, [currentUser.userName]);

  const updateBlockProperties = useCallback((blockId: string, props: Partial<ASTNode>) => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.doc.transact(() => {
      const idx = provider.yNodes.toArray().findIndex((n) => n.id === blockId);
      if (idx !== -1) {
        const existingNode = provider.yNodes.get(idx);
        const updatedNode = {
          ...cloneAST(existingNode),
          ...props,
          metadata: {
            ...(existingNode.metadata || {}),
            updatedAt: Date.now(),
            lastEditedBy: currentUser.userName,
          },
        } as ASTNode;
        provider.yNodes.delete(idx, 1);
        provider.yNodes.insert(idx, [updatedNode]);
      }
    });
  }, [currentUser.userName]);

  const insertBlock = useCallback(
    (
      type: ASTNodeType,
      atIndex: number,
      options: { content?: string; level?: 1 | 2 | 3 | 4 | 5 | 6; language?: string } = {}
    ) => {
      const provider = providerRef.current;
      if (!provider) return;

      const newNode = createNode(type, documentId, atIndex, {
        ...options,
        metadata: { author: currentUser.userName, createdAt: Date.now() },
      });

      provider.doc.transact(() => {
        const clampedIndex = Math.max(0, Math.min(atIndex, provider.yNodes.length));
        provider.yNodes.insert(clampedIndex, [newNode]);

        // Re-index orders
        const allNodes = provider.yNodes.toArray();
        allNodes.forEach((node, i) => {
          node.order = i;
        });
      });
    },
    [documentId, currentUser.userName]
  );

  const deleteBlock = useCallback((blockId: string) => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.doc.transact(() => {
      const idx = provider.yNodes.toArray().findIndex((n) => n.id === blockId);
      if (idx !== -1) {
        provider.yNodes.delete(idx, 1);
      }
    });
  }, []);

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.doc.transact(() => {
      const currentList = provider.yNodes.toArray();
      const idx = currentList.findIndex((n) => n.id === blockId);
      if (idx === -1) return;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return;

      const item = currentList[idx]!;
      provider.yNodes.delete(idx, 1);
      provider.yNodes.insert(targetIdx, [item]);

      // Re-order
      const reindexed = provider.yNodes.toArray();
      reindexed.forEach((n, i) => {
        n.order = i;
      });
    });
  }, []);

  const changeBlockType = useCallback(
    (blockId: string, newType: ASTNodeType) => {
      const provider = providerRef.current;
      if (!provider) return;

      provider.doc.transact(() => {
        const idx = provider.yNodes.toArray().findIndex((n) => n.id === blockId);
        if (idx === -1) return;

        const oldNode = provider.yNodes.get(idx);
        const content = (oldNode as { content?: string }).content || '';
        const converted = createNode(newType, documentId, idx, { content });
        converted.id = oldNode.id;

        provider.yNodes.delete(idx, 1);
        provider.yNodes.insert(idx, [converted]);
      });
    },
    [documentId]
  );

  const handleSetBlockFocus = useCallback((blockId: string | null, state: 'editing' | 'viewing' | 'idle') => {
    setActiveBlockId(blockId);
    providerRef.current?.setBlockFocus(blockId, state);
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  const triggerSave = useCallback(async () => {
    if (isSaving || !providerRef.current) return;
    setIsSaving(true);
    try {
      const currentNodes = providerRef.current.yNodes.toArray();
      const currentTitle = (providerRef.current.yMeta.get('title') as string) || title;
      const rootAST: DocumentNode = {
        id: `doc_${documentId}`,
        type: 'document',
        title: currentTitle,
        version: version + 1,
        parentId: null,
        children: currentNodes,
        order: 0,
        metadata: { updatedAt: Date.now() },
      };

      const res = await ApiService.updateDocument(documentId, {
        title: currentTitle,
        root: rootAST,
        author: currentUser.userName,
        changeDescription: `Manual save by ${currentUser.userName}`,
      });

      setVersion(res.version);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Failed to manually save document:', err);
    } finally {
      setIsSaving(false);
    }
  }, [documentId, title, version, isSaving, currentUser.userName]);

  const rollbackToVersion = useCallback(async (versionNumber: number) => {
    try {
      const res = await ApiService.rollbackToVersion(documentId, versionNumber);
      if (res && res.root && providerRef.current) {
        providerRef.current.doc.transact(() => {
          providerRef.current!.yMeta.set('title', res.root.title);
          providerRef.current!.yMeta.set('version', res.root.version);
          providerRef.current!.yNodes.delete(0, providerRef.current!.yNodes.length);
          if (res.root.children) {
            providerRef.current!.yNodes.push(res.root.children);
          }
        });
      }
    } catch (err) {
      console.error(`Failed to rollback to version ${versionNumber}:`, err);
    }
  }, [documentId]);

  return (
    <CollaborationContext.Provider
      value={{
        documentId,
        title,
        version,
        nodes,
        collaborators,
        blockLocks,
        connectionStatus,
        currentUser,
        clientId: clientId || providerRef.current?.clientId || '',
        activeBlockId,
        canUndo,
        canRedo,
        isSaving,
        lastSavedAt,
        updateTitle,
        updateBlockContent,
        updateBlockProperties,
        insertBlock,
        deleteBlock,
        moveBlock,
        changeBlockType,
        setBlockFocus: handleSetBlockFocus,
        undo,
        redo,
        triggerSave,
        rollbackToVersion,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
};

export const useCollaboration = (): CollaborationContextValue => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};
