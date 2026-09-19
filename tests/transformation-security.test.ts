import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TransformationEngine } from '../server/src/transformation/TransformationEngine.js';
import { Sanitizer } from '../server/src/transformation/Sanitizer.js';
import { DocumentModel, validateASTTree } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { documentService } from '../server/src/services/DocumentService.js';
import documentRoutes from '../server/src/routes/documentRoutes.js';
import {
  createDocumentAST,
  createNode,
  cloneAST,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  DocumentNode,
  ASTNode,
} from '@syncdoc/shared';

describe('STEP 6: Security & Transformation Hardening', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Express;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use('/api', documentRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // =========================================================================
  // 1. HTML / XSS Sanitization (DOMPurify Hardening)
  // =========================================================================
  describe('1. HTML / XSS Sanitization with DOMPurify', () => {
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
      expect(safeHTML).toContain('Hello World');
    });

    it('SECURITY: should neutralize <iframe>, <object>, and <embed> tags', () => {
      const raw = `
        <iframe src="https://attacker.com/evil"></iframe>
        <object data="https://attacker.com/malicious.swf"></object>
        <embed src="https://attacker.com/exploit.pdf"></embed>
        <p>Legitimate text</p>
      `;
      const clean = Sanitizer.sanitize(raw);
      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('<object');
      expect(clean).not.toContain('<embed');
      expect(clean).toContain('<p>Legitimate text</p>');
    });

    it('SECURITY: should neutralize malicious event handlers (onerror, onload, onclick, onmouseover, onfocus)', () => {
      const maliciousRaw = `
        <img src="invalid.jpg" onerror="alert(document.cookie)" />
        <p onclick="evil()" onmouseover="steal()" onfocus="pwn()">Click</p>
        <body onload="runPayload()"></body>
      `;
      const sanitized = Sanitizer.sanitize(maliciousRaw);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).not.toContain('onfocus');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('document.cookie');
      expect(sanitized).toContain('<p>Click</p>');
    });

    it('SECURITY: should strip javascript: pseudo-protocol URIs in links and image attributes', () => {
      const maliciousLink = '<a href="javascript:alert(1)">Click for free reward</a>';
      const sanitized = Sanitizer.sanitize(maliciousLink);
      expect(sanitized).not.toContain('javascript:');

      const obfuscated = '<a href="  javascript:alert(document.domain)">Test</a>';
      expect(Sanitizer.sanitize(obfuscated)).not.toContain('javascript:');
    });

    it('SECURITY: should strip data:text/html base64 XSS URIs in links', () => {
      const dataUriLink = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Payload</a>';
      const sanitized = Sanitizer.sanitize(dataUriLink);
      expect(sanitized).not.toContain('data:text/html');
      expect(sanitized).not.toContain('PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
    });

    it('SECURITY: should strip dangerous style attributes and formaction attributes', () => {
      const dangerousAttrs = '<div style="background-image: url(javascript:alert(1)); expression(alert(1));" formaction="https://attacker.com">Safe text</div>';
      const sanitized = Sanitizer.sanitize(dangerousAttrs);
      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('formaction=');
      expect(sanitized).toContain('Safe text');
    });

    it('SECURITY: should cleanly sanitize deeply nested and obfuscated malicious HTML', () => {
      const nestedPayload = `
        <div onclick="evil()">
          <script><script>alert(1)</script></script>
          <p>Valid Paragraph <a href="javascript:alert(2)">Safe Link</a></p>
          <iframe src="https://evil.com"><p>Hidden</p></iframe>
        </div>
      `;
      const sanitized = Sanitizer.sanitize(nestedPayload);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Valid Paragraph');
    });
  });

  // =========================================================================
  // 2. AST Security Validation (validateASTTree)
  // =========================================================================
  describe('2. AST Security Validation (validateASTTree)', () => {
    it('should reject an AST where root is null, undefined, or not an object', () => {
      // @ts-expect-error - testing invalid input
      expect(() => validateASTTree(null)).toThrow(/AST root cannot be null or undefined/);
      // @ts-expect-error - testing invalid input
      expect(() => validateASTTree(undefined)).toThrow(/AST root cannot be null or undefined/);
      // @ts-expect-error - testing invalid input
      expect(() => validateASTTree('not an object')).toThrow(/AST root must be a valid object/);
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

    it('should reject an AST where root children is missing (undefined)', () => {
      const root = createDocumentAST('Missing Children Root');
      // @ts-expect-error - testing missing children
      delete root.children;
      expect(() => validateASTTree(root)).toThrow(/must have a 'children' array/i);
    });

    it('should reject an AST where root children is not an array (string, number, object)', () => {
      const root1 = createDocumentAST('Non-array Children Root 1');
      // @ts-expect-error - testing invalid children type
      root1.children = 'not an array';
      expect(() => validateASTTree(root1)).toThrow(/must have a 'children' array/i);

      const root2 = createDocumentAST('Non-array Children Root 2');
      // @ts-expect-error - testing invalid children type
      root2.children = { 0: 'fake' };
      expect(() => validateASTTree(root2)).toThrow(/must have a 'children' array/i);
    });

    it('should reject duplicate node IDs in the document tree', () => {
      const root = createDocumentAST('Duplicate ID Test');
      const duplicateId = root.children[0]!.id;
      root.children[1]!.id = duplicateId;

      expect(() => validateASTTree(root)).toThrow(/Duplicate node ID/);
    });

    it('should reject invalid node type', () => {
      const root = createDocumentAST('Invalid Node Type Test');
      // @ts-expect-error - testing invalid node type
      root.children[0]!.type = 'script';
      expect(() => validateASTTree(root)).toThrow(/Invalid node type 'script'/);
    });

    it('should reject invalid parent-child relationship references (orphan / mismatched nodes)', () => {
      const root = createDocumentAST('Parent Mismatch Test');
      root.children[0]!.parentId = 'wrong_parent_id';
      expect(() => validateASTTree(root)).toThrow(/Invalid parent relationship for node/);
    });

    it('should reject circular references in the AST tree', () => {
      const root = createDocumentAST('Circular Test');
      const nodeA = root.children[0]!;
      const nodeB = root.children[1]!;

      nodeA.children = [nodeB];
      nodeB.parentId = nodeA.id;
      nodeB.children = [nodeA]; // circular cycle

      expect(() => validateASTTree(root)).toThrow(/Circular reference detected in AST/);
    });

    it('should reject invalid heading level (outside 1-6 or non-integer)', () => {
      const root = createDocumentAST('Invalid Heading Level Test');
      const badHeading = root.children[0] as HeadingNode;

      // @ts-expect-error - testing invalid level
      badHeading.level = 0;
      expect(() => validateASTTree(root)).toThrow(/must have a level between 1 and 6/);

      // @ts-expect-error - testing invalid level
      badHeading.level = 9;
      expect(() => validateASTTree(root)).toThrow(/must have a level between 1 and 6/);

      // @ts-expect-error - testing non-integer level
      badHeading.level = 2.5;
      expect(() => validateASTTree(root)).toThrow(/must have a level between 1 and 6/);
    });

    it('should reject invalid list / list-item structure', () => {
      const root = createDocumentAST('List Structure Test');

      // 1. list_item directly under document (orphan list_item)
      const orphanListItem: ListItemNode = {
        id: 'li_orphan',
        type: 'list_item',
        content: 'I should be inside a list',
        parentId: root.id,
        children: [],
        order: 2,
      };
      root.children.push(orphanListItem);
      expect(() => validateASTTree(root)).toThrow(/'list_item' node 'li_orphan' must be a child of a 'list' node/);

      // Remove orphan
      root.children.pop();

      // 2. list containing non-list_item child
      const listNode: ListNode = {
        id: 'list_1',
        type: 'list',
        listType: 'bullet',
        parentId: root.id,
        children: [
          createNode('paragraph', 'list_1', 0, { content: 'Paragraph inside list' }) as any,
        ],
        order: 2,
      };
      root.children.push(listNode);
      expect(() => validateASTTree(root)).toThrow(/'list' node 'list_1' can only contain 'list_item' children/);

      // Remove invalid list
      root.children.pop();

      // 3. list with missing children array
      const brokenList: any = {
        id: 'list_broken',
        type: 'list',
        listType: 'bullet',
        parentId: root.id,
        order: 2,
      };
      root.children.push(brokenList);
      expect(() => validateASTTree(root)).toThrow(/'list' node 'list_broken' must have a 'children' array/);
    });

    it('should reject negative order or NaN order', () => {
      const root = createDocumentAST('Negative Order Test');
      root.children[0]!.order = -1;
      expect(() => validateASTTree(root)).toThrow(/has invalid order '-1'/);

      root.children[0]!.order = NaN;
      expect(() => validateASTTree(root)).toThrow(/has invalid order 'NaN'/);
    });

    it('should reject node IDs with invalid/malicious characters', () => {
      const root = createDocumentAST('Bad ID Test');
      root.children[0]!.id = 'bad<script>';
      expect(() => validateASTTree(root)).toThrow(/contains invalid characters/);

      root.children[0]!.id = 'node" onclick="alert(1)';
      expect(() => validateASTTree(root)).toThrow(/contains invalid characters/);
    });

    it('should reject invalid/missing required fields (e.g. non-string title)', () => {
      const root = createDocumentAST('Title Test');
      // @ts-expect-error - testing non-string title
      root.title = 12345;
      expect(() => validateASTTree(root)).toThrow(/Root document node must have a valid string 'title'/);
    });
  });

  // =========================================================================
  // 3. Transformation & Export Safety
  // =========================================================================
  describe('3. Transformation & Export Safety', () => {
    it('astToHTML should neutralize XSS across headings, paragraphs, and blockquotes', () => {
      const doc = createDocumentAST('Injection Spec');
      const h1 = doc.children[0] as HeadingNode;
      h1.content = 'Title <script>alert("h1")</script>';

      const p = doc.children[1] as ParagraphNode;
      p.content = 'Body with <a href="javascript:steal()">Click me</a>';

      const bq = createNode('blockquote', doc.id, 2, {
        content: 'Quote with <img src="x" onerror="evil()" />',
      }) as BlockquoteNode;
      doc.children.push(bq);

      const html = TransformationEngine.astToHTML(doc);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert("h1")');
      expect(html).not.toContain('javascript:steal()');
      expect(html).not.toContain('onerror');
    });

    it('astToPrintableHTML should escape title and sanitize body against script execution', () => {
      const doc = createDocumentAST('<script>alert("title")</script>Malicious Title');
      const p = doc.children[1] as ParagraphNode;
      p.content = '<iframe src="evil.com"></iframe>Printable Body';

      const printable = TransformationEngine.astToPrintableHTML(doc, doc.title);
      expect(printable).toContain('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;Malicious Title');
      expect(printable).not.toContain('<iframe');
      expect(printable).toContain('Printable Body');
      expect(printable).toContain('@media print');
    });

    it('markdownToAST should convert markdown containing XSS payloads to AST and export safe HTML', () => {
      const evilMarkdown = `
# Dangerous Heading <script>alert(1)</script>

<a href="javascript:alert(2)">Malicious Link</a>

<img src="x" onerror="alert(3)" />
      `;

      const ast = TransformationEngine.markdownToAST(evilMarkdown, 'Imported');
      expect(() => validateASTTree(ast)).not.toThrow();

      const html = TransformationEngine.astToHTML(ast);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('javascript:alert(2)');
      expect(html).not.toContain('onerror');
    });

    it('exportDocument should export safe HTML and print-ready HTML', async () => {
      const root = createDocumentAST('Export Test');
      const p = root.children[1] as ParagraphNode;
      p.content = '<script>alert("export")</script>Safe Content';

      const doc = await DocumentModel.create({
        title: 'Export Test',
        version: 1,
        root,
      });

      const htmlExport = await documentService.exportDocument(doc._id.toString(), 'html');
      expect(htmlExport).not.toBeNull();
      expect(htmlExport?.data).not.toContain('<script>');
      expect(htmlExport?.data).toContain('Safe Content');

      const pdfExport = await documentService.exportDocument(doc._id.toString(), 'pdf');
      expect(pdfExport).not.toBeNull();
      expect(pdfExport?.filename).toContain('_print.html');
      expect(pdfExport?.data).not.toContain('<script>');
      expect(pdfExport?.data).toContain('Safe Content');
    });
  });

  // =========================================================================
  // 4. Historical & Version Security (Rollback & Snapshot Validation)
  // =========================================================================
  describe('4. Historical & Version Security', () => {
    it('rollbackToVersion should reject rollback if historical snapshot has been corrupted/tampered with', async () => {
      const initialRoot = createDocumentAST('Rollback Security Spec');
      const doc = await DocumentModel.create({
        title: 'Rollback Security Spec',
        version: 1,
        root: initialRoot,
      });
      const docId = doc._id.toString();

      // Create valid version 1 snapshot
      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: initialRoot,
        author: 'Init',
        changeDescription: 'Initial',
        nodeCount: 3,
      });

      // Tampered version 2 snapshot (illegal heading level)
      const corruptedRoot = cloneAST(initialRoot);
      (corruptedRoot.children[0] as any).level = 99; // Corrupted
      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 2,
        astSnapshot: corruptedRoot,
        author: 'Tampered Snapshot',
        changeDescription: 'Corrupted snapshot',
        nodeCount: 3,
      });

      // Attempt rollback to version 2 must be rejected by validateASTTree
      await expect(documentService.rollbackToVersion(docId, 2)).rejects.toThrow(
        /must have a level between 1 and 6/
      );

      // Active document must remain in valid version 1 state
      const currentDoc = await DocumentModel.findById(docId).lean();
      expect(currentDoc?.version).toBe(1);
    });

    it('rollbackToVersion should deep-clone snapshot to preserve historical snapshot immutability', async () => {
      const root = createDocumentAST('Snapshot Immutability Spec');
      const doc = await DocumentModel.create({
        title: 'Snapshot Immutability Spec',
        version: 1,
        root,
      });
      const docId = doc._id.toString();

      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: root,
        author: 'Init',
        changeDescription: 'Initial',
        nodeCount: 3,
      });

      // Rollback to version 1 creates a new version (version 2)
      const rolledBack = await documentService.rollbackToVersion(docId, 1);
      expect(rolledBack?.version).toBe(2);

      // Mutate current document
      await documentService.updateDocument(docId, {
        title: 'Mutated Document Title',
      });

      // Verify original version 1 snapshot still has original title and version 1
      const v1Snapshot = await DocumentVersionModel.findOne({ documentId: docId, versionNumber: 1 }).lean();
      expect(v1Snapshot?.versionNumber).toBe(1);
      expect(v1Snapshot?.astSnapshot.title).toBe('Snapshot Immutability Spec');
    });
  });

  // =========================================================================
  // 5. REST API Security Boundaries & Error Sanitization
  // =========================================================================
  describe('5. REST API Security Boundaries', () => {
    it('POST /api/documents should reject creation when AST has missing or non-array children (400)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({
          title: 'Broken AST',
          root: {
            id: 'doc_test',
            type: 'document',
            parentId: null,
            order: 0,
            // missing children
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/must have a 'children' array/);
    });

    it('PUT /api/documents/:id/ast should reject update with negative order or invalid node type (400)', async () => {
      // Create valid document first
      const doc = await DocumentModel.create({
        title: 'API Security Spec',
        version: 1,
        root: createDocumentAST('API Security Spec'),
      });

      const badRoot = cloneAST(doc.root);
      badRoot.children[0]!.order = -5;

      const res = await request(app)
        .put(`/api/documents/${doc._id}/ast`)
        .send({ root: badRoot });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Order must be a non-negative number/);
    });

    it('GET /api/documents/:id/export/:format should reject unsupported export format (400)', async () => {
      const doc = await DocumentModel.create({
        title: 'Export Security Spec',
        version: 1,
        root: createDocumentAST('Export Security Spec'),
      });

      const res = await request(app).get(`/api/documents/${doc._id}/export/exe`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Unsupported export format/);
    });

    it('INFORMATION DISCLOSURE: internal server errors do not expose file paths or MongoDB internals', async () => {
      // Pass an invalid mongo ID to an endpoint that triggers controlled handling
      const res = await request(app).get('/api/documents/non_existent_id');
      expect(res.status).toBe(404);
      expect(res.body.error).not.toContain('MongoServerError');
      expect(res.body.error).not.toContain('C:\\');
      expect(res.body.error).not.toContain('/Users/');
    });
  });
});
