import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  UserPresence,
  BlockLockState,
  ASTNode,
  DocumentNode,
  countNodes,
  cloneAST,
} from '@syncdoc/shared';
import { DocumentModel, validateASTTree } from '../models/Document.js';
import { DocumentVersionModel } from '../models/DocumentVersion.js';
import { ConflictResolutionEngine } from '../conflict/ConflictResolutionEngine.js';
import { ASTCollaborationBridge } from './ASTCollaborationBridge.js';

interface DocumentSession {
  doc: Y.Doc;
  activeUsers: Map<string, UserPresence>; // socketId -> UserPresence
  blockLocks: Map<string, BlockLockState>; // blockId -> BlockLockState
  saveTimeout: NodeJS.Timeout | null;
  isSaving: boolean;
  hasPendingSave: boolean;
  hasUnsavedChanges: boolean;
  changeCount: number;
}

export class WebSocketCollaborationServer {
  private static instance: WebSocketCollaborationServer | null = null;
  private io: SocketIOServer;
  private sessions: Map<string, DocumentSession> = new Map();
  private sessionInitPromises: Map<string, Promise<DocumentSession>> = new Map();

  public static getInstance(): WebSocketCollaborationServer | null {
    return WebSocketCollaborationServer.instance;
  }

  constructor(io: SocketIOServer) {
    this.io = io;
    WebSocketCollaborationServer.instance = this;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      let currentDocId: string | null = null;
      let currentUser: UserPresence | null = null;

      // Join Document Room
      socket.on('join-document', async (data: { documentId: string; user: Omit<UserPresence, 'lastActive'> }) => {
        if (!data || typeof data !== 'object' || !data.documentId) {
          socket.emit('error', { message: 'Invalid join-document request' });
          return;
        }

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

      // Handle Yjs CRDT Updates with Speculative Trial Validation Bridge
      socket.on('yjs-update', async (data: { documentId: string; update: number[] | Uint8Array }) => {
        try {
          if (!data || typeof data !== 'object' || typeof data.documentId !== 'string') {
            socket.emit('error', { message: 'Invalid payload: documentId is required' });
            return;
          }

          const { documentId, update } = data;
          if (!documentId.trim()) {
            socket.emit('error', { message: 'Invalid documentId' });
            return;
          }

          const session = this.sessions.get(documentId);
          if (!session) {
            console.warn(`[WebSocket] Received yjs-update for uninitialized document session '${documentId}' from ${socket.id}`);
            socket.emit('error', { message: `Document session '${documentId}' not initialized. Join first.` });
            return;
          }

          // Safely convert update to Uint8Array
          let updateArray: Uint8Array;
          if (update instanceof Uint8Array) {
            updateArray = update;
          } else if (Array.isArray(update)) {
            updateArray = new Uint8Array(update);
          } else {
            console.warn(`[WebSocket] Malformed update format received from ${socket.id} for document '${documentId}'`);
            socket.emit('error', { message: 'Malformed update: expected byte array or Uint8Array' });
            return;
          }

          if (updateArray.byteLength === 0) {
            return;
          }

          // 1. Create isolated temporary Y.Doc copying current session state for candidate validation
          let trialDoc: Y.Doc | null = null;
          try {
            trialDoc = ASTCollaborationBridge.createTrialDoc(session.doc);
            // Apply candidate update ONLY to the temporary trial doc
            Y.applyUpdate(trialDoc, updateArray);
          } catch (crdtErr) {
            if (trialDoc) trialDoc.destroy();
            console.error(`[WebSocket] Corrupted CRDT update rejected for document '${documentId}':`, crdtErr);
            socket.emit('error', { message: 'Failed to process Yjs update: corrupted CRDT delta' });
            return;
          }

          // 2. Extract candidate AST from trial doc and snapshot current pre-AST
          const preAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, documentId);
          const candidateAST = ASTCollaborationBridge.extractCanonicalAST(trialDoc, documentId);

          // 3. Analyze candidate transition: validate AST tree integrity and compute structural diff
          const analysis = ASTCollaborationBridge.analyzeTransition(preAST, candidateAST);

          // Always dispose the temporary trial doc immediately
          trialDoc.destroy();

          // 4. If candidate AST is invalid: reject update, do NOT modify session.doc, do NOT broadcast, do NOT save
          if (!analysis.isValid) {
            console.warn(
              `[AST Analysis] Update rejected for document '${documentId}': produced invalid AST: ${analysis.validationError}`
            );
            socket.emit('ast-warning', {
              documentId,
              message: 'Update rejected: produced an invalid AST structure. Live session was not modified.',
              error: analysis.validationError,
            });
            return;
          }

          // 5. Candidate is valid: apply update to the live session Y.Doc
          Y.applyUpdate(session.doc, updateArray, socket.id);
          session.changeCount++;
          session.hasUnsavedChanges = true;

          if (analysis.hasStructuralChanges) {
            console.log(
              `[AST Analysis] Document '${documentId}' structural delta: +${analysis.summary.addedCount} added, ~${analysis.summary.modifiedCount} modified, -${analysis.summary.deletedCount} deleted, ^${analysis.summary.reorderedCount} reordered.`
            );
          }

          // 6. Broadcast converged binary update to all other clients in the document room
          socket.to(`doc:${documentId}`).emit('yjs-sync', {
            documentId,
            update: Array.from(updateArray),
          });

          // 7. Schedule debounced database save
          this.scheduleDocumentSave(documentId);
        } catch (err) {
          console.error(`[WebSocket] Unexpected error processing yjs-update from ${socket.id}:`, err);
          socket.emit('error', { message: 'Internal server error while processing update' });
        }
      });

      // Handle Presence Updates (cursor position, selection)
      socket.on('presence-update', (data: { documentId: string; presence: Partial<UserPresence> }) => {
        if (!data || !data.documentId || !data.presence) return;
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
        if (!data || !data.documentId) return;
        const { documentId, blockId, editingState } = data;
        const session = this.sessions.get(documentId);
        if (!session || !currentUser) return;

        // Check if requested block is already locked by another socket
        if (blockId && editingState === 'editing') {
          const existingLock = session.blockLocks.get(blockId);
          if (existingLock && existingLock.isLocked && existingLock.lockedBy !== socket.id) {
            console.log(
              `[WebSocket] Lock rejected: block '${blockId}' already locked by socket '${existingLock.lockedBy}' (${existingLock.lockedByName}). Rejected request from '${socket.id}' (${currentUser.userName}).`
            );
            const locksRecord: Record<string, BlockLockState> = {};
            for (const [bId, lock] of session.blockLocks.entries()) {
              locksRecord[bId] = lock;
            }
            socket.emit('block-state-sync', {
              documentId,
              locks: locksRecord,
            });
            return;
          }
        }

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

      // Disconnect or Leave (Idempotent cleanup)
      const handleDisconnect = () => {
        if (!currentDocId) return;

        const docIdToClean = currentDocId;
        currentDocId = null;
        const userToClean = currentUser;
        currentUser = null;

        const session = this.sessions.get(docIdToClean);
        if (session) {
          // Release block locks held by disconnecting user
          for (const [bId, lock] of session.blockLocks.entries()) {
            if (lock.lockedBy === socket.id) {
              session.blockLocks.delete(bId);
            }
          }

          session.activeUsers.delete(socket.id);

          const roomName = `doc:${docIdToClean}`;
          if (userToClean) {
            this.io.to(roomName).emit('user-left', {
              documentId: docIdToClean,
              clientId: socket.id,
              userName: userToClean.userName,
            });
          }

          const locksRecord: Record<string, BlockLockState> = {};
          for (const [bId, lock] of session.blockLocks.entries()) {
            locksRecord[bId] = lock;
          }
          this.io.to(roomName).emit('block-state-sync', {
            documentId: docIdToClean,
            locks: locksRecord,
          });

          this.io.to(roomName).emit('presence-sync', {
            documentId: docIdToClean,
            users: Array.from(session.activeUsers.values()),
          });

          // Flush document save immediately when all users leave the session
          if (session.activeUsers.size === 0) {
            this.flushDocumentSave(docIdToClean);
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
    const existing = this.sessions.get(documentId);
    if (existing) return existing;

    const inFlight = this.sessionInitPromises.get(documentId);
    if (inFlight) return inFlight;

    const initPromise = (async () => {
      try {
        const ydoc = new Y.Doc();
        const session: DocumentSession = {
          doc: ydoc,
          activeUsers: new Map(),
          blockLocks: new Map(),
          saveTimeout: null,
          isSaving: false,
          hasPendingSave: false,
          hasUnsavedChanges: false,
          changeCount: 0,
        };

        // Populate Yjs doc from MongoDB BEFORE publishing session
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

        this.sessions.set(documentId, session);
        return session;
      } finally {
        this.sessionInitPromises.delete(documentId);
      }
    })();

    this.sessionInitPromises.set(documentId, initPromise);
    return initPromise;
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
   * Flushes and persists current Yjs state to MongoDB with concurrency guard,
   * monotonic version tracking, and strict AST validation.
   */
  public async flushDocumentSave(documentId: string): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) return;

    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
      session.saveTimeout = null;
    }

    // Do not save if there are no unsaved changes
    if (!session.hasUnsavedChanges) {
      if (session.activeUsers.size === 0 && !session.isSaving && !session.hasPendingSave) {
        this.cleanupSession(documentId);
      }
      return;
    }

    // Concurrent save mutex: queue pending save if currently persisting
    if (session.isSaving) {
      session.hasPendingSave = true;
      return;
    }

    const savedChangeCount = session.changeCount;
    session.isSaving = true;

    try {
      // 1. Extract canonical AST from current Y.Doc state
      const rootAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, documentId);

      // 2. Validate AST tree integrity prior to database write
      validateASTTree(rootAST);

      // 3. Guarantee strictly monotonic version numbering and prevent redundant writes
      const existingDoc = await DocumentModel.findById(documentId).select('version title root').lean();
      if (!existingDoc) {
        console.warn(`[WebSocket] Document '${documentId}' not found in database for auto-save.`);
        return;
      }

      // Check if AST has actual content/structural changes compared to DB
      if (existingDoc.root) {
        const diff = ConflictResolutionEngine.compareVersions(existingDoc.root, rootAST);
        const hasContentChange =
          diff.added.length > 0 ||
          diff.modified.length > 0 ||
          diff.deleted.length > 0 ||
          diff.reordered.length > 0;

        const titleChanged = existingDoc.title !== rootAST.title;

        if (!hasContentChange && !titleChanged) {
          if (session.changeCount === savedChangeCount) {
            session.hasUnsavedChanges = false;
          }
          if (session.activeUsers.size === 0 && !session.hasUnsavedChanges) {
            this.cleanupSession(documentId);
          }
          return;
        }
      }

      const latestVersionRecord = await DocumentVersionModel.findOne({ documentId })
        .sort({ versionNumber: -1 })
        .select('versionNumber')
        .lean();

      const maxExistingVersion = Math.max(
        existingDoc.version || 1,
        latestVersionRecord?.versionNumber || 1
      );

      const nextVersion = maxExistingVersion + 1;

      const yMetaMap = session.doc.getMap<unknown>('meta');
      yMetaMap.set('version', nextVersion);
      rootAST.version = nextVersion;

      const title = (yMetaMap.get('title') as string) || existingDoc.title || 'Untitled Document';
      rootAST.title = title;

      // 4. Atomic update of document root and version in MongoDB
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
        // 5. Create automatic version snapshot with recursive node count
        await DocumentVersionModel.create({
          documentId,
          versionNumber: nextVersion,
          astSnapshot: rootAST,
          author: 'Collaborative Sync',
          changeDescription: `Version ${nextVersion} saved via real-time collaboration`,
          nodeCount: countNodes(rootAST),
        });

        if (session.changeCount === savedChangeCount) {
          session.hasUnsavedChanges = false;
        } else {
          session.hasUnsavedChanges = true;
          session.hasPendingSave = true;
        }
        console.log(`[WebSocket] Auto-saved document '${documentId}' (version ${nextVersion})`);
      }
    } catch (err) {
      console.error(`[WebSocket] Error persisting document '${documentId}':`, err);
    } finally {
      session.isSaving = false;
      if (session.hasPendingSave || (session.hasUnsavedChanges && session.changeCount > savedChangeCount)) {
        session.hasPendingSave = false;
        if (session.activeUsers.size === 0) {
          this.flushDocumentSave(documentId);
        } else {
          this.scheduleDocumentSave(documentId);
        }
      } else if (session.activeUsers.size === 0 && !session.hasUnsavedChanges) {
        this.cleanupSession(documentId);
      }
    }
  }

  /**
   * Cleans up an idle document session when no active users remain
   * and all pending persistence tasks have finished cleanly.
   */
  public cleanupSession(documentId: string): boolean {
    const session = this.sessions.get(documentId);
    if (!session) return false;

    // Mutex & safety check: do not evict if users are active or persistence is incomplete
    if (session.activeUsers.size > 0 || session.isSaving || session.hasUnsavedChanges || session.hasPendingSave) {
      return false;
    }

    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
      session.saveTimeout = null;
    }

    session.doc.destroy();
    this.sessions.delete(documentId);
    console.log(`[WebSocket] Session for document '${documentId}' cleaned up successfully.`);
    return true;
  }

  /**
   * Returns current count of active in-memory document sessions
   */
  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Synchronizes an active in-memory Yjs session with an externally persisted AST
   * (e.g. from REST API updates, title changes, or rollback).
   * Applies changes to the live Y.Doc and broadcasts the binary update to all
   * connected collaborators in the document room via the existing 'yjs-sync' event.
   */
  public syncSessionFromExternal(
    documentId: string,
    root: DocumentNode,
    title?: string,
    version?: number
  ): boolean {
    const session = this.sessions.get(documentId);
    if (!session) return false;

    const yNodesArray = session.doc.getArray<ASTNode>('nodes');
    const yMetaMap = session.doc.getMap<unknown>('meta');

    const captured = { delta: null as Uint8Array | null };
    const updateHandler = (update: Uint8Array) => {
      captured.delta = update;
    };
    session.doc.on('update', updateHandler);

    try {
      session.doc.transact(() => {
        if (title !== undefined) {
          yMetaMap.set('title', title);
        } else if (root.title) {
          yMetaMap.set('title', root.title);
        }
        if (typeof version === 'number') {
          yMetaMap.set('version', version);
        } else if (typeof root.version === 'number') {
          yMetaMap.set('version', root.version);
        }
        if (root.id) {
          yMetaMap.set('id', root.id);
        }

        // Replace nodes with deep cloned children to prevent reference contamination
        yNodesArray.delete(0, yNodesArray.length);
        if (root.children && root.children.length > 0) {
          yNodesArray.insert(
            0,
            root.children.map((c) => cloneAST(c))
          );
        }
      });
    } finally {
      session.doc.off('update', updateHandler);
    }

    // Cancel pending saves since DB is already updated with this version
    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
      session.saveTimeout = null;
    }
    session.hasUnsavedChanges = false;
    session.hasPendingSave = false;

    // Broadcast the update to all connected clients in the document room via existing 'yjs-sync' event
    const broadcastUpdate: Uint8Array =
      captured.delta && captured.delta.byteLength > 0
        ? captured.delta
        : Y.encodeStateAsUpdate(session.doc);

    this.io.to(`doc:${documentId}`).emit('yjs-sync', {
      documentId,
      update: Array.from(broadcastUpdate),
    });

    console.log(
      `[WebSocket] Synchronized active Yjs session for document '${documentId}' from external update (v${version ?? root.version}).`
    );
    return true;
  }

  /**
   * Completely destroys all document sessions, clears all timers, and frees Y.Docs
   */
  public destroy(): void {
    if (WebSocketCollaborationServer.instance === this) {
      WebSocketCollaborationServer.instance = null;
    }
    for (const session of this.sessions.values()) {
      if (session.saveTimeout) {
        clearTimeout(session.saveTimeout);
        session.saveTimeout = null;
      }
      session.doc.destroy();
    }
    this.sessions.clear();
  }

  public getSession(documentId: string): DocumentSession | undefined {
    return this.sessions.get(documentId);
  }
}
