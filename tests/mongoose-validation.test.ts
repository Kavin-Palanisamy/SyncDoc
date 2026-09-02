import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DocumentModel, validateASTTree } from '../server/src/models/Document.js';
import { createDocumentAST, createNode, HeadingNode, ListNode, ListItemNode } from '../shared/src/index.js';

describe('Recursive Mongoose Pre-Save AST Validation', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should validate and save a well-formed Document AST', async () => {
    const root = createDocumentAST('Valid Spec');
    const doc = new DocumentModel({
      title: 'Valid Spec',
      root,
      version: 1,
    });

    const saved = await doc.save();
    expect(saved._id).toBeDefined();
    expect(saved.title).toBe('Valid Spec');
    expect(saved.root.children.length).toBe(2);
  });

  it('should reject an AST where root is not type "document"', () => {
    const invalidRoot = createNode('paragraph', null, 0, { content: 'Invalid Root' });
    expect(() => validateASTTree(invalidRoot)).toThrow(/Root node must be of type 'document'/);
  });

  it('should reject an AST where root has non-null parentId', () => {
    const root = createDocumentAST('Invalid Parent Root');
    // @ts-expect-error - testing invalid mutation
    root.parentId = 'some_parent';
    expect(() => validateASTTree(root)).toThrow(/Root node must have parentId null/);
  });

  it('should reject duplicate node IDs in the document tree', () => {
    const root = createDocumentAST('Duplicate ID Test');
    const duplicateId = root.children[0]!.id;
    // Set child 1 ID to match child 0 ID
    root.children[1]!.id = duplicateId;

    expect(() => validateASTTree(root)).toThrow(/Duplicate node ID/);
  });

  it('should reject invalid parent-child relationship references', () => {
    const root = createDocumentAST('Parent Mismatch Test');
    // Child claims its parent is 'wrong_parent_id'
    root.children[0]!.parentId = 'wrong_parent_id';

    expect(() => validateASTTree(root)).toThrow(/Invalid parent relationship for node/);
  });

  it('should reject circular references in the AST tree', () => {
    const root = createDocumentAST('Circular Test');
    const nodeA = root.children[0]!;
    const nodeB = root.children[1]!;

    // Create artificial circular reference: root -> nodeA -> nodeB -> nodeA
    nodeA.children = [nodeB];
    nodeB.parentId = nodeA.id;
    nodeB.children = [nodeA]; // circular cycle

    expect(() => validateASTTree(root)).toThrow(/Circular reference detected in AST/);
  });

  it('should reject illegal nesting (e.g. list_item directly under document or invalid heading level)', () => {
    const root = createDocumentAST('Illegal Nesting Test');
    const orphanListItem: ListItemNode = {
      id: 'li_illegal',
      type: 'list_item',
      content: 'I should be inside a list',
      parentId: root.id,
      children: [],
      order: 2,
    };
    root.children.push(orphanListItem);

    expect(() => validateASTTree(root)).toThrow(/'list_item' node 'li_illegal' must be a child of a 'list' node/);
  });

  it('should reject invalid heading level outside 1-6', () => {
    const root = createDocumentAST('Invalid Heading Level Test');
    const badHeading = root.children[0] as HeadingNode;
    // @ts-expect-error - testing invalid level
    badHeading.level = 9;

    expect(() => validateASTTree(root)).toThrow(/must have a level between 1 and 6/);
  });
});
