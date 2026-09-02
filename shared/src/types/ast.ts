export type ASTNodeType =
  | 'document'
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'code_block'
  | 'list'
  | 'list_item'
  | 'blockquote'
  | 'divider';

export type TextMark = 'bold' | 'italic' | 'code' | 'underline' | 'strikethrough';

export type ListType = 'bullet' | 'ordered' | 'task';

export interface BaseNode {
  id: string;
  type: ASTNodeType;
  parentId: string | null;
  children: ASTNode[];
  order: number;
  metadata?: {
    author?: string;
    createdAt?: number;
    updatedAt?: number;
    lastEditedBy?: string;
    [key: string]: unknown;
  };
}

export interface DocumentNode extends BaseNode {
  type: 'document';
  parentId: null;
  title: string;
  version: number;
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  content: string;
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  marks?: TextMark[];
}

export interface CodeBlockNode extends BaseNode {
  type: 'code_block';
  language: string;
  content: string;
}

export interface ListNode extends BaseNode {
  type: 'list';
  listType: ListType;
  children: ListItemNode[];
}

export interface ListItemNode extends BaseNode {
  type: 'list_item';
  content: string;
  checked?: boolean;
}

export interface BlockquoteNode extends BaseNode {
  type: 'blockquote';
  content: string;
}

export interface DividerNode extends BaseNode {
  type: 'divider';
  content?: string;
}

export type ASTNode =
  | DocumentNode
  | HeadingNode
  | ParagraphNode
  | TextNode
  | CodeBlockNode
  | ListNode
  | ListItemNode
  | BlockquoteNode
  | DividerNode;

export interface DocumentMetadata {
  id: string;
  title: string;
  ownerId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
  activeCollaboratorsCount?: number;
}
