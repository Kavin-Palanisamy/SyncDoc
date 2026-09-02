import {
  ASTNode,
  DocumentNode,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  DividerNode,
  generateNodeId,
} from '@syncdoc/shared';
import { Sanitizer } from './Sanitizer.js';

export class TransformationEngine {
  /**
   * Transforms an AST document tree into sanitized, semantic HTML via DOMPurify
   */
  public static astToHTML(root: ASTNode): string {
    const rawHTML = this.renderNodeToHTML(root);
    return Sanitizer.sanitize(rawHTML);
  }

  private static renderNodeToHTML(node: ASTNode): string {
    if (!node) return '';

    switch (node.type) {
      case 'document': {
        const docNode = node as DocumentNode;
        const childrenHTML = (docNode.children || [])
          .map((child) => this.renderNodeToHTML(child))
          .join('\n');
        return `<article class="syncdoc-document" data-node-id="${docNode.id}">\n${childrenHTML}\n</article>`;
      }

      case 'heading': {
        const h = node as HeadingNode;
        const level = Math.min(Math.max(h.level || 1, 1), 6);
        return `<h${level} class="syncdoc-heading syncdoc-h${level}" data-node-id="${h.id}">${h.content || ''}</h${level}>`;
      }

      case 'paragraph': {
        const p = node as ParagraphNode;
        return `<p class="syncdoc-paragraph" data-node-id="${p.id}">${p.content || ''}</p>`;
      }

      case 'code_block': {
        const cb = node as CodeBlockNode;
        const lang = Sanitizer.escapeText(cb.language || 'text');
        const code = Sanitizer.escapeText(cb.content || '');
        return `<pre class="syncdoc-code-block" data-node-id="${cb.id}"><code class="language-${lang}">${code}</code></pre>`;
      }

      case 'list': {
        const list = node as ListNode;
        const tag = list.listType === 'ordered' ? 'ol' : 'ul';
        const listClass = list.listType === 'task' ? 'syncdoc-task-list' : 'syncdoc-list';
        const items = (list.children || [])
          .map((item) => this.renderNodeToHTML(item))
          .join('\n');
        return `<${tag} class="${listClass}" data-node-id="${list.id}" data-list-type="${list.listType}">\n${items}\n</${tag}>`;
      }

      case 'list_item': {
        const li = node as ListItemNode;
        const text = Sanitizer.escapeText(li.content || '');
        if (li.checked !== undefined) {
          const checkedAttr = li.checked ? 'checked="checked"' : '';
          return `<li class="syncdoc-task-item" data-node-id="${li.id}"><input type="checkbox" disabled="disabled" ${checkedAttr} class="syncdoc-checkbox" /> <span>${text}</span></li>`;
        }
        return `<li class="syncdoc-list-item" data-node-id="${li.id}">${text}</li>`;
      }

      case 'blockquote': {
        const bq = node as BlockquoteNode;
        const text = Sanitizer.escapeText(bq.content || '');
        return `<blockquote class="syncdoc-blockquote" data-node-id="${bq.id}"><p>${text}</p></blockquote>`;
      }

      case 'divider': {
        const div = node as DividerNode;
        return `<hr class="syncdoc-divider" data-node-id="${div.id}" />`;
      }

      default:
        return '';
    }
  }

  /**
   * Converts AST document into clean, standard Markdown
   */
  public static astToMarkdown(root: ASTNode): string {
    const lines: string[] = [];

    const process = (node: ASTNode) => {
      switch (node.type) {
        case 'document': {
          if (node.children) {
            for (const child of node.children) {
              process(child);
            }
          }
          break;
        }

        case 'heading': {
          const h = node as HeadingNode;
          const prefix = '#'.repeat(h.level || 1);
          lines.push(`${prefix} ${h.content || ''}\n`);
          break;
        }

        case 'paragraph': {
          const p = node as ParagraphNode;
          lines.push(`${p.content || ''}\n`);
          break;
        }

        case 'code_block': {
          const cb = node as CodeBlockNode;
          lines.push(`\`\`\`${cb.language || ''}\n${cb.content || ''}\n\`\`\`\n`);
          break;
        }

        case 'list': {
          const list = node as ListNode;
          if (list.children) {
            list.children.forEach((item, idx) => {
              if (list.listType === 'ordered') {
                lines.push(`${idx + 1}. ${item.content || ''}`);
              } else if (list.listType === 'task') {
                const box = item.checked ? '[x]' : '[ ]';
                lines.push(`- ${box} ${item.content || ''}`);
              } else {
                lines.push(`- ${item.content || ''}`);
              }
            });
            lines.push('');
          }
          break;
        }

        case 'blockquote': {
          const bq = node as BlockquoteNode;
          lines.push(`> ${bq.content || ''}\n`);
          break;
        }

        case 'divider': {
          lines.push(`---\n`);
          break;
        }
      }
    };

    process(root);
    return lines.join('\n').trim();
  }

