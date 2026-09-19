import {
  ASTNode,
  DocumentNode,
  ASTOperation,
  ConflictRecord,
  ResolutionStrategy,
  MergeResult,
  DiffResult,
  cloneAST,
  findNodeById,
  findParentNode,
  generateNodeId,
  reorderChildren,
} from '@syncdoc/shared';

export class ConflictResolutionEngine {
  /**
   * Applies a single AST operation to an AST tree and returns the updated tree
   */
  public static applyOperation(root: DocumentNode, op: ASTOperation): DocumentNode {
    const tree = cloneAST(root);

    switch (op.type) {
      case 'INSERT_NODE': {
        if (!op.nodeData) break;
        const targetParentId = op.targetParentId || tree.id;
        const parent = findNodeById(tree, targetParentId);
        if (!parent) break;

        const newNode = {
          ...op.nodeData,
          id: op.nodeId || op.nodeData.id || generateNodeId('node'),
          parentId: parent.id,
          children: op.nodeData.children || [],
          order: typeof op.targetIndex === 'number' ? op.targetIndex : (parent.children?.length || 0),
        } as ASTNode;

        if (!parent.children) parent.children = [];

        const childrenList = parent.children as ASTNode[];
        if (typeof op.targetIndex === 'number' && op.targetIndex >= 0 && op.targetIndex < childrenList.length) {
          childrenList.splice(op.targetIndex, 0, newNode);
        } else {
          childrenList.push(newNode);
        }

        reorderChildren(parent);
        break;
      }

      case 'UPDATE_NODE':
      case 'UPDATE_CONTENT': {
        const node = findNodeById(tree, op.nodeId);
        if (!node) break;

        if (op.nodeData) {
          Object.assign(node, op.nodeData);
        }
        if (op.newValue !== undefined) {
          if (typeof op.newValue === 'string') {
            (node as { content?: string }).content = op.newValue;
          } else if (typeof op.newValue === 'object' && op.newValue !== null) {
            Object.assign(node, op.newValue);
          }
        }
        if (node.metadata) {
          node.metadata.updatedAt = op.timestamp || Date.now();
          node.metadata.lastEditedBy = op.clientId;
        }
        break;
      }

      case 'DELETE_NODE': {
        const parent = findParentNode(tree, op.nodeId);
        if (parent && parent.children) {
          parent.children = (parent.children as ASTNode[]).filter((child) => child.id !== op.nodeId) as any;
          reorderChildren(parent);
        }
        break;
      }

      case 'MOVE_NODE': {
        const nodeToMove = findNodeById(tree, op.nodeId);
        if (!nodeToMove) break;

        const oldParent = findParentNode(tree, op.nodeId);
        if (oldParent && oldParent.children) {
          oldParent.children = (oldParent.children as ASTNode[]).filter((c) => c.id !== op.nodeId) as any;
          reorderChildren(oldParent);
        }

        const newParentId = op.targetParentId || tree.id;
        const newParent = findNodeById(tree, newParentId);
        if (newParent) {
          if (!newParent.children) newParent.children = [];
          nodeToMove.parentId = newParent.id;
          const targetIndex = typeof op.targetIndex === 'number' ? op.targetIndex : newParent.children.length;
          (newParent.children as ASTNode[]).splice(targetIndex, 0, nodeToMove);
          reorderChildren(newParent);
        }
        break;
      }

      case 'SET_METADATA': {
        const node = findNodeById(tree, op.nodeId);
        if (node && op.newValue && typeof op.newValue === 'object') {
          node.metadata = { ...(node.metadata || {}), ...op.newValue };
        }
        break;
      }
    }

    tree.version = (tree.version || 1) + 1;
    return tree;
  }

