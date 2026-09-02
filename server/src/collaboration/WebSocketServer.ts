import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  UserPresence,
  BlockLockState,
  ASTNode,
  DocumentNode,
} from '@syncdoc/shared';
import { DocumentModel } from '../models/Document.js';
import { DocumentVersionModel } from '../models/DocumentVersion.js';

interface DocumentSession {
  doc: Y.Doc;
  activeUsers: Map<string, UserPresence>; // socketId -> UserPresence
  blockLocks: Map<string, BlockLockState>; // blockId -> BlockLockState
  saveTimeout: NodeJS.Timeout | null;
}

export class WebSocketCollaborationServer {
  private io: SocketIOServer;
  private sessions: Map<string, DocumentSession> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      let currentDocId: string | null = null;
      let currentUser: UserPresence | null = null;

      // Join Document Room
      socket.on('join-document', async (data: { documentId: string; user: Omit<UserPresence, 'lastActive'> }) => {
        const { documentId, user } = data;
        currentDocId = documentId;
        const roomName = `doc:${documentId}`;

        socket.join(roomName);

        const session = await this.getOrCreateSession(documentId);

        const presence: UserPresence = {
          ...user,
          clientId: socket.id,
          lastActive: Date.now(),
        };
        currentUser = presence;
        session.activeUsers.set(socket.id, presence);

        // Send current Yjs state vector / state update to the joining client
        const stateUpdate = Y.encodeStateAsUpdate(session.doc);
        socket.emit('yjs-sync', {
          documentId,
          update: Array.from(stateUpdate),
        });

        // Send current active users and block locks
        socket.emit('presence-sync', {
          documentId,
          users: Array.from(session.activeUsers.values()),
        });

        const locksRecord: Record<string, BlockLockState> = {};
        for (const [bId, lock] of session.blockLocks.entries()) {
          locksRecord[bId] = lock;
        }
        socket.emit('block-state-sync', {
          documentId,
          locks: locksRecord,
        });

        // Broadcast to other collaborators that user joined
        socket.to(roomName).emit('user-joined', {
          documentId,
          user: presence,
        });

        console.log(`[Socket.IO] User '${presence.userName}' (${socket.id}) joined document '${documentId}'`);
      });

      // Handle Yjs CRDT Updates
      socket.on('yjs-update', async (data: { documentId: string; update: number[] | Uint8Array }) => {
        const { documentId, update } = data;
        const session = this.sessions.get(documentId);
        if (!session) return;

        const updateArray = update instanceof Uint8Array ? update : new Uint8Array(update);

        // Apply update to server Y.Doc instance
        Y.applyUpdate(session.doc, updateArray);

        // Broadcast binary update to all other clients in the document room
        socket.to(`doc:${documentId}`).emit('yjs-sync', {
          documentId,
          update: Array.from(updateArray),
        });

        // Schedule debounced database save
        this.scheduleDocumentSave(documentId);
      });

      // Handle Presence Updates (cursor position, selection)
      socket.on('presence-update', (data: { documentId: string; presence: Partial<UserPresence> }) => {
        const { documentId, presence } = data;
        const session = this.sessions.get(documentId);
        if (!session) return;

        const existing = session.activeUsers.get(socket.id);
        if (existing) {
          const updated: UserPresence = {
            ...existing,
            ...presence,
            lastActive: Date.now(),
          };
          session.activeUsers.set(socket.id, updated);

          socket.to(`doc:${documentId}`).emit('presence-sync', {
            documentId,
            users: Array.from(session.activeUsers.values()),
          });
        }
      });

      // Handle Localized Block State & Locking
      socket.on('block-focus', (data: { documentId: string; blockId: string | null; editingState: 'editing' | 'viewing' | 'idle' }) => {
        const { documentId, blockId, editingState } = data;
        const session = this.sessions.get(documentId);
        if (!session || !currentUser) return;

        currentUser.activeBlockId = blockId;
        currentUser.editingState = editingState;
        currentUser.lastActive = Date.now();
        session.activeUsers.set(socket.id, currentUser);

        // Release any previous locks held by this user
        for (const [bId, lock] of session.blockLocks.entries()) {
          if (lock.lockedBy === socket.id) {
            session.blockLocks.delete(bId);
          }
        }

        // If editing and blockId specified, set block lock
        if (blockId && editingState === 'editing') {
          session.blockLocks.set(blockId, {
            blockId,
            lockedBy: socket.id,
            lockedByName: currentUser.userName,
            userColor: currentUser.userColor,
            lockedAt: Date.now(),
            isLocked: true,
          });
        }

        const locksRecord: Record<string, BlockLockState> = {};
        for (const [bId, lock] of session.blockLocks.entries()) {
          locksRecord[bId] = lock;
        }

        this.io.to(`doc:${documentId}`).emit('block-state-sync', {
          documentId,
          locks: locksRecord,
        });

        this.io.to(`doc:${documentId}`).emit('presence-sync', {
          documentId,
          users: Array.from(session.activeUsers.values()),
        });
      });

