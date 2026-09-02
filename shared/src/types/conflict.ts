import { ASTNode, DocumentNode } from './ast.js';

export type OperationType =
  | 'INSERT_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'MOVE_NODE'
  | 'UPDATE_CONTENT'
  | 'SET_METADATA';

export interface ASTOperation {
  id: string;
  type: OperationType;
  nodeId: string;
  targetParentId?: string | null;
  targetIndex?: number;
  nodeData?: Partial<ASTNode>;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: number;
  clientId: string;
}

export type ConflictType =
  | 'CONCURRENT_SAME_NODE_EDIT'
  | 'DELETE_EDIT_CONFLICT'
  | 'STRUCTURAL_REORDER_CONFLICT'
  | 'PARENT_DELETION_ORPHAN'
  | 'ATTRIBUTE_COLLISION';

export type ResolutionStrategy =
  | 'CRDT_MERGE'
  | 'KEEP_LOCAL'
  | 'KEEP_REMOTE'
  | 'FORK_NODES'
  | 'LAST_WRITE_WINS';

export interface ConflictRecord {
  id: string;
  documentId: string;
  nodeId: string;
  conflictType: ConflictType;
  localOperation: ASTOperation;
  remoteOperation: ASTOperation;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionStrategy?: ResolutionStrategy;
  resultingNode?: ASTNode;
  description: string;
}

export interface MergeResult {
  success: boolean;
  mergedAST: DocumentNode;
  conflicts: ConflictRecord[];
  appliedOperations: number;
}

export interface DiffResult {
  added: ASTNode[];
  modified: Array<{ id: string; oldNode: ASTNode; newNode: ASTNode }>;
  deleted: string[];
  reordered: Array<{ id: string; oldOrder: number; newOrder: number }>;
}
