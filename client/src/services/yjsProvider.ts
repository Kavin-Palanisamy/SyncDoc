import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';
import { UserPresence, BlockLockState, ASTNode, DocumentNode } from '@syncdoc/shared';

export interface YjsProviderOptions {
  documentId: string;
  user: {
    userId: string;
    userName: string;
    userColor: string;
  };
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected', clientId?: string) => void;
  onPresenceChange?: (users: UserPresence[]) => void;
  onBlockLocksChange?: (locks: Record<string, BlockLockState>) => void;
  onDocChange?: (nodes: ASTNode[], title: string, version: number) => void;
}

export class SyncDocYjsProvider {
  public readonly doc: Y.Doc;
  public readonly yNodes: Y.Array<ASTNode>;
  public readonly yMeta: Y.Map<unknown>;
  private socket: Socket;
  private documentId: string;
  private user: { userId: string; userName: string; userColor: string };
  private isDestroyed = false;

  public get clientId(): string {
    return this.socket.id || '';
  }

  constructor(options: YjsProviderOptions) {
    this.documentId = options.documentId;
    this.user = options.user;
    this.doc = new Y.Doc();
    this.yNodes = this.doc.getArray<ASTNode>('nodes');
    this.yMeta = this.doc.getMap<unknown>('meta');

    // Connect Socket.IO
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.setupListeners(options);
  }

  private setupListeners(options: YjsProviderOptions): void {
    // Socket connection events
    this.socket.on('connect', () => {
      if (this.isDestroyed) {
        this.socket.disconnect();
        return;
      }
      options.onStatusChange?.('connected', this.socket.id);
      // Join document room
      this.socket.emit('join-document', {
        documentId: this.documentId,
        user: {
          clientId: this.socket.id || '',
          userId: this.user.userId,
          userName: this.user.userName,
          userColor: this.user.userColor,
          activeBlockId: null,
          editingState: 'viewing',
        },
      });
    });

    this.socket.on('disconnect', () => {
      options.onStatusChange?.('disconnected', '');
    });

    this.socket.on('connect_error', () => {
      options.onStatusChange?.('disconnected');
    });

    // Remote Yjs update from server
    this.socket.on('yjs-sync', (data: { documentId: string; update: number[] }) => {
      if (data.documentId === this.documentId && !this.isDestroyed) {
        const updateArray = new Uint8Array(data.update);
        Y.applyUpdate(this.doc, updateArray, 'remote');
      }
    });

    // Remote Presence updates
    this.socket.on('presence-sync', (data: { documentId: string; users: UserPresence[] }) => {
      if (data.documentId === this.documentId) {
        options.onPresenceChange?.(data.users);
      }
    });

    // Block Locks updates
    this.socket.on('block-state-sync', (data: { documentId: string; locks: Record<string, BlockLockState> }) => {
      if (data.documentId === this.documentId) {
        options.onBlockLocksChange?.(data.locks);
      }
    });

    // Local Yjs update handler -> Send to server
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote' && origin !== 'local-init' && !this.isDestroyed) {
        this.socket.emit('yjs-update', {
          documentId: this.documentId,
          update: Array.from(update),
        });
      }
    });

    // Listen to changes on yNodes and yMeta to trigger React re-renders
    const handleLocalOrRemoteChange = () => {
      if (!this.isDestroyed) {
        const nodes = this.yNodes.toArray();
        const title = (this.yMeta.get('title') as string) || 'Untitled Document';
        const version = (this.yMeta.get('version') as number) || 1;
        options.onDocChange?.(nodes, title, version);
      }
    };

    this.yNodes.observeDeep(handleLocalOrRemoteChange);
    this.yMeta.observe(handleLocalOrRemoteChange);
  }

  public setBlockFocus(blockId: string | null, editingState: 'editing' | 'viewing' | 'idle'): void {
    if (this.socket.connected && !this.isDestroyed) {
      this.socket.emit('block-focus', {
        documentId: this.documentId,
        blockId,
        editingState,
      });
    }
  }

  public updatePresence(presence: Partial<UserPresence>): void {
    if (this.socket.connected && !this.isDestroyed) {
      this.socket.emit('presence-update', {
        documentId: this.documentId,
        presence,
      });
    }
  }

  public initializeFromInitialAST(root: DocumentNode): void {
    if (this.yNodes.length === 0) {
      this.doc.transact(() => {
        this.yMeta.set('title', root.title);
        this.yMeta.set('version', root.version);
        this.yMeta.set('id', root.id);

        if (root.children && root.children.length > 0) {
          this.yNodes.push(root.children);
        }
      }, 'local-init');
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.socket.connected) {
      this.socket.emit('leave-document', {
        documentId: this.documentId,
        clientId: this.socket.id,
      });
    }
    this.socket.disconnect();
    this.doc.destroy();
  }
}