      // Disconnect or Leave
      const handleDisconnect = () => {
        if (!currentDocId) return;

        const session = this.sessions.get(currentDocId);
        if (session) {
          // Release block locks held by disconnecting user
          for (const [bId, lock] of session.blockLocks.entries()) {
            if (lock.lockedBy === socket.id) {
              session.blockLocks.delete(bId);
            }
          }

          const user = session.activeUsers.get(socket.id);
          session.activeUsers.delete(socket.id);

          const roomName = `doc:${currentDocId}`;
          if (user) {
            this.io.to(roomName).emit('user-left', {
              documentId: currentDocId,
              clientId: socket.id,
              userName: user.userName,
            });
          }

          const locksRecord: Record<string, BlockLockState> = {};
          for (const [bId, lock] of session.blockLocks.entries()) {
            locksRecord[bId] = lock;
          }
          this.io.to(roomName).emit('block-state-sync', {
            documentId: currentDocId,
            locks: locksRecord,
          });

          this.io.to(roomName).emit('presence-sync', {
            documentId: currentDocId,
            users: Array.from(session.activeUsers.values()),
          });

          // Clean up session if empty after 5 minutes
          if (session.activeUsers.size === 0) {
            this.flushDocumentSave(currentDocId);
          }
        }
      };

      socket.on('leave-document', handleDisconnect);
      socket.on('disconnect', handleDisconnect);
    });
  }

  /**
   * Retrieves or initializes a Yjs document session from database
   */
  public async getOrCreateSession(documentId: string): Promise<DocumentSession> {
    let session = this.sessions.get(documentId);
    if (session) return session;

    const ydoc = new Y.Doc();
    session = {
      doc: ydoc,
      activeUsers: new Map(),
      blockLocks: new Map(),
      saveTimeout: null,
    };
    this.sessions.set(documentId, session);

    // Populate Yjs doc from MongoDB
    try {
      const docRecord = await DocumentModel.findById(documentId);
      if (docRecord && docRecord.root) {
        const yNodesArray = ydoc.getArray<ASTNode>('nodes');
        const yMetaMap = ydoc.getMap<unknown>('meta');

        ydoc.transact(() => {
          yMetaMap.set('title', docRecord.title);
          yMetaMap.set('version', docRecord.version);
          yMetaMap.set('id', docRecord.root.id);

          // Clear and insert children
          yNodesArray.delete(0, yNodesArray.length);
          if (docRecord.root.children && docRecord.root.children.length > 0) {
            yNodesArray.push(docRecord.root.children);
          }
        });
      }
    } catch (err) {
      console.warn(`[WebSocket] Could not load initial state for document '${documentId}':`, err);
    }

    return session;
  }

  /**
   * Debounces saving active Yjs state back to MongoDB
   */
  private scheduleDocumentSave(documentId: string): void {
    const session = this.sessions.get(documentId);
    if (!session) return;

    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
    }

    session.saveTimeout = setTimeout(() => {
      this.flushDocumentSave(documentId);
    }, 2000);
  }

  /**
   * Flushes and persists current Yjs state to MongoDB
   */
  public async flushDocumentSave(documentId: string): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) return;

    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
      session.saveTimeout = null;
    }

    try {
      const yNodesArray = session.doc.getArray<ASTNode>('nodes');
      const yMetaMap = session.doc.getMap<unknown>('meta');

      const title = (yMetaMap.get('title') as string) || 'Untitled Document';
      const rootId = (yMetaMap.get('id') as string) || `doc_${documentId}`;
      const currentVersion = (yMetaMap.get('version') as number) || 1;
      const nextVersion = currentVersion + 1;
      yMetaMap.set('version', nextVersion);

      const childrenNodes = yNodesArray.toArray();

      const rootAST: DocumentNode = {
        id: rootId,
        type: 'document',
        title,
        version: nextVersion,
        parentId: null,
        children: childrenNodes,
        order: 0,
        metadata: { updatedAt: Date.now() },
      };

      const updated = await DocumentModel.findByIdAndUpdate(
        documentId,
        {
          title,
          version: nextVersion,
          root: rootAST,
        },
        { new: true, runValidators: true }
      );

      if (updated) {
        // Create automatic version history snapshot
        await DocumentVersionModel.create({
          documentId,
          versionNumber: nextVersion,
          astSnapshot: rootAST,
          author: 'Collaborative Sync',
          changeDescription: `Version ${nextVersion} saved via real-time collaboration`,
          nodeCount: childrenNodes.length + 1,
        });

        console.log(`[WebSocket] Auto-saved document '${documentId}' (version ${nextVersion})`);
      }
    } catch (err) {
      console.error(`[WebSocket] Error persisting document '${documentId}':`, err);
    }
  }

  public getSession(documentId: string): DocumentSession | undefined {
    return this.sessions.get(documentId);
  }
}
