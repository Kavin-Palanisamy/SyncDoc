import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import {
  ASTNode,
  ASTNodeType,
  BaseNode,
  DocumentNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
} from '@syncdoc/shared';

const ALLOWED_NODE_TYPES: ASTNodeType[] = [
  'document',
  'heading',
  'paragraph',
  'text',
  'code_block',
  'list',
  'list_item',
  'blockquote',
  'divider',
];

const ASTNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ALLOWED_NODE_TYPES,
    },
    parentId: { type: String, default: null },
    order: { type: Number, default: 0 },
    content: { type: String, default: '' },
    level: { type: Number, min: 1, max: 6 },
    language: { type: String, default: 'typescript' },
    listType: { type: String, enum: ['bullet', 'ordered', 'task'], default: 'bullet' },
    checked: { type: Boolean, default: false },
    metadata: { type: Map, of: Schema.Types.Mixed, default: () => ({}) },
    children: [Schema.Types.Mixed],
  },
  { _id: false }
);

export interface IDocumentModel extends MongooseDocument {
  title: string;
  ownerId: string;
  version: number;
  root: DocumentNode;
  activeCollaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentModel>(
  {
    title: { type: String, required: true, trim: true },
    ownerId: { type: String, default: 'anonymous' },
    version: { type: Number, default: 1, min: 1 },
    root: { type: ASTNodeSchema, required: true },
    activeCollaborators: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ updatedAt: -1 });
DocumentSchema.index({ ownerId: 1 });
DocumentSchema.index({ 'root.id': 1 });

/**
 * Recursive validation function for AST tree integrity
 */
export function validateASTTree(root: ASTNode): void {
  if (!root) {
    throw new Error('AST root cannot be null or undefined.');
  }

  if (typeof root !== 'object') {
    throw new Error('AST root must be a valid object.');
  }

  if (root.type !== 'document') {
    throw new Error(`Root node must be of type 'document', received '${root.type}'.`);
  }

  if ((root as BaseNode).parentId !== null) {
    throw new Error(`Root node must have parentId null, received '${(root as BaseNode).parentId}'.`);
  }

  const docRoot = root as DocumentNode;

  if (docRoot.title !== undefined && typeof docRoot.title !== 'string') {
    throw new Error("Root document node must have a valid string 'title'.");
  }

  if (
    docRoot.version !== undefined &&
    (typeof docRoot.version !== 'number' || isNaN(docRoot.version) || docRoot.version < 1)
  ) {
    throw new Error("Root document node must have a positive integer 'version'.");
  }

  if (docRoot.children === undefined || !Array.isArray(docRoot.children)) {
    throw new Error("Root document node has invalid children: must have a 'children' array.");
  }

  const seenIds = new Set<string>();
  const activePath = new Set<string>();

  function traverseAndValidate(node: ASTNode, expectedParentId: string | null, parentNode: ASTNode | null): void {
    if (!node || typeof node !== 'object') {
      throw new Error('Encountered malformed node in AST.');
    }

    if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
      throw new Error(`Node of type '${node.type}' is missing a valid stable ID.`);
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(node.id)) {
      throw new Error(`Node ID '${node.id}' contains invalid characters.`);
    }

    if (activePath.has(node.id)) {
      throw new Error(`Circular reference detected in AST at node ID '${node.id}'.`);
    }

    if (seenIds.has(node.id)) {
      throw new Error(`Duplicate node ID '${node.id}' detected in document tree.`);
    }

    seenIds.add(node.id);
    activePath.add(node.id);

    if (!ALLOWED_NODE_TYPES.includes(node.type)) {
      throw new Error(`Invalid node type '${node.type}' for node ID '${node.id}'.`);
    }

    if (node.parentId !== expectedParentId) {
      throw new Error(
        `Invalid parent relationship for node '${node.id}'. Expected parentId '${expectedParentId}', but got '${node.parentId}'.`
      );
    }

    if (typeof node.order !== 'number' || isNaN(node.order) || node.order < 0) {
      throw new Error(`Node '${node.id}' has invalid order '${node.order}'. Order must be a non-negative number.`);
    }

    if (node.type === 'heading') {
      const headingNode = node as { level?: number; content?: unknown };
      if (
        typeof headingNode.level !== 'number' ||
        !Number.isInteger(headingNode.level) ||
        headingNode.level < 1 ||
        headingNode.level > 6
      ) {
        throw new Error(`'heading' node '${node.id}' must have a level between 1 and 6.`);
      }
      if (headingNode.content !== undefined && typeof headingNode.content !== 'string') {
        throw new Error(`'heading' node '${node.id}' content must be a string.`);
      }
    }

    if (node.type === 'paragraph') {
      const pNode = node as { content?: unknown };
      if (pNode.content !== undefined && typeof pNode.content !== 'string') {
        throw new Error(`'paragraph' node '${node.id}' content must be a string.`);
      }
    }

    if (node.type === 'code_block') {
      const cbNode = node as { language?: unknown; content?: unknown };
      if (cbNode.language !== undefined && typeof cbNode.language !== 'string') {
        throw new Error(`'code_block' node '${node.id}' language must be a string.`);
      }
      if (cbNode.content !== undefined && typeof cbNode.content !== 'string') {
        throw new Error(`'code_block' node '${node.id}' content must be a string.`);
      }
    }

    if (node.type === 'list') {
      const listNode = node as ListNode;
      if (listNode.children === undefined || !Array.isArray(listNode.children)) {
        throw new Error(`'list' node '${node.id}' must have a 'children' array.`);
      }
      if (listNode.listType && !['bullet', 'ordered', 'task'].includes(listNode.listType)) {
        throw new Error(
          `'list' node '${node.id}' has invalid listType '${listNode.listType}'. Allowed types: bullet, ordered, task.`
        );
      }
      for (const child of listNode.children) {
        if (!child || typeof child !== 'object' || child.type !== 'list_item') {
          throw new Error(
            `'list' node '${node.id}' can only contain 'list_item' children, found '${child ? (child as any).type : child}'.`
          );
        }
      }
    }

    if (node.type === 'list_item') {
      if (!parentNode || parentNode.type !== 'list') {
        throw new Error(`'list_item' node '${node.id}' must be a child of a 'list' node.`);
      }
      const li = node as ListItemNode;
      if (li.checked !== undefined && typeof li.checked !== 'boolean') {
        throw new Error(`'list_item' node '${node.id}' has invalid checked value. Expected boolean.`);
      }
      if (li.content !== undefined && typeof li.content !== 'string') {
        throw new Error(`'list_item' node '${node.id}' content must be a string.`);
      }
    }

    if (node.type === 'blockquote') {
      const bq = node as BlockquoteNode;
      if (bq.content !== undefined && typeof bq.content !== 'string') {
        throw new Error(`'blockquote' node '${node.id}' content must be a string.`);
      }
    }

    if (node.children !== undefined && !Array.isArray(node.children)) {
      throw new Error(`Node '${node.id}' has invalid children. Expected array, received '${typeof node.children}'.`);
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseAndValidate(child, node.id, node);
      }
    }

    activePath.delete(node.id);
  }

  traverseAndValidate(root, null, null);
}

// Recursive Mongoose pre-save hook
DocumentSchema.pre('save', function (next) {
  try {
    const doc = this as unknown as IDocumentModel;
    if (doc.root) {
      validateASTTree(doc.root as ASTNode);
    }
    next();
  } catch (err) {
    next(err as Error);
  }
});

export const DocumentModel = mongoose.model<IDocumentModel>('Document', DocumentSchema);