  /**
   * Robust parser converting Markdown input into an AST Document
   */
  public static markdownToAST(markdown: string, title?: string): DocumentNode {
    const docId = generateNodeId('doc');
    const lines = markdown.split(/\r?\n/);
    const children: ASTNode[] = [];
    let detectedTitle = title || 'Imported Document';

    let currentOrder = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;

      if (line.trim() === '') {
        i++;
        continue;
      }

      if (line.trim().startsWith('```')) {
        const lang = line.trim().substring(3).trim() || 'typescript';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
          codeLines.push(lines[i]!);
          i++;
        }
        i++;
        const codeNode: CodeBlockNode = {
          id: generateNodeId('code'),
          type: 'code_block',
          language: lang,
          content: codeLines.join('\n'),
          parentId: docId,
          children: [],
          order: currentOrder++,
          metadata: { createdAt: Date.now() },
        };
        children.push(codeNode);
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch && headingMatch[1] && headingMatch[2]) {
        const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
        const content = headingMatch[2].trim();
        if (children.length === 0 && !title) {
          detectedTitle = content;
        }
        const headingNode: HeadingNode = {
          id: generateNodeId('h'),
          type: 'heading',
          level,
          content,
          parentId: docId,
          children: [],
          order: currentOrder++,
          metadata: { createdAt: Date.now() },
        };
        children.push(headingNode);
        i++;
        continue;
      }

      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        const divNode: DividerNode = {
          id: generateNodeId('div'),
          type: 'divider',
          parentId: docId,
          children: [],
          order: currentOrder++,
          metadata: { createdAt: Date.now() },
        };
        children.push(divNode);
        i++;
        continue;
      }

      if (line.trim().startsWith('>')) {
        const bqLines: string[] = [];
        while (i < lines.length && lines[i]!.trim().startsWith('>')) {
          bqLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
          i++;
        }
        const bqNode: BlockquoteNode = {
          id: generateNodeId('bq'),
          type: 'blockquote',
          content: bqLines.join(' '),
          parentId: docId,
          children: [],
          order: currentOrder++,
          metadata: { createdAt: Date.now() },
        };
        children.push(bqNode);
        continue;
      }

      const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

      if (bulletMatch || orderedMatch) {
        const isOrdered = !!orderedMatch;
        const listId = generateNodeId('list');
        const listItems: ListItemNode[] = [];
        let itemOrder = 0;
        let isTask = false;

        while (i < lines.length) {
          const currentLine = lines[i]!;
          const bMatch = currentLine.match(/^(\s*)[-*+]\s+(.*)$/);
          const oMatch = currentLine.match(/^(\s*)\d+\.\s+(.*)$/);

          if (!bMatch && !oMatch) break;

          const rawText = bMatch ? bMatch[2]! : oMatch![2]!;
          const taskMatch = rawText.match(/^\[([ xX])\]\s+(.*)$/);

          let itemContent = rawText;
          let checked: boolean | undefined = undefined;

          if (taskMatch && taskMatch[1] && taskMatch[2]) {
            isTask = true;
            checked = taskMatch[1].toLowerCase() === 'x';
            itemContent = taskMatch[2];
          }

          const itemNode: ListItemNode = {
            id: generateNodeId('li'),
            type: 'list_item',
            content: itemContent.trim(),
            checked,
            parentId: listId,
            children: [],
            order: itemOrder++,
            metadata: { createdAt: Date.now() },
          };
          listItems.push(itemNode);
          i++;
        }

        const listNode: ListNode = {
          id: listId,
          type: 'list',
          listType: isTask ? 'task' : isOrdered ? 'ordered' : 'bullet',
          children: listItems,
          parentId: docId,
          order: currentOrder++,
          metadata: { createdAt: Date.now() },
        };
        children.push(listNode);
        continue;
      }

      const pNode: ParagraphNode = {
        id: generateNodeId('p'),
        type: 'paragraph',
        content: line.trim(),
        parentId: docId,
        children: [],
        order: currentOrder++,
        metadata: { createdAt: Date.now() },
      };
      children.push(pNode);
      i++;
    }

    return {
      id: docId,
      type: 'document',
      title: detectedTitle,
      version: 1,
      parentId: null,
      children,
      order: 0,
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    };
  }

  /**
   * Generates a complete, styled HTML document optimized for printing / PDF compilation
   */
  public static astToPrintableHTML(root: ASTNode, title: string = 'SyncDoc Document'): string {
    const bodyContent = this.astToHTML(root);
    const escapedTitle = Sanitizer.escapeText(title);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
      --text-main: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --bg-code: #f8fafc;
      --bg-quote: #f1f5f9;
      --accent: #2563eb;
    }

    body {
      font-family: var(--font-sans);
      color: var(--text-main);
      background-color: #ffffff;
      line-height: 1.65;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .syncdoc-document {
      width: 100%;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.25;
    }

    h1 { font-size: 2.25rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; margin-top: 0; }
    h2 { font-size: 1.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25em; }
    h3 { font-size: 1.35rem; }
    h4 { font-size: 1.15rem; }

    p {
      margin: 0.75em 0;
      font-size: 1rem;
    }

    pre.syncdoc-code-block {
      background: var(--bg-code);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.5;
      margin: 1.2em 0;
    }

    code {
      font-family: var(--font-mono);
    }

    blockquote.syncdoc-blockquote {
      border-left: 4px solid var(--accent);
      background: var(--bg-quote);
      margin: 1.2em 0;
      padding: 12px 20px;
      border-radius: 0 8px 8px 0;
      color: var(--text-muted);
      font-style: italic;
    }

    ul, ol {
      padding-left: 24px;
      margin: 0.8em 0;
    }

    li {
      margin: 0.35em 0;
    }

    .syncdoc-task-list {
      list-style: none;
      padding-left: 0;
    }

    .syncdoc-task-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .syncdoc-checkbox {
      width: 16px;
      height: 16px;
      accent-color: var(--accent);
    }

    hr.syncdoc-divider {
      border: none;
      border-top: 2px solid var(--border-color);
      margin: 2em 0;
    }

    @media print {
      body {
        padding: 0;
        max-width: 100%;
      }
      pre.syncdoc-code-block, blockquote.syncdoc-blockquote {
        page-break-inside: avoid;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  }
}
