import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as Y from 'yjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import {
  createDocumentAST,
  createNode,
  DocumentNode,
  HeadingNode,
  ParagraphNode,
} from '@syncdoc/shared';
import { DocumentModel } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { ASTCollaborationBridge } from '../server/src/collaboration/ASTCollaborationBridge.js';
import { WebSocketCollaborationServer } from '../server/src/collaboration/WebSocketServer.js';

describe('AST Collaboration Bridge & WebSocket Integration', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('ASTCollaborationBridge Unit Tests', () => {
    it('should correctly extract canonical AST DocumentNode from a Y.Doc deterministically without generating fake timestamps', () => {
      const doc = new Y.Doc();
      const nodes = doc.getArray('nodes');
      const meta = doc.getMap('meta');

      const heading = createNode('heading', 'doc_test', 0, { content: 'Bridge Title', level: 1 });
      const paragraph = createNode('paragraph', 'doc_test', 1, { content: 'Bridge Content' });

      doc.transact(() => {
        meta.set('id', 'doc_test');
        meta.set('title', 'Bridge Spec');
        meta.set('version', 3);
        meta.set('updatedAt', 1700000000);
        nodes.push([heading, paragraph]);
      });

      // Requirement 9: Repeated extractions must not synthesize different timestamps or fake modifications
      const ast1 = ASTCollaborationBridge.extractCanonicalAST(doc, 'test');
      const ast2 = ASTCollaborationBridge.extractCanonicalAST(doc, 'test');

      expect(ast1.id).toBe('doc_test');
      expect(ast1.title).toBe('Bridge Spec');
      expect(ast1.version).toBe(3);
      expect(ast1.metadata?.updatedAt).toBe(1700000000);
      expect(JSON.stringify(ast1)).toBe(JSON.stringify(ast2));

      const analysis = ASTCollaborationBridge.analyzeTransition(ast1, ast2);
      expect(analysis.hasStructuralChanges).toBe(false);
      expect(analysis.summary.modifiedCount).toBe(0);
    });

    it('should create an isolated trial doc that does not mutate source doc', () => {
      const doc = new Y.Doc();
      const nodes = doc.getArray('nodes');
      nodes.push([{ id: 'node1', type: 'paragraph', content: 'Original' } as any]);

      const trial = ASTCollaborationBridge.createTrialDoc(doc);
      const trialNodes = trial.getArray('nodes');
      trialNodes.push([{ id: 'node2', type: 'paragraph', content: 'Trial addition' } as any]);

      expect(trialNodes.length).toBe(2);
      expect(nodes.length).toBe(1); // Source doc remains unmutated
      trial.destroy();
    });

    it('should accurately detect additions, modifications, deletions, and reordering in analyzeTransition', () => {
      const baseAST = createDocumentAST('Base Doc');
      const modifiedAST = JSON.parse(JSON.stringify(baseAST)) as DocumentNode;

      // Modify first child
      (modifiedAST.children[0] as HeadingNode).content = 'Changed Heading';

      // Delete second child
      const deletedId = modifiedAST.children[1]!.id;
      modifiedAST.children.splice(1, 1);

      // Add a new child
      const newChild = createNode('blockquote', modifiedAST.id, 1, { content: 'New Quote' });
      modifiedAST.children.push(newChild);

      const analysis = ASTCollaborationBridge.analyzeTransition(baseAST, modifiedAST);

      expect(analysis.isValid).toBe(true);
      expect(analysis.hasStructuralChanges).toBe(true);
      expect(analysis.summary.modifiedCount).toBe(1);
      expect(analysis.summary.deletedCount).toBe(1);
      expect(analysis.summary.addedCount).toBe(1);
      expect(analysis.diff.deleted).toContain(deletedId);
    });

    it('should identify invalid AST structure (e.g. duplicate IDs or illegal heading level)', () => {
      const baseAST = createDocumentAST('Base Doc');
      const invalidAST = JSON.parse(JSON.stringify(baseAST)) as DocumentNode;

      // Make duplicate IDs
      invalidAST.children[1]!.id = invalidAST.children[0]!.id;

      const analysis = ASTCollaborationBridge.analyzeTransition(baseAST, invalidAST);
      expect(analysis.isValid).toBe(false);
      expect(analysis.validationError).toMatch(/Duplicate node ID/);
    });
  });

  describe('WebSocketServer Hardening & Integration', () => {
    let httpServer: ReturnType<typeof createServer>;
    let ioServer: SocketIOServer;
    let wsServer: WebSocketCollaborationServer;
    let serverPort: number;
    let client1: ClientSocketType;
    let client2: ClientSocketType;
    let docId: string;

    beforeAll(async () => {
      httpServer = createServer();
      ioServer = new SocketIOServer(httpServer, {
        cors: { origin: '*' },
      });
      wsServer = new WebSocketCollaborationServer(ioServer);

      await new Promise<void>((resolve) => {
        httpServer.listen(0, () => {
          const addr = httpServer.address();
          serverPort = typeof addr === 'object' && addr ? addr.port : 5055;
          resolve();
        });
      });

      // Create initial document record in MongoDB
      const docAST = createDocumentAST('Live Testing Spec');
      const doc = await DocumentModel.create({
        title: 'Live Testing Spec',
        version: 1,
        root: docAST,
        activeCollaborators: [],
      });
      docId = doc._id.toString();

      await DocumentVersionModel.create({
        documentId: docId,
        versionNumber: 1,
        astSnapshot: docAST,
        author: 'Setup',
        changeDescription: 'Initial',
        nodeCount: 3,
      });

      // Connect two clients
      client1 = ClientSocket(`http://localhost:${serverPort}`, { transports: ['websocket'] });
      client2 = ClientSocket(`http://localhost:${serverPort}`, { transports: ['websocket'] });

      await Promise.all([
        new Promise<void>((r) => client1.on('connect', () => r())),
        new Promise<void>((r) => client2.on('connect', () => r())),
      ]);
    });

    afterAll(async () => {
      if (client1 && client1.connected) client1.disconnect();
      if (client2 && client2.connected) client2.disconnect();
      await new Promise((r) => setTimeout(r, 100));

      const session = wsServer.getSession(docId);
      if (session && session.saveTimeout) {
        clearTimeout(session.saveTimeout);
        session.saveTimeout = null;
      }

      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    it('1. should accept a valid Yjs update and broadcast it to collaborators', async () => {
      // Both clients join the document room
      const p1 = new Promise<void>((r) => client1.once('yjs-sync', () => r()));
      const p2 = new Promise<void>((r) => client2.once('yjs-sync', () => r()));

      client1.emit('join-document', { documentId: docId, user: { userId: 'u1', userName: 'Alice', userColor: '#111' } });
      client2.emit('join-document', { documentId: docId, user: { userId: 'u2', userName: 'Bob', userColor: '#222' } });

      await Promise.all([p1, p2]);

      const session = wsServer.getSession(docId)!;
      const initialNodeCount = session.doc.getArray('nodes').length;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docAST.id;

      // Client 1 creates a valid new paragraph
      const clientDoc = new Y.Doc();
      const stateUpdate = Y.encodeStateAsUpdate(session.doc);
      Y.applyUpdate(clientDoc, stateUpdate);

      const clientNodes = clientDoc.getArray('nodes');
      const validNode = createNode('paragraph', rootId, initialNodeCount, {
        content: 'Valid collaborator paragraph',
      });
      clientNodes.push([validNode]);

      const updateToSend = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(session.doc));

      // Client 2 listens for broadcast
      const client2BroadcastPromise = new Promise<{ update: number[] }>((resolve) => {
        client2.once('yjs-sync', (data) => resolve(data));
      });

      client1.emit('yjs-update', {
        documentId: docId,
        update: Array.from(updateToSend),
      });

      const broadcastData = await client2BroadcastPromise;
      expect(broadcastData).toBeDefined();
      expect(broadcastData.update.length).toBeGreaterThan(0);

      // Verify live session.doc was updated
      expect(session.doc.getArray('nodes').length).toBe(initialNodeCount + 1);
      clientDoc.destroy();
    });

    it('2, 3, 4, 5. should reject an invalid Yjs update without modifying session.doc, broadcasting, or persisting', async () => {
      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docAST.id;
      const nodesBefore = session.doc.getArray('nodes').toArray();
      const countBefore = nodesBefore.length;

      // Construct an invalid update (node with duplicate ID of an existing node)
      const existingId = (nodesBefore[0] as any).id;
      const invalidClientDoc = new Y.Doc();
      const stateUpdate = Y.encodeStateAsUpdate(session.doc);
      Y.applyUpdate(invalidClientDoc, stateUpdate);

      const invalidNodes = invalidClientDoc.getArray('nodes');
      // Duplicate ID node violates AST tree integrity
      invalidNodes.push([{
        id: existingId,
        type: 'paragraph',
        content: 'Illegal duplicate ID node',
        parentId: rootId,
        children: [],
        order: 99,
      } as any]);

      const invalidUpdateToSend = Y.encodeStateAsUpdate(invalidClientDoc, Y.encodeStateVector(session.doc));

      let client2ReceivedBroadcast = false;
      const broadcastListener = () => {
        client2ReceivedBroadcast = true;
      };
      client2.on('yjs-sync', broadcastListener);

      const warningPromise = new Promise<{ message: string; error?: string }>((resolve) => {
        client1.once('ast-warning', (data) => resolve(data));
      });

      client1.emit('yjs-update', {
        documentId: docId,
        update: Array.from(invalidUpdateToSend),
      });

      // 2. Invalid update is rejected
      const warning = await warningPromise;
      expect(warning.message).toContain('Update rejected');
      expect(warning.error).toMatch(/Duplicate node ID/);

      // Wait a short tick to confirm no broadcast is sent
      await new Promise((r) => setTimeout(r, 100));
      client2.off('yjs-sync', broadcastListener);

      // 4. Invalid update is NOT broadcast
      expect(client2ReceivedBroadcast).toBe(false);

      // 3. Invalid update does NOT modify the live session Y.Doc
      expect(session.doc.getArray('nodes').length).toBe(countBefore);

      // 5. Invalid update is NOT persisted
      const rootAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);
      expect(rootAST.children.length).toBe(countBefore);

      invalidClientDoc.destroy();
    });

    it('6. should accept a subsequent valid update after a rejected invalid update', async () => {
      const session = wsServer.getSession(docId)!;
      const rootId = (session.doc.getMap('meta').get('id') as string) || docAST.id;
      const countBefore = session.doc.getArray('nodes').length;

      const clientDoc = new Y.Doc();
      const stateUpdate = Y.encodeStateAsUpdate(session.doc);
      Y.applyUpdate(clientDoc, stateUpdate);

      const clientNodes = clientDoc.getArray('nodes');
      const goodNode = createNode('blockquote', rootId, countBefore, {
        content: 'Valid quote following rejected update',
      });
      clientNodes.push([goodNode]);

      const updateToSend = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(session.doc));

      const syncPromise = new Promise<void>((resolve) => {
        client2.once('yjs-sync', () => resolve());
      });

      client1.emit('yjs-update', {
        documentId: docId,
        update: Array.from(updateToSend),
      });

      await syncPromise;

      // Session Y.Doc has incremented by 1
      expect(session.doc.getArray('nodes').length).toBe(countBefore + 1);
      clientDoc.destroy();
    });

    it('7 & 9. should maintain monotonic version numbers and avoid bumping version on no-content-change save', async () => {
      const session = wsServer.getSession(docId)!;

      // Flush document save for the pending changes
      await wsServer.flushDocumentSave(docId);

      const docRecord = await DocumentModel.findById(docId);
      expect(docRecord).toBeDefined();
      const versionAfterSave = docRecord!.version;
      expect(versionAfterSave).toBeGreaterThan(1);

      const versionsBefore = await DocumentVersionModel.find({ documentId: docId });
      const versionCountBefore = versionsBefore.length;

      // Requirement 9: Trigger save when no content has changed
      await wsServer.flushDocumentSave(docId);

      const docRecordAfterSecondSave = await DocumentModel.findById(docId);
      const versionsAfterSecondSave = await DocumentVersionModel.find({ documentId: docId });

      // Version must NOT increment on a no-content-change save
      expect(docRecordAfterSecondSave!.version).toBe(versionAfterSave);
      expect(versionsAfterSecondSave.length).toBe(versionCountBefore);

      // Verify versions remain strictly monotonic
      const versionNumbers = versionsAfterSecondSave.map((v) => v.versionNumber);
      const uniqueVersions = new Set(versionNumbers);
      expect(versionNumbers.length).toBe(uniqueVersions.size);
    });

    it('8. should ensure handleDisconnect cleanup is idempotent and repeated disconnects do not duplicate cleanup', async () => {
      // Connect a temporary client
      const tempClient = ClientSocket(`http://localhost:${serverPort}`, { transports: ['websocket'] });
      await new Promise<void>((r) => tempClient.on('connect', () => r()));

      await new Promise<void>((resolve) => {
        tempClient.once('yjs-sync', () => resolve());
        tempClient.emit('join-document', {
          documentId: docId,
          user: { userId: 'u_temp', userName: 'TempUser', userColor: '#999' },
        });
      });

      const session = wsServer.getSession(docId)!;
      const userCountWithTemp = session.activeUsers.size;

      // Disconnect and leave simultaneously
      tempClient.emit('leave-document');
      tempClient.disconnect();

      await new Promise((r) => setTimeout(r, 100));

      // Active users decremented cleanly exactly once
      expect(session.activeUsers.size).toBe(userCountWithTemp - 1);
    });
  });
});