  /**
   * Detects conflict between two concurrent operations against a base AST
   */
  public static detectConflict(
    baseTree: DocumentNode,
    opA: ASTOperation,
    opB: ASTOperation
  ): ConflictRecord | null {
    // Independent operations on different nodes
    if (opA.nodeId !== opB.nodeId) {
      // Check if one operation deleted the parent of another node
      if (opA.type === 'DELETE_NODE') {
        const targetParentInB = opB.targetParentId;
        if (targetParentInB === opA.nodeId) {
          return {
            id: generateNodeId('cnf'),
            documentId: baseTree.id,
            nodeId: opB.nodeId,
            conflictType: 'PARENT_DELETION_ORPHAN',
            localOperation: opA,
            remoteOperation: opB,
            resolved: false,
            description: `Operation target parent '${opA.nodeId}' was deleted by another user.`,
          };
        }
      }

      if (opB.type === 'DELETE_NODE') {
        const targetParentInA = opA.targetParentId;
        if (targetParentInA === opB.nodeId) {
          return {
            id: generateNodeId('cnf'),
            documentId: baseTree.id,
            nodeId: opA.nodeId,
            conflictType: 'PARENT_DELETION_ORPHAN',
            localOperation: opA,
            remoteOperation: opB,
            resolved: false,
            description: `Operation target parent '${opB.nodeId}' was deleted by another user.`,
          };
        }
      }

      // Check structural reordering collision at the same index in the same parent
      if (
        opA.type === 'INSERT_NODE' &&
        opB.type === 'INSERT_NODE' &&
        opA.targetParentId === opB.targetParentId &&
        opA.targetIndex !== undefined &&
        opA.targetIndex === opB.targetIndex
      ) {
        return {
          id: generateNodeId('cnf'),
          documentId: baseTree.id,
          nodeId: opA.nodeId,
          conflictType: 'STRUCTURAL_REORDER_CONFLICT',
          localOperation: opA,
          remoteOperation: opB,
          resolved: false,
          description: `Concurrent insertion at position ${opA.targetIndex} under parent '${opA.targetParentId}'.`,
        };
      }

      return null;
    }

    // Same Node touched by both operations
    // Case 1: One deleted, other edited
    if (
      (opA.type === 'DELETE_NODE' && (opB.type === 'UPDATE_NODE' || opB.type === 'UPDATE_CONTENT')) ||
      (opB.type === 'DELETE_NODE' && (opA.type === 'UPDATE_NODE' || opA.type === 'UPDATE_CONTENT'))
    ) {
      return {
        id: generateNodeId('cnf'),
        documentId: baseTree.id,
        nodeId: opA.nodeId,
        conflictType: 'DELETE_EDIT_CONFLICT',
        localOperation: opA,
        remoteOperation: opB,
        resolved: false,
        description: `Node '${opA.nodeId}' was modified by one client and deleted by another.`,
      };
    }

    // Case 2: Concurrent content edits to the exact same node
    if (
      (opA.type === 'UPDATE_CONTENT' || opA.type === 'UPDATE_NODE') &&
      (opB.type === 'UPDATE_CONTENT' || opB.type === 'UPDATE_NODE')
    ) {
      if (opA.newValue !== opB.newValue) {
        return {
          id: generateNodeId('cnf'),
          documentId: baseTree.id,
          nodeId: opA.nodeId,
          conflictType: 'CONCURRENT_SAME_NODE_EDIT',
          localOperation: opA,
          remoteOperation: opB,
          resolved: false,
          description: `Concurrent conflicting edits on node '${opA.nodeId}'.`,
        };
      }
    }

    return null;
  }

  /**
   * Resolves a conflict and directly applies the resolution onto the tree
   */
  public static resolveConflictAndApply(
    tree: DocumentNode,
    conflict: ConflictRecord,
    strategy: ResolutionStrategy = 'CRDT_MERGE'
  ): DocumentNode {
    conflict.resolved = true;
    conflict.resolvedAt = Date.now();
    conflict.resolutionStrategy = strategy;

    let resultTree = cloneAST(tree);

    switch (strategy) {
      case 'KEEP_LOCAL':
        // Local op already applied
        return resultTree;

      case 'KEEP_REMOTE':
        return this.applyOperation(resultTree, conflict.remoteOperation);

      case 'FORK_NODES': {
        const node = findNodeById(resultTree, conflict.nodeId);
        if (node) {
          const parent = findParentNode(resultTree, conflict.nodeId);
          if (parent && parent.children) {
            const localContent = (conflict.localOperation.newValue as string) || (node as { content?: string }).content || '';
            const remoteContent = (conflict.remoteOperation.newValue as string) || '';

            (node as { content?: string }).content = `${localContent} [Version A - ${conflict.localOperation.clientId}]`;

            const forkedNode: ASTNode = {
              ...cloneAST(node),
              id: generateNodeId('fork'),
              order: node.order + 1,
              content: `${remoteContent} [Version B - ${conflict.remoteOperation.clientId}]`,
            } as ASTNode;

            const parentChildren = parent.children as ASTNode[];
            const idx = parentChildren.findIndex((c) => c.id === node.id);
            parentChildren.splice(idx + 1, 0, forkedNode);
            reorderChildren(parent);
          }
        }
        return resultTree;
      }

      case 'CRDT_MERGE':
      default: {
        if (conflict.conflictType === 'CONCURRENT_SAME_NODE_EDIT') {
          const node = findNodeById(resultTree, conflict.nodeId);
          if (node && 'content' in node) {
            const valA = String(conflict.localOperation.newValue ?? '');
            const valB = String(conflict.remoteOperation.newValue ?? '');
            if (conflict.localOperation.timestamp >= conflict.remoteOperation.timestamp) {
              (node as { content: string }).content = valA;
            } else {
              (node as { content: string }).content = valB;
            }
          }
        } else if (conflict.conflictType === 'STRUCTURAL_REORDER_CONFLICT') {
          // Apply remote insert with adjusted index and reorder
          resultTree = this.applyOperation(resultTree, conflict.remoteOperation);
        } else if (conflict.conflictType === 'DELETE_EDIT_CONFLICT') {
          // Non-destructive preservation: if node was deleted by local, restore it with remote edit
          const editOp = conflict.localOperation.type === 'DELETE_NODE' ? conflict.remoteOperation : conflict.localOperation;
          const existingNode = findNodeById(resultTree, editOp.nodeId);
          if (!existingNode) {
            // Re-insert node
            const restoredNode: ASTNode = {
              ...(editOp.nodeData || {}),
              id: editOp.nodeId,
              type: (editOp.nodeData?.type || 'paragraph') as any,
              parentId: editOp.targetParentId || resultTree.id,
              children: [],
              order: resultTree.children.length,
              content: (editOp.newValue as string) || '',
            } as ASTNode;
            resultTree.children.push(restoredNode);
            reorderChildren(resultTree);
          } else {
            resultTree = this.applyOperation(resultTree, editOp);
          }
        }
        return resultTree;
      }
    }
  }

