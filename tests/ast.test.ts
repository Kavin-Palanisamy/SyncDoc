import { describe, it, expect } from 'vitest';
import {
  createDocumentAST,
  createNode,
  findNodeById,
  findParentNode,
  flattenAST,
  cloneAST,
  reorderChildren,
  countNodes,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  ListNode,
} from '../shared/src/index.js';

describe('AST Modeling & Traversal Helpers', () => {
  it('should create a valid default Document AST', () => {
    const doc = createDocumentAST('System Architecture Spec');
    expect(doc.type).toBe('document');
    expect(doc.title).toBe('System Architecture Spec');
    expect(doc.parentId).toBeNull();
    expect(doc.children.length).toBe(2);
    expect(doc.children[0]?.type).toBe('heading');
    expect((doc.children[0] as HeadingNode).level).toBe(1);
    expect(doc.children[1]?.type).toBe('paragraph');
  });

  it('should create various concrete structural nodes with stable IDs', () => {
    const heading = createNode('heading', 'doc_1', 0, { content: 'Intro', level: 2 }) as HeadingNode;
    expect(heading.id).toBeDefined();
    expect(heading.type).toBe('heading');
    expect(heading.level).toBe(2);
    expect(heading.content).toBe('Intro');

    const code = createNode('code_block', 'doc_1', 1, {
      content: 'console.log("hello");',
      language: 'typescript',
    }) as CodeBlockNode;
    expect(code.type).toBe('code_block');
    expect(code.language).toBe('typescript');

    const list = createNode('list', 'doc_1', 2, { listType: 'task' }) as ListNode;
    expect(list.type).toBe('list');
    expect(list.listType).toBe('task');
  });

  it('should accurately find node by ID and find parent node', () => {
    const doc = createDocumentAST('Lookup Test');
    const targetChild = doc.children[1]!;
    
    const found = findNodeById(doc, targetChild.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(targetChild.id);

    const parent = findParentNode(doc, targetChild.id);
    expect(parent).not.toBeNull();
    expect(parent?.id).toBe(doc.id);
  });

  it('should flatten and count total nodes in AST tree', () => {
    const doc = createDocumentAST('Count Test');
    const flat = flattenAST(doc);
    expect(flat.length).toBe(3); // document root + heading + paragraph
    expect(countNodes(doc)).toBe(3);
  });

  it('should deep clone AST without sharing references', () => {
    const original = createDocumentAST('Original');
    const cloned = cloneAST(original);

    expect(cloned).toEqual(original);
    (cloned.children[0] as HeadingNode).content = 'Modified In Clone';
    expect((original.children[0] as HeadingNode).content).not.toBe('Modified In Clone');
  });

  it('should reorder children and synchronize index orders', () => {
    const doc = createDocumentAST('Reorder Test');
    const child0 = doc.children[0]!;
    const child1 = doc.children[1]!;

    // Reverse order
    child0.order = 10;
    child1.order = 2;
    reorderChildren(doc);

    expect(doc.children[0]?.id).toBe(child1.id);
    expect(doc.children[0]?.order).toBe(0);
    expect(doc.children[1]?.id).toBe(child0.id);
    expect(doc.children[1]?.order).toBe(1);
  });
});
