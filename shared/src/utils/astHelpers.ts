import {
  ASTNode,
  ASTNodeType,
  BaseNode,
  DocumentNode,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  DividerNode,
  ListType,
} from '../types/ast.js';

export function generateNodeId(prefix: string = 'node'): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export function createDocumentAST(title: string = 'Untitled Document', version: number = 1): DocumentNode {
  const docId = generateNodeId('doc');
  const headingId = generateNodeId('h');
  const paragraphId = generateNodeId('p');

  const heading: HeadingNode = {
    id: headingId,
    type: 'heading',
    level: 1,
    content: title,
    parentId: docId,
    children: [],
    order: 0,
    metadata: { createdAt: Date.now() },
  };

  const paragraph: ParagraphNode = {
    id: paragraphId,
    type: 'paragraph',
    content: 'Welcome to SyncDoc. Start collaborating seamlessly in real time!',
    parentId: docId,
    children: [],
    order: 1,
    metadata: { createdAt: Date.now() },
  };

  return {
    id: docId,
    type: 'document',
    title,
    version,
    parentId: null,
    children: [heading, paragraph],
    order: 0,
    metadata: { createdAt: Date.now(), updatedAt: Date.now() },
  };
}

export function createNode(
  type: ASTNodeType,
  parentId: string | null = null,
  order: number = 0,
  options: {
    content?: string;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    language?: string;
    listType?: ListType;
    checked?: boolean;
    metadata?: Record<string, unknown>;
  } = {}
): ASTNode {
  const id = generateNodeId(type.substring(0, 3));
  const base: BaseNode = {
    id,
    type,
    parentId,
    children: [],
    order,
    metadata: { createdAt: Date.now(), updatedAt: Date.now(), ...options.metadata },
  };

  switch (type) {
    case 'document':
      return {
        ...base,
        type: 'document',
        parentId: null,
        title: options.content || 'Untitled Document',
        version: 1,
      } as DocumentNode;

    case 'heading':
      return {
        ...base,
        type: 'heading',
        level: options.level || 1,
        content: options.content || '',
      } as HeadingNode;

    case 'paragraph':
      return {
        ...base,
        type: 'paragraph',
        content: options.content || '',
      } as ParagraphNode;

    case 'code_block':
      return {
        ...base,
        type: 'code_block',
        language: options.language || 'typescript',
        content: options.content || '',
      } as CodeBlockNode;

    case 'list':
      return {
        ...base,
        type: 'list',
        listType: options.listType || 'bullet',
        children: [],
      } as ListNode;

    case 'list_item':
      return {
        ...base,
        type: 'list_item',
        content: options.content || '',
        checked: options.checked ?? false,
      } as ListItemNode;

    case 'blockquote':
      return {
        ...base,
        type: 'blockquote',
        content: options.content || '',
      } as BlockquoteNode;

    case 'divider':
      return {
        ...base,
        type: 'divider',
        content: '',
      } as DividerNode;

    default:
      return {
        ...base,
        type: 'paragraph',
        content: options.content || '',
      } as ParagraphNode;
  }
}

export function findNodeById(root: ASTNode, id: string): ASTNode | null {
  if (root.id === id) return root;
  if (!root.children || root.children.length === 0) return null;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function findParentNode(root: ASTNode, targetId: string): ASTNode | null {
  if (!root.children || root.children.length === 0) return null;

  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

export function traverseAST(root: ASTNode, callback: (node: ASTNode, parent: ASTNode | null, depth: number) => void, parent: ASTNode | null = null, depth: number = 0): void {
  callback(root, parent, depth);
  if (root.children && root.children.length > 0) {
    for (const child of root.children) {
      traverseAST(child, callback, root, depth + 1);
    }
  }
}

export function flattenAST(root: ASTNode): ASTNode[] {
  const result: ASTNode[] = [];
  traverseAST(root, (node) => {
    result.push(node);
  });
  return result;
}

export function cloneAST<T extends ASTNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

export function reorderChildren(parent: ASTNode): void {
  if (!parent.children) return;
  parent.children.sort((a, b) => a.order - b.order);
  parent.children.forEach((child, idx) => {
    child.order = idx;
    child.parentId = parent.id;
  });
}

export function countNodes(root: ASTNode): number {
  let count = 0;
  traverseAST(root, () => {
    count++;
  });
  return count;
}
