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
  ParagraphNode,
  HeadingNode,
  ASTOperation,
  createDocumentAST,
  createNode,
  cloneAST,
} from '@syncdoc/shared';
import { DocumentModel, validateASTTree } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { ConflictResolutionEngine } from '../server/src/conflict/ConflictResolutionEngine.js';
import { ASTCollaborationBridge } from '../server/src/collaboration/ASTCollaborationBridge.js';
import { WebSocketCollaborationServer } from '../server/src/collaboration/WebSocketServer.js';

describe('Step 5: Multi-Client Collaboration & Conflict Validation', () => {
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
        serverPort = typeof addr === 'object' && addr ? addr.port : 5057;
        resolve();
      });
    });
  });

  afterAll(async () => {
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

  // Helper to establish a network mesh between Y.Docs
  const setupYjsMesh = (docs: Y.Doc[]) => {
    const broadcast = (fromDoc: Y.Doc, update: Uint8Array) => {
      for (const d of docs) {
        if (d !== fromDoc) {
          Y.applyUpdate(d, update, 'network');
        }
      }
    };

    for (const doc of docs) {
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'network') {
          broadcast(doc, update);
        }
      });
    }
  };

  describe('1. Two-Client Independent Edits (Section 4)', () => {
    it('should converge independent edits on different paragraphs without destructive overwrite', () => {
      const docId = 'doc_independent_edits';
      const pAId = 'para_a_1';
      const pBId = 'para_b_2';

      // Initial state: Document with Paragraph A and Paragraph B
      const initialNodeA = createNode('paragraph', docId, 0, { content: 'Initial Paragraph A' });
      initialNodeA.id = pAId;
      const initialNodeB = createNode('paragraph', docId, 1, { content: 'Initial Paragraph B' });
      initialNodeB.id = pBId;

      const serverDoc = new Y.Doc();
      const serverNodes = serverDoc.getArray<ASTNode>('nodes');
      serverDoc.transact(() => {
        serverDoc.getMap('meta').set('id', docId);
        serverNodes.push([initialNodeA, initialNodeB]);
      });

      // Two clients clone current server state
      const clientADoc = new Y.Doc();
      Y.applyUpdate(clientADoc, Y.encodeStateAsUpdate(serverDoc));
      const clientANodes = clientADoc.getArray<ASTNode>('nodes');

      const clientBDoc = new Y.Doc();
      Y.applyUpdate(clientBDoc, Y.encodeStateAsUpdate(serverDoc));
      const clientBNodes = clientBDoc.getArray<ASTNode>('nodes');

      // Client A edits Paragraph A
      clientADoc.transact(() => {
        const updatedA: ASTNode = {
          ...cloneAST(clientANodes.get(0)!),
          content: 'Paragraph A - modified by Client A',
        };
        clientANodes.delete(0, 1);
        clientANodes.insert(0, [updatedA]);
      });

      // Client B edits Paragraph B concurrently (without knowing of A's edit)
      clientBDoc.transact(() => {
        const updatedB: ASTNode = {
          ...cloneAST(clientBNodes.get(1)!),
          content: 'Paragraph B - modified by Client B',
        };
        clientBNodes.delete(1, 1);
        clientBNodes.insert(1, [updatedB]);
      });

      // Cross-synchronize Client A and Client B
      const updateA = Y.encodeStateAsUpdate(clientADoc, Y.encodeStateVector(clientBDoc));
      const updateB = Y.encodeStateAsUpdate(clientBDoc, Y.encodeStateVector(clientADoc));

      Y.applyUpdate(clientBDoc, updateA);
      Y.applyUpdate(clientADoc, updateB);
      Y.applyUpdate(serverDoc, updateA);
      Y.applyUpdate(serverDoc, updateB);

      // Verify convergence: both clients have identical JSON
      const aJson = JSON.stringify(clientANodes.toArray());
      const bJson = JSON.stringify(clientBNodes.toArray());
      const sJson = JSON.stringify(serverNodes.toArray());
      expect(aJson).toBe(bJson);
      expect(sJson).toBe(aJson);

      // Verify both edits exist and no destructive overwrite occurred
      const finalNodes = clientANodes.toArray();
      expect(finalNodes.length).toBe(2);

      const nodeA = finalNodes.find((n) => n.id === pAId) as ParagraphNode;
      const nodeB = finalNodes.find((n) => n.id === pBId) as ParagraphNode;

      expect(nodeA).toBeDefined();
      expect(nodeA.content).toBe('Paragraph A - modified by Client A');

      expect(nodeB).toBeDefined();
      expect(nodeB.content).toBe('Paragraph B - modified by Client B');

      // Verify AST structural validity
      const canonicalAST = ASTCollaborationBridge.extractCanonicalAST(clientADoc, docId);
      expect(() => validateASTTree(canonicalAST)).not.toThrow();

      // Clean up
      serverDoc.destroy();
      clientADoc.destroy();
      clientBDoc.destroy();
    });
  });

  describe('2. Concurrent Same-Node Edits (Section 5)', () => {
    it('should maintain document validity, prevent duplicate IDs, and identify conflict via ConflictResolutionEngine', () => {
      const docId = 'doc_same_node';
      const paraId = 'para_shared_1';

      const baseDoc = createDocumentAST('Concurrent Same Node Spec');
      const targetPara = createNode('paragraph', baseDoc.id, 0, { content: 'Initial Shared Content' });
      targetPara.id = paraId;
      baseDoc.children = [targetPara];

      // Client A edits the paragraph
      const opA: ASTOperation = {
        id: 'op_a',
        type: 'UPDATE_CONTENT',
        nodeId: paraId,
        newValue: 'Content edited by Alice',
        timestamp: 1000,
        clientId: 'Alice',
      };

      // Client B edits the EXACT same paragraph concurrently
      const opB: ASTOperation = {
        id: 'op_b',
        type: 'UPDATE_CONTENT',
        nodeId: paraId,
        newValue: 'Content edited concurrently by Bob',
        timestamp: 1020,
        clientId: 'Bob',
      };

      // 1. Conflict detection via ConflictResolutionEngine
      const conflict = ConflictResolutionEngine.detectConflict(baseDoc, opA, opB);
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('CONCURRENT_SAME_NODE_EDIT');
      expect(conflict?.nodeId).toBe(paraId);

      // 2. Conflict resolution via ConflictResolutionEngine
      const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opA], [opB]);
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.conflicts.length).toBe(1);

      // Verify single node survives with no duplicate IDs
      expect(mergeResult.mergedAST.children.length).toBe(1);
      const mergedNode = mergeResult.mergedAST.children[0] as ParagraphNode;
      expect(mergedNode.id).toBe(paraId);
      expect(mergedNode.content).toBe('Content edited concurrently by Bob'); // Bob has higher timestamp

      // 3. Structural validation of merged AST
      expect(() => validateASTTree(mergeResult.mergedAST)).not.toThrow();

      // 4. Structural diff detection
      const diff = ConflictResolutionEngine.compareVersions(baseDoc, mergeResult.mergedAST);
      expect(diff.modified.length).toBe(1);
      expect(diff.modified[0]!.id).toBe(paraId);
      expect(diff.added.length).toBe(0);
      expect(diff.deleted.length).toBe(0);
    });
  });

  describe('3. Concurrent Insertions (Section 6)', () => {
    it('should preserve all concurrently inserted nodes at the same index with unique IDs and correct parentId', () => {
      const docId = 'doc_concurrent_insertions';
      const rootId = `doc_${docId}`;

      const serverDoc = new Y.Doc();
      const serverNodes = serverDoc.getArray<ASTNode>('nodes');
      serverDoc.getMap('meta').set('id', rootId);

      // Initial state: single paragraph
      const existingPara = createNode('paragraph', rootId, 0, { content: 'Anchor Paragraph' });
      serverDoc.transact(() => {
        serverNodes.push([existingPara]);
      });

      // Client A and Client B start from current state
      const clientADoc = new Y.Doc();
      Y.applyUpdate(clientADoc, Y.encodeStateAsUpdate(serverDoc));
      const clientANodes = clientADoc.getArray<ASTNode>('nodes');

      const clientBDoc = new Y.Doc();
      Y.applyUpdate(clientBDoc, Y.encodeStateAsUpdate(serverDoc));
      const clientBNodes = clientBDoc.getArray<ASTNode>('nodes');

      // Client A inserts Heading A at index 0
      const headingA = createNode('heading', rootId, 0, { content: 'Heading A by Client A', level: 1 });
      clientADoc.transact(() => {
        clientANodes.insert(0, [headingA]);
      });

      // Client B concurrently inserts Heading B at index 0
      const headingB = createNode('heading', rootId, 0, { content: 'Heading B by Client B', level: 2 });
      clientBDoc.transact(() => {
        clientBNodes.insert(0, [headingB]);
      });

      // Exchange updates
      const updateA = Y.encodeStateAsUpdate(clientADoc, Y.encodeStateVector(clientBDoc));
      const updateB = Y.encodeStateAsUpdate(clientBDoc, Y.encodeStateVector(clientADoc));

      Y.applyUpdate(clientBDoc, updateA);
      Y.applyUpdate(clientADoc, updateB);
      Y.applyUpdate(serverDoc, updateA);
      Y.applyUpdate(serverDoc, updateB);

      // Verify convergence
      const finalA = clientANodes.toArray();
      const finalB = clientBNodes.toArray();
      expect(JSON.stringify(finalA)).toBe(JSON.stringify(finalB));

      // Both inserted nodes and the existing node must survive (3 nodes total)
      expect(finalA.length).toBe(3);

      const foundHeadingA = finalA.find((n) => n.id === headingA.id);
      const foundHeadingB = finalA.find((n) => n.id === headingB.id);
      const foundPara = finalA.find((n) => n.id === existingPara.id);

      expect(foundHeadingA).toBeDefined();
      expect(foundHeadingB).toBeDefined();
      expect(foundPara).toBeDefined();

      // Verify all IDs are distinct and parentId is rootId
      const ids = finalA.map((n) => n.id);
      expect(new Set(ids).size).toBe(3);
      finalA.forEach((n) => {
        expect(n.parentId).toBe(rootId);
      });

      // Verify AST passes tree validation
      const canonicalAST = ASTCollaborationBridge.extractCanonicalAST(serverDoc, docId);
      expect(() => validateASTTree(canonicalAST)).not.toThrow();

      serverDoc.destroy();
      clientADoc.destroy();
      clientBDoc.destroy();
    });
  });

  describe('4. Delete vs Edit Conflict (Section 7)', () => {
    it('should identify structural conflict and maintain non-destructive validity', () => {
      const baseDoc = createDocumentAST('Delete vs Edit Spec');
      const targetId = baseDoc.children[1]!.id; // Target the paragraph

      // Client A deletes the node
      const opDelete: ASTOperation = {
        id: 'op_del',
        type: 'DELETE_NODE',
        nodeId: targetId,
        timestamp: 2000,
        clientId: 'ClientA',
      };

      // Client B concurrently edits the node
      const opEdit: ASTOperation = {
        id: 'op_edit',
        type: 'UPDATE_CONTENT',
        nodeId: targetId,
        newValue: 'Crucial edit made concurrently with deletion',
        timestamp: 2010,
        clientId: 'ClientB',
      };

      // 1. Conflict detection
      const conflict = ConflictResolutionEngine.detectConflict(baseDoc, opDelete, opEdit);
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('DELETE_EDIT_CONFLICT');
      expect(conflict?.nodeId).toBe(targetId);

      // 2. Non-destructive resolution preserves the edited content
      const mergeResult = ConflictResolutionEngine.mergeChanges(baseDoc, [opDelete], [opEdit]);
      expect(mergeResult.success).toBe(true);

      const preserved = mergeResult.mergedAST.children.find((c) => c.id === targetId) as ParagraphNode;
      expect(preserved).toBeDefined();
      expect(preserved.content).toBe('Crucial edit made concurrently with deletion');

      // 3. Document integrity validation
      expect(() => validateASTTree(mergeResult.mergedAST)).not.toThrow();
      expect(mergeResult.mergedAST.children.every((c) => c.parentId === baseDoc.id)).toBe(true);
    });
  });

  describe('5. Move/Reorder vs Edit (Section 8)', () => {
    it('should maintain stable node ID, apply edit to the correct node, and detect reordering', () => {
      const docId = 'doc_reorder_vs_edit';
      const rootId = `doc_${docId}`;

      const nodeA = createNode('paragraph', rootId, 0, { content: 'Node A' });
      const nodeB = createNode('paragraph', rootId, 1, { content: 'Node B - Target' });
      const nodeC = createNode('paragraph', rootId, 2, { content: 'Node C' });

      const baseAST: DocumentNode = {
        id: rootId,
        type: 'document',
        title: 'Reorder vs Edit Spec',
        version: 1,
        parentId: null,
        children: [cloneAST(nodeA), cloneAST(nodeB), cloneAST(nodeC)],
        order: 0,
        metadata: {},
      };

      // Client A reorders: moves nodeB to index 0: [B, A, C]
      const reorderedAST = cloneAST(baseAST);
      reorderedAST.children = [cloneAST(nodeB), cloneAST(nodeA), cloneAST(nodeC)];
      reorderedAST.children.forEach((c, i) => {
        c.order = i;
      });

      // Client B edits nodeB's content
      const editedAST = cloneAST(baseAST);
      const bInEdited = editedAST.children.find((c) => c.id === nodeB.id) as ParagraphNode;
      bInEdited.content = 'Node B - Concurrently Edited Content';

      // Verify reorder detection
      const diffReorder = ConflictResolutionEngine.compareVersions(baseAST, reorderedAST);
      expect(diffReorder.reordered.length).toBeGreaterThan(0);
      expect(diffReorder.reordered.some((r) => r.id === nodeB.id)).toBe(true);

      // Verify edit detection
      const diffEdit = ConflictResolutionEngine.compareVersions(baseAST, editedAST);
      expect(diffEdit.modified.length).toBe(1);
      expect(diffEdit.modified[0]!.id).toBe(nodeB.id);

      // Merge reordered order with edited content
      const mergedAST = cloneAST(reorderedAST);
      const targetInMerged = mergedAST.children.find((c) => c.id === nodeB.id) as ParagraphNode;
      targetInMerged.content = bInEdited.content;

      // Verify node integrity: nodeB ID unchanged, nodeA & nodeC content untouched
      expect(targetInMerged.id).toBe(nodeB.id);
      expect(targetInMerged.content).toBe('Node B - Concurrently Edited Content');

      const nodeAInMerged = mergedAST.children.find((c) => c.id === nodeA.id) as ParagraphNode;
      const nodeCInMerged = mergedAST.children.find((c) => c.id === nodeC.id) as ParagraphNode;
      expect(nodeAInMerged.content).toBe('Node A');
      expect(nodeCInMerged.content).toBe('Node C');

      // Verify tree validity
      expect(() => validateASTTree(mergedAST)).not.toThrow();
    });
  });

  describe('6. Multi-Client Stress Test (5 Concurrent Clients, Section 9)', () => {
    it('should converge 5 concurrent clients with mixed insert, update, delete, reorder ops into a valid AST', () => {
      const NUM_CLIENTS = 5;
      const docId = 'stress_5_clients';
      const rootId = `doc_${docId}`;

      const serverDoc = new Y.Doc();
      const serverNodes = serverDoc.getArray<ASTNode>('nodes');
      serverDoc.getMap('meta').set('id', rootId);
      serverDoc.getMap('meta').set('title', '5-Client Concurrent Spec');

      // Initial document has 3 nodes
      const initH1 = createNode('heading', rootId, 0, { content: 'Initial Title', level: 1 });
      const initP1 = createNode('paragraph', rootId, 1, { content: 'Initial Paragraph 1' });
      const initP2 = createNode('paragraph', rootId, 2, { content: 'Initial Paragraph 2' });
      serverDoc.transact(() => {
        serverNodes.push([initH1, initP1, initP2]);
      });

      // Instantiate 5 clients
      const clients = Array.from({ length: NUM_CLIENTS }, (_, i) => {
        const cDoc = new Y.Doc();
        Y.applyUpdate(cDoc, Y.encodeStateAsUpdate(serverDoc));
        return {
          id: `client_${i}`,
          doc: cDoc,
          nodes: cDoc.getArray<ASTNode>('nodes'),
        };
      });

      // Setup mesh network
      setupYjsMesh([serverDoc, ...clients.map((c) => c.doc)]);

      // Client 0: Inserts 2 paragraphs
      clients[0]!.doc.transact(() => {
        const pA = createNode('paragraph', rootId, 3, { content: 'Client 0 Paragraph A' });
        const pB = createNode('paragraph', rootId, 4, { content: 'Client 0 Paragraph B' });
        clients[0]!.nodes.push([pA, pB]);
      });

      // Client 1: Updates initial paragraph and inserts CodeBlock
      clients[1]!.doc.transact(() => {
        const existing = clients[1]!.nodes.toArray();
        const p1 = existing.find((n) => n.id === initP1.id);
        if (p1) {
          const idx = existing.indexOf(p1);
          const updated = { ...cloneAST(p1), content: 'Client 1 Updated Initial P1' };
          clients[1]!.nodes.delete(idx, 1);
          clients[1]!.nodes.insert(idx, [updated]);
        }
        const code = createNode('code_block', rootId, 5, { language: 'typescript', content: 'const ok = true;' });
        clients[1]!.nodes.push([code]);
      });

      // Client 2: Inserts a list with nested items
      clients[2]!.doc.transact(() => {
        const list = createNode('list', rootId, 6, { listType: 'bullet' });
        list.children = [
          createNode('list_item', list.id, 0, { content: 'Item 1' }) as any,
          createNode('list_item', list.id, 1, { content: 'Item 2' }) as any,
        ];
        clients[2]!.nodes.push([list]);
      });

      // Client 3: Deletes initial paragraph 2 and inserts blockquote
      clients[3]!.doc.transact(() => {
        const existing = clients[3]!.nodes.toArray();
        const p2 = existing.find((n) => n.id === initP2.id);
        if (p2) {
          const idx = existing.indexOf(p2);
          clients[3]!.nodes.delete(idx, 1);
        }
        const quote = createNode('blockquote', rootId, 7, { content: 'CRDT convergence is guaranteed' });
        clients[3]!.nodes.push([quote]);
      });

      // Client 4: Inserts divider and re-orders items
      clients[4]!.doc.transact(() => {
        const div = createNode('divider', rootId, 8, {});
        clients[4]!.nodes.push([div]);
      });

      // Verification: All 5 clients and server have identical state
      const baselineJson = JSON.stringify(serverNodes.toArray());
      for (const client of clients) {
        expect(JSON.stringify(client.nodes.toArray())).toBe(baselineJson);
      }

      // Verify canonical AST structural integrity
      const finalAST = ASTCollaborationBridge.extractCanonicalAST(serverDoc, docId);
      expect(() => validateASTTree(finalAST)).not.toThrow();

      // Verify no duplicate IDs
      const allIds: string[] = [];
      const collectIds = (node: ASTNode) => {
        allIds.push(node.id);
        if (node.children) node.children.forEach(collectIds);
      };
      finalAST.children.forEach(collectIds);
      expect(new Set(allIds).size).toBe(allIds.length);

      // Verify all top-level children have correct parentId
      for (const child of finalAST.children) {
        expect(child.parentId).toBe(rootId);
      }

      serverDoc.destroy();
      clients.forEach((c) => c.doc.destroy());
    });
  });

  describe('7 & 8. Persistence and Monotonic Version History (Sections 10 & 11)', () => {
    it('should persist converged state to MongoDB with matching version, immutable snapshots, and no regression', async () => {
      // 1. Create document in DB
      const initialAST = createDocumentAST('Collaboration Persistence Spec');
      const doc = await DocumentModel.create({
        title: 'Collaboration Persistence Spec',
        version: 1,
        root: initialAST,
        activeCollaborators: [],
      });
      const docId = doc._id.toString();

      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: initialAST,
        author: 'Init',
        changeDescription: 'Initial setup',
        nodeCount: initialAST.children.length + 1,
      });

      // 2. Connect client and join session
      const client = await createTestClient();
      const syncPromise = new Promise<void>((r) => client.once('yjs-sync', () => r()));
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_p1', userName: 'PersistTester', userColor: '#333' },
      });
      await syncPromise;

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || initialAST.id;

      // Collaborative change 1: Add Paragraph 1 (V1 -> V2)
      const cDoc1 = new Y.Doc();
      Y.applyUpdate(cDoc1, Y.encodeStateAsUpdate(session.doc));
      cDoc1.getArray('nodes').push([createNode('paragraph', rootId, 2, { content: 'Version 2 addition' })]);
      const update1 = Y.encodeStateAsUpdate(cDoc1, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(update1) });
      await new Promise((r) => setTimeout(r, 50));

      await wsServer.flushDocumentSave(docId);

      const dbDocV2 = await DocumentModel.findById(docId).lean();
      expect(dbDocV2?.version).toBe(2);

      // Collaborative change 2: Add Paragraph 2 (V2 -> V3)
      const cDoc2 = new Y.Doc();
      Y.applyUpdate(cDoc2, Y.encodeStateAsUpdate(session.doc));
      cDoc2.getArray('nodes').push([createNode('paragraph', rootId, 3, { content: 'Version 3 addition' })]);
      const update2 = Y.encodeStateAsUpdate(cDoc2, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(update2) });
      await new Promise((r) => setTimeout(r, 50));

      await wsServer.flushDocumentSave(docId);

      const dbDocV3 = await DocumentModel.findById(docId).lean();
      expect(dbDocV3?.version).toBe(3);

      // Collaborative change 3: Add Paragraph 3 (V3 -> V4)
      const cDoc3 = new Y.Doc();
      Y.applyUpdate(cDoc3, Y.encodeStateAsUpdate(session.doc));
      cDoc3.getArray('nodes').push([createNode('paragraph', rootId, 4, { content: 'Version 4 addition' })]);
      const update3 = Y.encodeStateAsUpdate(cDoc3, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(update3) });
      await new Promise((r) => setTimeout(r, 50));

      await wsServer.flushDocumentSave(docId);

      const dbDocV4 = await DocumentModel.findById(docId).lean();
      expect(dbDocV4?.version).toBe(4);

      // Verify all version snapshots in MongoDB
      const versions = await DocumentVersionModel.find({ documentId: docId }).sort({ versionNumber: 1 }).lean();
      expect(versions.length).toBe(4);

      // Verify strictly monotonic version numbers: [1, 2, 3, 4]
      expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3, 4]);

      // Verify Document.version equals latest DocumentVersion.versionNumber
      const latestSnapshot = versions[versions.length - 1]!;
      expect(dbDocV4?.version).toBe(latestSnapshot.versionNumber);

      // Verify canonical AST matches latest snapshot
      const finalCanonical = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);
      expect(dbDocV4?.root.children.length).toBe(finalCanonical.children.length);
      expect(latestSnapshot.astSnapshot.children.length).toBe(finalCanonical.children.length);

      // Verify historical snapshot immutability: V1 snapshot still has initial node count
      expect(versions[0]!.astSnapshot.children.length).toBe(initialAST.children.length);
      expect(versions[1]!.astSnapshot.children.length).toBe(initialAST.children.length + 1);
      expect(versions[2]!.astSnapshot.children.length).toBe(initialAST.children.length + 2);
      expect(versions[3]!.astSnapshot.children.length).toBe(initialAST.children.length + 3);

      // Cleanup
      client.disconnect();
      cDoc1.destroy();
      cDoc2.destroy();
      cDoc3.destroy();
    });
  });

  describe('9. Invalid Concurrent State Rejection (Section 12)', () => {
    it('should reject malformed update via trial doc, protect live session, and accept subsequent valid update', async () => {
      const initialAST = createDocumentAST('Trial Protection Spec');
      const doc = await DocumentModel.create({
        title: 'Trial Protection Spec',
        version: 1,
        root: initialAST,
        activeCollaborators: [],
      });
      const docId = doc._id.toString();

      const client = await createTestClient();
      const syncPromise = new Promise<void>((r) => client.once('yjs-sync', () => r()));
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_sec', userName: 'SecurityTester', userColor: '#999' },
      });
      await syncPromise;

      const session = wsServer.getSession(docId)!;
      const initialCount = session.doc.getArray('nodes').length;
      const rootId = (session.doc.getMap('meta').get('id') as string) || initialAST.id;

      // 1. Create an invalid update: duplicate node ID violating AST tree integrity
      const existingId = (session.doc.getArray('nodes').get(0) as any).id;
      const badDoc = new Y.Doc();
      Y.applyUpdate(badDoc, Y.encodeStateAsUpdate(session.doc));
      badDoc.getArray('nodes').push([
        {
          id: existingId, // Duplicate ID
          type: 'paragraph',
          content: 'Illegal duplicate node',
          parentId: rootId,
          children: [],
          order: 99,
        } as any,
      ]);
      const badUpdate = Y.encodeStateAsUpdate(badDoc, Y.encodeStateVector(session.doc));

      const warningPromise = new Promise<{ message: string; error?: string }>((resolve) => {
        client.once('ast-warning', (data) => resolve(data));
      });

      client.emit('yjs-update', { documentId: docId, update: Array.from(badUpdate) });

      const warning = await warningPromise;
      expect(warning).toBeDefined();
      expect(warning.error).toMatch(/Duplicate node ID/);

      // Verify live Y.Doc was NOT modified
      expect(session.doc.getArray('nodes').length).toBe(initialCount);

      // 2. Now send a subsequent valid update
      const goodDoc = new Y.Doc();
      Y.applyUpdate(goodDoc, Y.encodeStateAsUpdate(session.doc));
      const validNode = createNode('paragraph', rootId, initialCount, { content: 'Valid Follow-up Node' });
      goodDoc.getArray('nodes').push([validNode]);
      const goodUpdate = Y.encodeStateAsUpdate(goodDoc, Y.encodeStateVector(session.doc));

      client.emit('yjs-update', { documentId: docId, update: Array.from(goodUpdate) });
      await new Promise((r) => setTimeout(r, 60));

      // Live doc accepted the valid update
      expect(session.doc.getArray('nodes').length).toBe(initialCount + 1);

      client.disconnect();
      badDoc.destroy();
      goodDoc.destroy();
    });
  });

  describe('10. In-Flight Save Race Condition (Section 13)', () => {
    it('should not lose updates that arrive while database persistence is actively in-flight', async () => {
      const initialAST = createDocumentAST('Race Condition Test Spec');
      const doc = await DocumentModel.create({
        title: 'Race Condition Test Spec',
        version: 1,
        root: initialAST,
        activeCollaborators: [],
      });
      const docId = doc._id.toString();

      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: initialAST,
        author: 'Init',
        changeDescription: 'Initial setup',
        nodeCount: initialAST.children.length + 1,
      });

      const client = await createTestClient();
      const syncPromise = new Promise<void>((r) => client.once('yjs-sync', () => r()));
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_race', userName: 'RaceTester', userColor: '#555' },
      });
      await syncPromise;

      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || initialAST.id;

      // Update 1 arrives: adds paragraph 1
      const cDoc1 = new Y.Doc();
      Y.applyUpdate(cDoc1, Y.encodeStateAsUpdate(session.doc));
      const p1 = createNode('paragraph', rootId, 2, { content: 'Update 1 before save' });
      cDoc1.getArray('nodes').push([p1]);
      const u1 = Y.encodeStateAsUpdate(cDoc1, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u1) });
      await new Promise((r) => setTimeout(r, 30));

      // Start flushing save 1 (which will be in-flight)
      const savePromise1 = wsServer.flushDocumentSave(docId);

      // Concurrently, while savePromise1 is in-flight, Update 2 arrives!
      const cDoc2 = new Y.Doc();
      Y.applyUpdate(cDoc2, Y.encodeStateAsUpdate(session.doc));
      const p2 = createNode('paragraph', rootId, 3, { content: 'Update 2 IN-FLIGHT during save' });
      cDoc2.getArray('nodes').push([p2]);
      const u2 = Y.encodeStateAsUpdate(cDoc2, Y.encodeStateVector(session.doc));
      client.emit('yjs-update', { documentId: docId, update: Array.from(u2) });
      await new Promise((r) => setTimeout(r, 30));

      // Wait for the first save to finish
      await savePromise1;

      // Verify that session.hasUnsavedChanges remained true and did NOT get wiped!
      expect(session.hasUnsavedChanges).toBe(true);

      // Now trigger/flush the follow-up save
      await wsServer.flushDocumentSave(docId);

      // Verify MongoDB has the final state with BOTH Update 1 and Update 2
      const finalDBDoc = await DocumentModel.findById(docId).lean();
      expect(finalDBDoc?.version).toBe(3); // V1 -> V2 (update 1) -> V3 (update 2)

      const finalNodes = finalDBDoc?.root.children || [];
      const hasP1 = finalNodes.some((n: any) => n.id === p1.id);
      const hasP2 = finalNodes.some((n: any) => n.id === p2.id);

      expect(hasP1).toBe(true);
      expect(hasP2).toBe(true);

      client.disconnect();
      cDoc1.destroy();
      cDoc2.destroy();
    });
  });
});
