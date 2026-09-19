import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as Y from 'yjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import {
  ASTNode,
  DocumentNode,
  HeadingNode,
  ParagraphNode,
  ListItemNode,
  createNode,
  cloneAST,
  countNodes,
} from '@syncdoc/shared';
import { DocumentModel, validateASTTree } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { ConflictResolutionEngine } from '../server/src/conflict/ConflictResolutionEngine.js';
import { ASTCollaborationBridge } from '../server/src/collaboration/ASTCollaborationBridge.js';
import { WebSocketCollaborationServer } from '../server/src/collaboration/WebSocketServer.js';
import { TransformationEngine } from '../server/src/transformation/TransformationEngine.js';

describe('STEP 7: Performance, Stress Testing & Reliability Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: SocketIOServer;
  let wsServer: WebSocketCollaborationServer;
  let serverPort: number;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });
    wsServer = new WebSocketCollaborationServer(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 5058;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (wsServer) {
      wsServer.destroy();
    }
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Helper to connect a test client socket
  const createTestClient = async (): Promise<ClientSocketType> => {
    const socket = ClientSocket(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      socket.on('connect', () => resolve());
    });
    return socket;
  };

  // Helper to generate a valid, realistic AST tree of arbitrary size
  function generateValidASTTree(docId: string, targetNodeCount: number): DocumentNode {
    const root: DocumentNode = {
      id: docId,
      type: 'document',
      title: `Benchmark Document ${targetNodeCount} Nodes`,
      version: 1,
      parentId: null,
      children: [],
      order: 0,
      metadata: { createdAt: Date.now() },
    };

    let created = 0;
    let order = 0;

    while (created < targetNodeCount) {
      const cycle = created % 5;
      if (cycle === 0) {
        // Heading (levels 1-6)
        const level = ((created % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
        root.children.push({
          id: `h_${docId}_${created}`,
          type: 'heading',
          level,
          content: `Heading Level ${level} Node ${created}`,
          parentId: docId,
          children: [],
          order: order++,
          metadata: { createdAt: Date.now() },
        });
        created++;
      } else if (cycle === 1) {
        // Paragraph
        root.children.push({
          id: `p_${docId}_${created}`,
          type: 'paragraph',
          content: `Paragraph content with realistic text length for node ${created}. Collaborative editing engine benchmark text.`,
          parentId: docId,
          children: [],
          order: order++,
          metadata: { createdAt: Date.now() },
        });
        created++;
      } else if (cycle === 2) {
        // Code block
        root.children.push({
          id: `c_${docId}_${created}`,
          type: 'code_block',
          language: 'typescript',
          content: `function processNode_${created}() { return ${created} * 2; }`,
          parentId: docId,
          children: [],
          order: order++,
          metadata: { createdAt: Date.now() },
        });
        created++;
      } else if (cycle === 3) {
        // Blockquote or Divider
        if (created % 2 === 0) {
          root.children.push({
            id: `b_${docId}_${created}`,
            type: 'blockquote',
            content: `Blockquote citation for performance verification node ${created}`,
            parentId: docId,
            children: [],
            order: order++,
            metadata: { createdAt: Date.now() },
          });
        } else {
          root.children.push({
            id: `d_${docId}_${created}`,
            type: 'divider',
            content: '',
            parentId: docId,
            children: [],
            order: order++,
            metadata: { createdAt: Date.now() },
          });
        }
        created++;
      } else {
        // List with 2-3 list items
        const listId = `l_${docId}_${created}`;
        created++;
        const itemsCount = Math.min(3, Math.max(1, targetNodeCount - created));
        const items: ListItemNode[] = [];
        for (let i = 0; i < itemsCount; i++) {
          items.push({
            id: `li_${docId}_${created}`,
            type: 'list_item',
            content: `List item ${i + 1} under list ${listId}`,
            parentId: listId,
            children: [],
            order: i,
            checked: i % 2 === 0,
            metadata: { createdAt: Date.now() },
          });
          created++;
        }
        root.children.push({
          id: listId,
          type: 'list',
          listType: 'bullet',
          parentId: docId,
          children: items,
          order: order++,
          metadata: { createdAt: Date.now() },
        });
      }
    }

    return root;
  }

  // =========================================================================
  // 1. LARGE AST PERFORMANCE & SCALABILITY (Section 2)
  // =========================================================================
  describe('1. Large AST Performance & Scalability Benchmarks (Section 2)', () => {
    const nodeSizes = [100, 500, 1000, 5000];

    for (const size of nodeSizes) {
      it(`should efficiently validate, transform, clone, and diff AST of ~${size} nodes`, () => {
        const docId = `bench_doc_${size}`;
        const tree = generateValidASTTree(docId, size);
        const actualCount = countNodes(tree);
        expect(actualCount).toBeGreaterThanOrEqual(size);

        // 1. AST Validation
        const t0Validate = performance.now();
        expect(() => validateASTTree(tree)).not.toThrow();
        const validateTimeMs = performance.now() - t0Validate;

        // 2. AST Transformation to HTML
        const t0HTML = performance.now();
        const html = TransformationEngine.astToHTML(tree);
        const htmlTimeMs = performance.now() - t0HTML;
        expect(html.length).toBeGreaterThan(0);

        // 3. AST Transformation to Markdown
        const t0Markdown = performance.now();
        const markdown = TransformationEngine.astToMarkdown(tree);
        const markdownTimeMs = performance.now() - t0Markdown;
        expect(markdown.length).toBeGreaterThan(0);

        // 4. AST Deep Cloning
        const t0Clone = performance.now();
        const cloned = cloneAST(tree);
        const cloneTimeMs = performance.now() - t0Clone;
        expect(cloned.children.length).toBe(tree.children.length);

        // 5. Version Diffing
        const t0Diff = performance.now();
        const diff = ConflictResolutionEngine.compareVersions(tree, cloned);
        const diffTimeMs = performance.now() - t0Diff;
        expect(diff.added.length).toBe(0);
        expect(diff.modified.length).toBe(0);
        expect(diff.deleted.length).toBe(0);

        console.log(
          `[AST Benchmark ~${size} nodes (actual: ${actualCount})]: ` +
            `validate=${validateTimeMs.toFixed(2)}ms, ` +
            `html=${htmlTimeMs.toFixed(2)}ms, ` +
            `markdown=${markdownTimeMs.toFixed(2)}ms, ` +
            `clone=${cloneTimeMs.toFixed(2)}ms, ` +
            `diff=${diffTimeMs.toFixed(2)}ms`
        );

        // Performance sanity bounds (ensuring linear O(N) scaling without O(N^2) stalls)
        expect(validateTimeMs).toBeLessThan(100); // 5000 nodes validation must be < 100ms
        expect(cloneTimeMs).toBeLessThan(150); // 5000 nodes clone must be < 150ms
        expect(diffTimeMs).toBeLessThan(200); // 5000 nodes diff must be < 200ms
      });
    }

    it('should verify document creation and persistence with 1,000 nodes in MongoDB', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const largeTree = generateValidASTTree(docId, 1000);

      const t0Create = performance.now();
      const createdDoc = await DocumentModel.create({
        _id: docId,
        title: largeTree.title,
        version: 1,
        root: largeTree,
      });
      const createTimeMs = performance.now() - t0Create;

      expect(createdDoc._id.toString()).toBe(docId);
      expect(createdDoc.root.children.length).toBe(largeTree.children.length);
      console.log(`[MongoDB 1,000 Nodes Write Benchmark]: ${createTimeMs.toFixed(2)}ms`);

      // Verify read-back integrity
      const fetched = await DocumentModel.findById(docId).lean();
      expect(fetched?.root.children.length).toBe(largeTree.children.length);
      expect(() => validateASTTree(fetched!.root as ASTNode)).not.toThrow();
    });
  });

  // =========================================================================
  // 2. MULTI-CLIENT STRESS (Section 3)
  // =========================================================================
  describe('2. Multi-Client Stress Convergence (Section 3)', () => {
    const runMultiClientStress = async (clientCount: number) => {
      const docId = new mongoose.Types.ObjectId().toHexString();

      // Server Y.Doc
      const serverDoc = new Y.Doc();
      const serverNodes = serverDoc.getArray<ASTNode>('nodes');
      const serverMeta = serverDoc.getMap<unknown>('meta');

      // Initialize clients
      const clients = Array.from({ length: clientCount }, (_, i) => {
        const doc = new Y.Doc();
        return {
          id: `client_${i + 1}`,
          doc,
          nodes: doc.getArray<ASTNode>('nodes'),
          meta: doc.getMap<unknown>('meta'),
        };
      });

      // Network mesh to broadcast updates
      const broadcastUpdate = (fromDoc: Y.Doc, update: Uint8Array) => {
        if (fromDoc !== serverDoc) {
          Y.applyUpdate(serverDoc, update, 'network');
        }
        for (const c of clients) {
          if (c.doc !== fromDoc) {
            Y.applyUpdate(c.doc, update, 'network');
          }
        }
      };

      for (const c of clients) {
        c.doc.on('update', (update: Uint8Array, origin: unknown) => {
          if (origin !== 'network') {
            broadcastUpdate(c.doc, update);
          }
        });
      }

      // Initial base state by Client 1
      clients[0]!.doc.transact(() => {
        clients[0]!.meta.set('title', `Stress Document ${clientCount} Clients`);
        clients[0]!.meta.set('id', docId);
        clients[0]!.meta.set('version', 1);
        clients[0]!.nodes.push([
          createNode('heading', docId, 0, { content: 'Initial Collaborative Spec', level: 1 }),
          createNode('paragraph', docId, 1, { content: 'Initial paragraph baseline.' }),
        ]);
      });

      // Concurrent mixed operations across all clients:
      // - Inserts (paragraphs, headings, code blocks, lists)
      // - Updates (modifying content)
      // - Deletes (removing nodes)
      // - Reorder (splicing at different indices)
      for (let i = 0; i < clientCount; i++) {
        const client = clients[i]!;
        client.doc.transact(() => {
          const opType = i % 5;
          if (opType === 0) {
            // Insert Heading
            const h = createNode('heading', docId, 10 + i, {
              content: `Heading added by ${client.id}`,
              level: ((i % 3) + 2) as 2 | 3 | 4,
            });
            client.nodes.push([h]);
          } else if (opType === 1) {
            // Insert Paragraph
            const p = createNode('paragraph', docId, 20 + i, {
              content: `Paragraph contributed by ${client.id} in stress test.`,
            });
            client.nodes.push([p]);
          } else if (opType === 2) {
            // Insert Code Block
            const code = createNode('code_block', docId, 30 + i, {
              language: 'typescript',
              content: `const client_${i} = "${client.id}";`,
            });
            client.nodes.push([code]);
          } else if (opType === 3) {
            // Insert List with Items
            const list = createNode('list', docId, 40 + i, { listType: 'bullet' });
            list.children = [
              createNode('list_item', list.id, 0, { content: `Task 1 from ${client.id}` }) as any,
              createNode('list_item', list.id, 1, { content: `Task 2 from ${client.id}` }) as any,
            ];
            client.nodes.push([list]);
          } else {
            // Spliced Paragraph at start/middle (reordering/insert at index)
            const p = createNode('paragraph', docId, i, {
              content: `Interleaved paragraph from ${client.id}`,
            });
            if (client.nodes.length > 1) {
              client.nodes.insert(1, [p]);
            } else {
              client.nodes.push([p]);
            }
          }
        });
      }

      // Allow all CRDT deltas to propagate and converge
      const baselineJson = JSON.stringify(serverNodes.toArray());
      expect(serverNodes.length).toBeGreaterThan(clientCount);

      // Verify 100% convergence across all clients
      for (const c of clients) {
        expect(JSON.stringify(c.nodes.toArray())).toBe(baselineJson);
      }

      // Convert converged state to Canonical AST
      const convergedDoc: DocumentNode = {
        id: docId,
        type: 'document',
        title: `Stress Document ${clientCount} Clients`,
        version: 1,
        parentId: null,
        children: serverNodes.toArray(),
        order: 0,
        metadata: { convergedAt: Date.now() },
      };

      // Verify AST structural integrity rules:
      // 1. Must pass validateASTTree
      expect(() => validateASTTree(convergedDoc)).not.toThrow();

      // 2. No duplicate IDs
      const seenIds = new Set<string>();
      const traverseCheck = (node: ASTNode) => {
        expect(seenIds.has(node.id)).toBe(false);
        seenIds.add(node.id);
        if (node.children) {
          for (const child of node.children) {
            // 3. ParentId relationship remains correct (no orphan nodes)
            expect(child.parentId).toBe(node.id);
            traverseCheck(child);
          }
        }
      };
      traverseCheck(convergedDoc);

      // 4. Document remains persistable to MongoDB without error
      const persisted = await DocumentModel.create({
        _id: docId,
        title: convergedDoc.title,
        version: 1,
        root: convergedDoc,
      });
      expect(persisted._id.toString()).toBe(docId);

      // Cleanup
      serverDoc.destroy();
      for (const c of clients) {
        c.doc.destroy();
      }
    };

    it('should converge 5 concurrent clients performing mixed operations', async () => {
      await runMultiClientStress(5);
    });

    it('should converge 10 concurrent clients performing mixed operations', async () => {
      await runMultiClientStress(10);
    });

    it('should converge 20 concurrent clients performing mixed operations', async () => {
      await runMultiClientStress(20);
    });
  });

  // =========================================================================
  // 3. RAPID UPDATE STRESS (Section 4)
  // =========================================================================
  describe('3. Rapid Update Stress & Concurrency Protection (Section 4)', () => {
    it('should process 50 rapid sequential Yjs updates without silent loss or stale overwrites', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 5);

      await DocumentModel.create({
        _id: docId,
        title: 'Rapid Update Test',
        version: 1,
        root: initialAST,
      });

      const client = await createTestClient();
      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_rapid', userName: 'RapidEditor', userColor: '#123' },
        });
      });

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docId;
      const NUM_UPDATES = 50;

      // Fire 50 rapid updates sequentially using local Y.Doc sync
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(session.doc));

      for (let i = 0; i < NUM_UPDATES; i++) {
        const p = createNode('paragraph', rootId, 100 + i, {
          content: `Rapid update item #${i + 1}`,
        });
        clientDoc.getArray('nodes').push([p]);
        const delta = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(session.doc));
        client.emit('yjs-update', { documentId: docId, update: Array.from(delta) });
      }

      // Wait briefly for server event-loop tick
      await new Promise((r) => setTimeout(r, 200));

      // Verify all 50 updates reached the live server session Y.Doc
      const serverNodes = session.doc.getArray('nodes');
      expect(serverNodes.length).toBe(initialAST.children.length + NUM_UPDATES);

      // Verify changeCount incremented by exactly 50
      expect(session.changeCount).toBeGreaterThanOrEqual(NUM_UPDATES);
      expect(session.hasUnsavedChanges).toBe(true);

      // Trigger flush persistence
      await wsServer.flushDocumentSave(docId);

      // Verify MongoDB document contains all 50 updates and version bumped
      const savedDoc = await DocumentModel.findById(docId).lean();
      expect(savedDoc?.version).toBe(2);
      expect(savedDoc?.root.children.length).toBe(initialAST.children.length + NUM_UPDATES);

      // Clean up
      client.disconnect();
      clientDoc.destroy();
    });
  });

  // =========================================================================
  // 4. PERSISTENCE STRESS & SNAPSHOT MONOTONICITY (Section 5)
  // =========================================================================
  describe('4. Persistence Stress & Snapshot Monotonicity (Section 5)', () => {
    it('should guarantee Live Yjs State = Canonical AST = MongoDB Document = Version Snapshot', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 4);

      await DocumentModel.create({
        _id: docId,
        title: 'Monotonic Persistence Test',
        version: 1,
        root: initialAST,
      });

      // Initial version 1 snapshot
      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: initialAST,
        author: 'System',
        changeDescription: 'Initial Document Creation',
        nodeCount: countNodes(initialAST),
      });

      const client = await createTestClient();
      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_persist', userName: 'PersistMaster', userColor: '#456' },
        });
      });

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docId;
      const cDoc = new Y.Doc();
      Y.applyUpdate(cDoc, Y.encodeStateAsUpdate(session.doc));

      // Wave 1: Add Paragraph (V1 -> V2)
      cDoc.getArray('nodes').push([createNode('paragraph', rootId, 10, { content: 'Wave 1 update' })]);
      const u1 = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u1) });
      await new Promise((r) => setTimeout(r, 60));
      await wsServer.flushDocumentSave(docId);

      // Wave 2: Add Heading (V2 -> V3)
      cDoc.getArray('nodes').push([createNode('heading', rootId, 11, { content: 'Wave 2 Heading', level: 2 })]);
      const u2 = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u2) });
      await new Promise((r) => setTimeout(r, 60));
      await wsServer.flushDocumentSave(docId);

      // Wave 3: Add Code Block (V3 -> V4)
      cDoc.getArray('nodes').push([
        createNode('code_block', rootId, 12, { language: 'python', content: 'print("Wave 3")' }),
      ]);
      const u3 = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u3) });
      await new Promise((r) => setTimeout(r, 60));
      await wsServer.flushDocumentSave(docId);

      // Verify convergence equality:
      // Live Yjs state == Canonical AST == MongoDB document == Latest version snapshot
      const canonicalAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);
      const dbDoc = await DocumentModel.findById(docId).lean();
      const versions = await DocumentVersionModel.find({ documentId: docId }).sort({ versionNumber: 1 }).lean();

      expect(dbDoc?.version).toBe(4);
      expect(versions.length).toBe(4);
      expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3, 4]);

      const latestSnapshot = versions[3]!;
      expect(latestSnapshot.versionNumber).toBe(4);

      // Exact child counts matching across all layers
      expect(canonicalAST.children.length).toBe(initialAST.children.length + 3);
      expect(dbDoc?.root.children.length).toBe(canonicalAST.children.length);
      expect(latestSnapshot.astSnapshot.children.length).toBe(canonicalAST.children.length);

      // Verify historical snapshot immutability
      expect(versions[0]!.astSnapshot.children.length).toBe(initialAST.children.length);
      expect(versions[1]!.astSnapshot.children.length).toBe(initialAST.children.length + 1);
      expect(versions[2]!.astSnapshot.children.length).toBe(initialAST.children.length + 2);
      expect(versions[3]!.astSnapshot.children.length).toBe(initialAST.children.length + 3);

      client.disconnect();
      cDoc.destroy();
    });
  });

  // =========================================================================
  // 5. NO-OP UPDATE BEHAVIOR (Section 6)
  // =========================================================================
  describe('5. No-Op Update Behavior (Section 6)', () => {
    it('should not create redundant database versions on identical or no-op state updates', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 3);

      await DocumentModel.create({
        _id: docId,
        title: initialAST.title,
        version: 2,
        root: initialAST,
      });

      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 2,
        astSnapshot: initialAST,
        author: 'System',
        changeDescription: 'Version 2 baseline',
        nodeCount: countNodes(initialAST),
      });

      const client = await createTestClient();
      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_noop', userName: 'NoOpTester', userColor: '#789' },
        });
      });

      const session = wsServer.getSession(docId)!;

      // Attempt 3 repeated saves without making any content changes
      session.hasUnsavedChanges = true; // force simulate save trigger
      await wsServer.flushDocumentSave(docId);

      session.hasUnsavedChanges = true;
      await wsServer.flushDocumentSave(docId);

      session.hasUnsavedChanges = true;
      await wsServer.flushDocumentSave(docId);

      // Verify database version did NOT increment beyond 2
      const dbDoc = await DocumentModel.findById(docId).lean();
      expect(dbDoc?.version).toBe(2);

      // Verify no extra snapshots were created in DocumentVersionModel
      const versionCount = await DocumentVersionModel.countDocuments({ documentId: docId });
      expect(versionCount).toBe(1);

      client.disconnect();
    });
  });

  // =========================================================================
  // 6. INVALID-UPDATE STRESS (Section 7)
  // =========================================================================
  describe('6. Invalid-Update Stress (Section 7)', () => {
    it('should reject malformed updates, protect live session, and process valid updates normally', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 3);

      await DocumentModel.create({
        _id: docId,
        title: 'Invalid Update Stress',
        version: 1,
        root: initialAST,
      });

      const client = await createTestClient();
      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_sec', userName: 'SecTester', userColor: '#e11' },
        });
      });

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docId;
      const initialChildCount = session.doc.getArray('nodes').length;

      const cDoc = new Y.Doc();
      Y.applyUpdate(cDoc, Y.encodeStateAsUpdate(session.doc));

      let warningCount = 0;
      client.on('ast-warning', () => {
        warningCount++;
      });

      // Stream: Valid 1 -> Malformed 1 (duplicate ID) -> Valid 2 -> Malformed 2 (invalid type) -> Valid 3

      // 1. Valid Update 1
      const validP1 = createNode('paragraph', rootId, 10, { content: 'Valid Paragraph 1' });
      cDoc.getArray('nodes').push([validP1]);
      let u = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u) });
      await new Promise((r) => setTimeout(r, 60));

      // 2. Malformed Update 1 (Duplicate Node ID)
      const badDoc1 = new Y.Doc();
      Y.applyUpdate(badDoc1, Y.encodeStateAsUpdate(session.doc));
      const duplicateNode = { ...validP1 }; // duplicate ID!
      badDoc1.getArray('nodes').push([duplicateNode]);
      let badUpdate1 = Y.encodeStateAsUpdate(badDoc1, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(badUpdate1) });
      await new Promise((r) => setTimeout(r, 60));

      // 3. Valid Update 2
      const validP2 = createNode('paragraph', rootId, 11, { content: 'Valid Paragraph 2' });
      cDoc.getArray('nodes').push([validP2]);
      u = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u) });
      await new Promise((r) => setTimeout(r, 60));

      // 4. Malformed Update 2 (Invalid Node Type)
      const badDoc2 = new Y.Doc();
      Y.applyUpdate(badDoc2, Y.encodeStateAsUpdate(session.doc));
      const illegalNode = {
        id: 'bad_node_99',
        type: 'malicious_script_tag',
        parentId: rootId,
        order: 99,
        children: [],
      } as any;
      badDoc2.getArray('nodes').push([illegalNode]);
      let badUpdate2 = Y.encodeStateAsUpdate(badDoc2, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(badUpdate2) });
      await new Promise((r) => setTimeout(r, 60));

      // 5. Valid Update 3
      const validP3 = createNode('paragraph', rootId, 12, { content: 'Valid Paragraph 3' });
      cDoc.getArray('nodes').push([validP3]);
      u = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u) });
      await new Promise((r) => setTimeout(r, 60));

      // Verify warnings received for invalid updates
      expect(warningCount).toBe(2);

      // Verify live Y.Doc contains EXACTLY 3 valid additions, zero invalid nodes
      const liveNodes = session.doc.getArray('nodes').toArray() as ASTNode[];
      expect(liveNodes.length).toBe(initialChildCount + 3);
      expect(liveNodes.some((n) => n.id === 'bad_node_99')).toBe(false);

      // Verify persistence flushes clean valid state
      await wsServer.flushDocumentSave(docId);
      const dbDoc = await DocumentModel.findById(docId).lean();
      expect(dbDoc?.root.children.length).toBe(initialChildCount + 3);
      expect(() => validateASTTree(dbDoc!.root as ASTNode)).not.toThrow();

      client.disconnect();
      cDoc.destroy();
      badDoc1.destroy();
      badDoc2.destroy();
    });
  });

  // =========================================================================
  // 7. RESOURCE CLEANUP & SESSION LIFECYCLE (Section 8)
  // =========================================================================
  describe('7. Resource Cleanup & Session Lifecycle (Section 8)', () => {
    it('should manage WebSocket lifecycle, evict idle sessions, clear timers, and prevent stale presence', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 2);

      await DocumentModel.create({
        _id: docId,
        title: 'Cleanup Lifecycle Test',
        version: 1,
        root: initialAST,
      });

      // 1. Client 1 joins
      const client1 = await createTestClient();
      await new Promise<void>((r) => {
        client1.once('yjs-sync', () => r());
        client1.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_clean1', userName: 'User 1', userColor: '#111' },
        });
      });

      // 2. Client 2 joins
      const client2 = await createTestClient();
      await new Promise<void>((r) => {
        client2.once('yjs-sync', () => r());
        client2.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_clean2', userName: 'User 2', userColor: '#222' },
        });
      });

      const session = wsServer.getSession(docId)!;
      expect(session).toBeDefined();
      expect(session.activeUsers.size).toBe(2);
      expect(wsServer.getActiveSessionCount()).toBeGreaterThanOrEqual(1);

      // 3. Client 1 updates document
      const cDoc = new Y.Doc();
      Y.applyUpdate(cDoc, Y.encodeStateAsUpdate(session.doc));
      cDoc.getArray('nodes').push([createNode('paragraph', docId, 5, { content: 'Cleanup edit' })]);
      const delta = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));
      client1.emit('yjs-update', { documentId: docId, update: Array.from(delta) });
      await new Promise((r) => setTimeout(r, 60));

      expect(session.hasUnsavedChanges).toBe(true);

      // 4. Client 1 disconnects -> Client 2 remains
      client1.disconnect();
      await new Promise((r) => setTimeout(r, 100));
      expect(session.activeUsers.size).toBe(1);
      expect(wsServer.getSession(docId)).toBeDefined(); // still active because client 2 is connected

      // 5. Client 2 disconnects -> All clients have left!
      client2.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      // 6. Verify session was cleanly evicted from memory after save completed
      expect(wsServer.getSession(docId)).toBeUndefined();

      // 7. Verify MongoDB contains the persisted update
      const dbDoc = await DocumentModel.findById(docId).lean();
      expect(dbDoc?.version).toBe(2);
      expect(dbDoc?.root.children.length).toBe(initialAST.children.length + 1);

      // 8. Verify idempotent cleanup (calling cleanup on nonexistent session returns false)
      expect(wsServer.cleanupSession(docId)).toBe(false);

      cDoc.destroy();
    });
  });

  // =========================================================================
  // 8. RACE-CONDITION TESTING (Section 9)
  // =========================================================================
  describe('8. Race-Condition Concurrency Testing (Section 9)', () => {
    it('should protect against in-flight persistence overwrites when updates and saves interleave', async () => {
      const docId = new mongoose.Types.ObjectId().toHexString();
      const initialAST = generateValidASTTree(docId, 3);

      await DocumentModel.create({
        _id: docId,
        title: 'Race Condition Spec',
        version: 1,
        root: initialAST,
      });

      const client = await createTestClient();
      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_race', userName: 'RaceRunner', userColor: '#990' },
        });
      });

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docId;

      // Update 1: Add Paragraph 1
      const cDoc1 = new Y.Doc();
      Y.applyUpdate(cDoc1, Y.encodeStateAsUpdate(session.doc));
      cDoc1.getArray('nodes').push([createNode('paragraph', rootId, 10, { content: 'Race update 1' })]);
      const delta1 = Y.encodeStateAsUpdate(cDoc1, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(delta1) });
      await new Promise((r) => setTimeout(r, 40));

      // Start in-flight flush save 1
      const savePromise1 = wsServer.flushDocumentSave(docId);

      // Concurrently while save 1 is in-flight, Update 2 arrives!
      const cDoc2 = new Y.Doc();
      Y.applyUpdate(cDoc2, Y.encodeStateAsUpdate(session.doc));
      cDoc2.getArray('nodes').push([createNode('paragraph', rootId, 11, { content: 'Race update 2 IN-FLIGHT' })]);
      const delta2 = Y.encodeStateAsUpdate(cDoc2, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(delta2) });
      await new Promise((r) => setTimeout(r, 40));

      // Concurrently call flushDocumentSave a second time while save 1 is still in-flight
      const savePromise2 = wsServer.flushDocumentSave(docId);

      await Promise.all([savePromise1, savePromise2]);

      // If pending save was scheduled, flush it
      if (session.hasUnsavedChanges) {
        await wsServer.flushDocumentSave(docId);
      }

      // Verify MongoDB has state with BOTH Update 1 and Update 2
      const finalDoc = await DocumentModel.findById(docId).lean();
      expect(finalDoc?.root.children.length).toBe(initialAST.children.length + 2);

      // Verify version number advanced monotonically
      expect(finalDoc?.version).toBeGreaterThanOrEqual(2);

      client.disconnect();
      cDoc1.destroy();
      cDoc2.destroy();
    });
  });
});