  /**
   * Merges two sets of changes into a base AST
   */
  public static mergeChanges(
    baseTree: DocumentNode,
    localOps: ASTOperation[],
    remoteOps: ASTOperation[]
  ): MergeResult {
    let currentTree = cloneAST(baseTree);
    const conflicts: ConflictRecord[] = [];
    let appliedCount = 0;

    for (const localOp of localOps) {
      for (const remoteOp of remoteOps) {
        const cnf = this.detectConflict(currentTree, localOp, remoteOp);
        if (cnf) {
          conflicts.push(cnf);
        }
      }
    }

    // Apply local operations first
    for (const localOp of localOps) {
      currentTree = this.applyOperation(currentTree, localOp);
      appliedCount++;
    }

    // Apply remote operations or resolve conflicts
    for (const remoteOp of remoteOps) {
      const activeConflict = conflicts.find(
        (c) => c.remoteOperation.id === remoteOp.id || c.nodeId === remoteOp.nodeId
      );

      if (activeConflict) {
        currentTree = this.resolveConflictAndApply(currentTree, activeConflict, 'CRDT_MERGE');
        appliedCount++;
      } else {
        currentTree = this.applyOperation(currentTree, remoteOp);
        appliedCount++;
      }
    }

    return {
      success: true,
      mergedAST: currentTree,
      conflicts,
      appliedOperations: appliedCount,
    };
  }

  /**
   * Compares two AST versions and computes diffs
   */
  public static compareVersions(v1: DocumentNode, v2: DocumentNode): DiffResult {
    const map1 = new Map<string, ASTNode>();
    const map2 = new Map<string, ASTNode>();

    const flatten = (node: ASTNode, map: Map<string, ASTNode>) => {
      map.set(node.id, node);
      if (node.children) {
        for (const child of node.children) {
          flatten(child, map);
        }
      }
    };

    flatten(v1, map1);
    flatten(v2, map2);

    const added: ASTNode[] = [];
    const modified: Array<{ id: string; oldNode: ASTNode; newNode: ASTNode }> = [];
    const deleted: string[] = [];
    const reordered: Array<{ id: string; oldOrder: number; newOrder: number }> = [];

    for (const [id, node2] of map2.entries()) {
      if (!map1.has(id)) {
        added.push(node2);
      } else {
        const node1 = map1.get(id)!;
        if (node1.order !== node2.order) {
          reordered.push({ id, oldOrder: node1.order, newOrder: node2.order });
        }
        const content1 = (node1 as { content?: string }).content ?? '';
        const content2 = (node2 as { content?: string }).content ?? '';
        const contentChanged = content1 !== content2;

        const typeChanged = node1.type !== node2.type;

        const level1 = (node1 as { level?: number }).level ?? 0;
        const level2 = (node2 as { level?: number }).level ?? 0;
        const levelChanged = (node1.type === 'heading' || node2.type === 'heading') && level1 !== level2;

        if (contentChanged || typeChanged || levelChanged) {
          modified.push({ id, oldNode: node1, newNode: node2 });
        }
      }
    }

    for (const id of map1.keys()) {
      if (!map2.has(id)) {
        deleted.push(id);
      }
    }

    return { added, modified, deleted, reordered };
  }
}
