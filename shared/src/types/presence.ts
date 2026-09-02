export type EditingState = 'viewing' | 'editing' | 'idle';

export interface CursorPosition {
  line?: number;
  ch?: number;
  offset?: number;
}

export interface SelectionRange {
  start: number;
  end: number;
}

export interface UserPresence {
  clientId: string;
  userId: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  activeBlockId: string | null;
  editingState: EditingState;
  cursorPosition?: CursorPosition;
  selectionRange?: SelectionRange;
  lastActive: number;
}

export interface BlockLockState {
  blockId: string;
  lockedBy: string;
  lockedByName: string;
  userColor: string;
  lockedAt: number;
  isLocked: boolean;
}

export interface DocumentVersionInfo {
  id: string;
  documentId: string;
  versionNumber: number;
  author: string;
  changeDescription: string;
  createdAt: string;
  nodeCount: number;
}

export interface WebSocketEvents {
  // Client to Server
  'join-document': { documentId: string; user: Omit<UserPresence, 'lastActive'> };
  'leave-document': { documentId: string; clientId: string };
  'presence-update': { documentId: string; presence: Partial<UserPresence> };
  'block-focus': { documentId: string; blockId: string | null; editingState: EditingState };
  'yjs-update': { documentId: string; update: Uint8Array | number[] };
  'request-sync': { documentId: string };
  'save-snapshot': { documentId: string; changeDescription?: string; author?: string };

  // Server to Client
  'document-state': { documentId: string; update: number[]; version: number };
  'yjs-sync': { documentId: string; update: number[] };
  'presence-sync': { documentId: string; users: UserPresence[] };
  'user-joined': { documentId: string; user: UserPresence };
  'user-left': { documentId: string; clientId: string; userName: string };
  'block-state-sync': { documentId: string; locks: Record<string, BlockLockState> };
  'conflict-detected': { documentId: string; conflict: unknown };
  'version-created': { documentId: string; version: DocumentVersionInfo };
}
