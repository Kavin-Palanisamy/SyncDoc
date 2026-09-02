import { describe, it, expect } from 'vitest';
import { ConflictResolutionEngine } from '../server/src/conflict/ConflictResolutionEngine.js';
import {
  createDocumentAST,
  createNode,
  cloneAST,
  ASTOperation,
  HeadingNode,
  ParagraphNode,
} from '../shared/src/index.js';

describe('Conflict Resolution Engine & AST Operations', () => {
  it('CASE 1: should auto-merge independent modifications on different nodes', () => {
    const baseDoc = createDocumentAST('Base Spec');
    const headingId = baseDoc.children[0]!.id;
    const paragraphId = baseDoc.children[1]!.id;

    // User A edits heading
    const opA: ASTOperation = {
      id: 'op_a',
      type: 'UPDATE_CONTENT',
      nodeId: headingId,
      newValue: 'User A Modified Heading',
      timestamp: 1000,
      clientId: 'client_A',
    };

    // User B edits paragraph
    const opB: ASTOperation = {
      id: 'op_b',
      type: 'UPDATE_CONTENT',
      nodeId: paragraphId,
      newValue: 'User B Modified Paragraph Content',
      timestamp: 1005,
      clientId: 'client_B',
    };

    const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opA], [opB]);

    expect(mergeResult.success).toBe(true);
    expect(mergeResult.conflicts.length).toBe(0);

    const mergedHeading = mergeResult.mergedAST.children.find((c) => c.id === headingId) as HeadingNode;
    const mergedParagraph = mergeResult.mergedAST.children.find((c) => c.id === paragraphId) as ParagraphNode;

    expect(mergedHeading.content).toBe('User A Modified Heading');
    expect(mergedParagraph.content).toBe('User B Modified Paragraph Content');
  });

  it('CASE 2: should detect and resolve concurrent edits to the exact same node', () => {
    const baseDoc = createDocumentAST('Base Spec');
    const paragraphId = baseDoc.children[1]!.id;

    const opA: ASTOperation = {
      id: 'op_a2',
      type: 'UPDATE_CONTENT',
      nodeId: paragraphId,
      newValue: 'User A Edit on Paragraph',
      timestamp: 1000,
      clientId: 'client_A',
    };

    const opB: ASTOperation = {
      id: 'op_b2',
      type: 'UPDATE_CONTENT',
      nodeId: paragraphId,
      newValue: 'User B Edit on SAME Paragraph',
      timestamp: 1010,
      clientId: 'client_B',
    };

    const conflict = ConflictResolutionEngine.detectConflict(baseDoc, opA, opB);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictType).toBe('CONCURRENT_SAME_NODE_EDIT');

    const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opA], [opB]);
    expect(mergeResult.success).toBe(true);
    expect(mergeResult.conflicts.length).toBe(1);

    const mergedNode = mergeResult.mergedAST.children.find((c) => c.id === paragraphId) as ParagraphNode;
    expect(mergedNode.content).toBe('User B Edit on SAME Paragraph');
  });

  it('CASE 3: should handle concurrent structural insertions (Paragraph + CodeBlock) preserving both', () => {
    const baseDoc = createDocumentAST('Concurrent Insertions');

    // User A inserts a Paragraph at index 2
    const newParagraph = createNode('paragraph', baseDoc.id, 2, { content: 'User A New Section' });
    const opInsertA: ASTOperation = {
      id: 'op_ins_a',
      type: 'INSERT_NODE',
      nodeId: newParagraph.id,
      targetParentId: baseDoc.id,
      targetIndex: 2,
      nodeData: newParagraph,
      timestamp: 2000,
      clientId: 'client_A',
    };

    // User B inserts a CodeBlock at index 2
    const newCode = createNode('code_block', baseDoc.id, 2, { content: 'const b = 42;', language: 'javascript' });
    const opInsertB: ASTOperation = {
      id: 'op_ins_b',
      type: 'INSERT_NODE',
      nodeId: newCode.id,
      targetParentId: baseDoc.id,
      targetIndex: 2,
      nodeData: newCode,
      timestamp: 2005,
      clientId: 'client_B',
    };

    const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opInsertA], [opInsertB]);
    expect(mergeResult.success).toBe(true);

    // Initial 2 nodes + 2 new inserted nodes = 4 total
    expect(mergeResult.mergedAST.children.length).toBe(4);

    const hasParagraph = mergeResult.mergedAST.children.some((c) => c.id === newParagraph.id);
    const hasCode = mergeResult.mergedAST.children.some((c) => c.id === newCode.id);
    expect(hasParagraph).toBe(true);
    expect(hasCode).toBe(true);
  });

  it('CASE 4: should handle Delete vs Edit conflict with non-destructive preservation', () => {
    const baseDoc = createDocumentAST('Delete vs Edit');
    const targetNodeId = baseDoc.children[1]!.id;

    const opDelete: ASTOperation = {
      id: 'op_del',
      type: 'DELETE_NODE',
      nodeId: targetNodeId,
      timestamp: 3000,
      clientId: 'client_A',
    };

    const opEdit: ASTOperation = {
      id: 'op_edit',
      type: 'UPDATE_CONTENT',
      nodeId: targetNodeId,
      newValue: 'Important content added concurrently with deletion',
      timestamp: 3005,
      clientId: 'client_B',
    };

    const conflict = ConflictResolutionEngine.detectConflict(baseDoc, opDelete, opEdit);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictType).toBe('DELETE_EDIT_CONFLICT');

    const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opDelete], [opEdit]);
    expect(mergeResult.success).toBe(true);

    const preservedNode = mergeResult.mergedAST.children.find((c) => c.id === targetNodeId) as ParagraphNode;
    expect(preservedNode).toBeDefined();
    expect(preservedNode.content).toBe('Important content added concurrently with deletion');
  });

  it('should accurately calculate AST version diffs', () => {
    const v1 = createDocumentAST('Diff Test V1');
    const v2 = cloneAST(v1);

    // Modify child 0
    (v2.children[0] as HeadingNode).content = 'Updated Title Heading';

    // Add new child
    const newChild = createNode('blockquote', v2.id, 2, { content: 'Wise quote' });
    v2.children.push(newChild);

    const diff = ConflictResolutionEngine.compareVersions(v1, v2);
    expect(diff.modified.length).toBe(1);
    expect(diff.added.length).toBe(1);
    expect(diff.deleted.length).toBe(0);
    expect(diff.added[0]?.id).toBe(newChild.id);
  });
});
