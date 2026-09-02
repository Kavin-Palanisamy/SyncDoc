import { describe, it, expect } from 'vitest';
import { TransformationEngine } from '../server/src/transformation/TransformationEngine.js';
import { Sanitizer } from '../server/src/transformation/Sanitizer.js';
import { createDocumentAST, createNode, HeadingNode, ParagraphNode } from '../shared/src/index.js';

describe('Transformation Engine & DOMPurify Security', () => {
  it('should transform AST to standard Markdown and back to AST', () => {
    const markdown = `# Architecture Overview

This is a technical specification for the AST engine.

\`\`\`typescript
const engine = new SyncDocEngine();
\`\`\`

- First bullet item
- Second bullet item

> Distributed systems require resilient convergence.
`;

    const parsedAST = TransformationEngine.markdownToAST(markdown, 'Architecture Overview');
    expect(parsedAST.type).toBe('document');
    expect(parsedAST.title).toBe('Architecture Overview');
    expect(parsedAST.children.length).toBe(5);

    const generatedMarkdown = TransformationEngine.astToMarkdown(parsedAST);
    expect(generatedMarkdown).toContain('# Architecture Overview');
    expect(generatedMarkdown).toContain('```typescript');
    expect(generatedMarkdown).toContain('First bullet item');
    expect(generatedMarkdown).toContain('> Distributed systems require resilient convergence.');
  });

  it('should transform AST to safe semantic HTML', () => {
    const doc = createDocumentAST('HTML Output Spec');
    const html = TransformationEngine.astToHTML(doc);

    expect(html).toContain('<article class="syncdoc-document"');
    expect(html).toContain('<h1 class="syncdoc-heading syncdoc-h1"');
    expect(html).toContain('<p class="syncdoc-paragraph"');
  });

  it('should compile standalone printable HTML for PDF generation', () => {
    const doc = createDocumentAST('Printable Report');
    const fullHTML = TransformationEngine.astToPrintableHTML(doc, 'Printable Report');

    expect(fullHTML).toContain('<!DOCTYPE html>');
    expect(fullHTML).toContain('<title>Printable Report</title>');
    expect(fullHTML).toContain('@media print');
  });

  it('SECURITY: should neutralize <script> injection tags using DOMPurify', () => {
    const maliciousDoc = createDocumentAST('XSS Attack');
    const badParagraph = maliciousDoc.children[1] as ParagraphNode;
    badParagraph.content = '<script>alert("pwned")</script>Hello World';

    const safeHTML = TransformationEngine.astToHTML(maliciousDoc);
    expect(safeHTML).not.toContain('<script>');
    expect(safeHTML).not.toContain('alert("pwned")');
  });

  it('SECURITY: should neutralize malicious event handlers (onerror, onload, onclick)', () => {
    const maliciousRaw = '<img src="invalid.jpg" onerror="alert(document.cookie)" /><p onclick="evil()">Click</p>';
    const sanitized = Sanitizer.sanitize(maliciousRaw);

    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('document.cookie');
  });

  it('SECURITY: should strip javascript: pseudo-protocol URIs', () => {
    const maliciousLink = '<a href="javascript:alert(1)">Click for free reward</a>';
    const sanitized = Sanitizer.sanitize(maliciousLink);

    expect(sanitized).not.toContain('javascript:');
  });
});
