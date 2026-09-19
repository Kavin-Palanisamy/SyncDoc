import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import * as Y from 'yjs';
import {
  DocumentNode,
  createNode,
  cloneAST,
} from '@syncdoc/shared';
import { app, server, io, wsCollaborationServer } from '../server/src/server.js';
import { DocumentModel } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { ASTCollaborationBridge } from '../server/src/collaboration/ASTCollaborationBridge.js';

describe('REST ↔ Active Yjs Session Consistency', () => {
  let mongoServer: MongoMemoryServer;
  let serverPort: number;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 5061;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wsCollaborationServer.destroy();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const createTestClient = async (): Promise<ClientSocketType> => {
    const socket = ClientSocket(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      socket.on('connect', () => resolve());
    });
    return socket;
  };

  // TASK 2: Reproduction Test
  it('TASK 2: should synchronize active in-memory Y.Doc when AST is updated via REST', async () => {
    // 1. Create document via REST
    const createRes = await request(app)
      .post('/api/documents')
      .send({ title: 'Active Session Doc' });
    expect(createRes.status).toBe(201);
    const docId = createRes.body.data._id;
    const initialAST = createRes.body.data.root as DocumentNode;

    // 2. Client joins document room via WebSocket
    const client = await createTestClient();
    let initialSyncReceived = false;
    let clientYDoc = new Y.Doc();

    await new Promise<void>((resolve) => {
      client.once('yjs-sync', (payload: { documentId: string; update: number[] }) => {
        Y.applyUpdate(clientYDoc, new Uint8Array(payload.update));
        initialSyncReceived = true;
        resolve();
      });
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_active', userName: 'ActiveUser', userColor: '#123456' },
      });
    });

    expect(initialSyncReceived).toBe(true);

    // 3. Verify session is active in memory
    const session = wsCollaborationServer.getSession(docId);
    expect(session).toBeDefined();

    // 4. Perform REST AST update
    const updatedAST = cloneAST(initialAST);
    const newPara = createNode('paragraph', updatedAST.id, 99, {
      content: 'Inserted via REST while Yjs session was active',
    });
    updatedAST.children.push(newPara);

    // Listen for any broadcasted Yjs update on the connected client
    let syncBroadcastReceived = false;
    client.on('yjs-sync', (payload: { documentId: string; update: number[] }) => {
      Y.applyUpdate(clientYDoc, new Uint8Array(payload.update));
      syncBroadcastReceived = true;
    });

    const putRes = await request(app)
      .put(`/api/documents/${docId}/ast`)
      .send({
        root: updatedAST,
        author: 'REST Auditor',
        changeDescription: 'Concurrent REST update test',
      });
    expect(putRes.status).toBe(200);

    // 5. Verify persisted MongoDB AST
    const dbDoc = await DocumentModel.findById(docId).lean();
    expect(dbDoc).toBeDefined();
    expect(dbDoc!.root.children.some((c: any) => c.content === 'Inserted via REST while Yjs session was active')).toBe(true);

    // 6. Verify active in-memory Y.Doc state
    const canonicalASTFromYDoc = ASTCollaborationBridge.extractCanonicalAST(session!.doc, docId);

    // Invariant: Live Y.Doc AST == Canonical AST == MongoDB Document AST
    expect(canonicalASTFromYDoc.children.some((c) => c.content === 'Inserted via REST while Yjs session was active')).toBe(true);

    // 7. Verify connected client received the sync update and converged
    const clientCanonicalAST = ASTCollaborationBridge.extractCanonicalAST(clientYDoc, docId);
    expect(clientCanonicalAST.children.some((c) => c.content === 'Inserted via REST while Yjs session was active')).toBe(true);

    client.disconnect();
  });

  // TASK 4: Concurrent WebSocket update + REST AST update + persistence safety
  it('TASK 4: should handle concurrent WebSocket update and REST AST update deterministically', async () => {
    const createRes = await request(app)
      .post('/api/documents')
      .send({ title: 'Race Condition Test Doc' });
    const docId = createRes.body.data._id;
    const initialAST = createRes.body.data.root as DocumentNode;

    const client = await createTestClient();
    const clientYDoc = new Y.Doc();

    await new Promise<void>((resolve) => {
      client.once('yjs-sync', (payload: { documentId: string; update: number[] }) => {
        Y.applyUpdate(clientYDoc, new Uint8Array(payload.update));
        resolve();
      });
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_race', userName: 'RaceUser', userColor: '#abcdef' },
      });
    });

    const session = wsCollaborationServer.getSession(docId);
    expect(session).toBeDefined();

    // Prepare WebSocket client edit: add a node to clientYDoc and capture update
    let wsDelta: Uint8Array | null = null;
    const updateHandler = (update: Uint8Array) => {
      wsDelta = update;
    };
    clientYDoc.on('update', updateHandler);
    const wsNode = createNode('paragraph', initialAST.id, 10, { content: 'Added via concurrent WebSocket' });
    const clientNodes = clientYDoc.getArray<any>('nodes');
    clientNodes.push([wsNode]);
    clientYDoc.off('update', updateHandler);

    // Prepare REST edit
    const restAST = cloneAST(initialAST);
    const restNode = createNode('paragraph', restAST.id, 20, { content: 'Added via concurrent REST' });
    restAST.children.push(restNode);

    // Fire both updates concurrently
    await Promise.all([
      new Promise<void>((resolve) => {
        client.emit('yjs-update', { documentId: docId, update: Array.from(wsDelta!) });
        setTimeout(resolve, 50);
      }),
      request(app)
        .put(`/api/documents/${docId}/ast`)
        .send({
          root: restAST,
          author: 'Concurrent REST User',
          changeDescription: 'Concurrent REST update',
        }),
    ]);

    // Flush any pending persistence
    await wsCollaborationServer.flushDocumentSave(docId);

    // Verify DB state is valid and non-corrupt
    const dbDoc = await DocumentModel.findById(docId).lean();
    expect(dbDoc).toBeDefined();
    expect(dbDoc!.version).toBeGreaterThanOrEqual(2);

    // Extract canonical AST and verify tree integrity
    const canonicalAST = ASTCollaborationBridge.extractCanonicalAST(session!.doc, docId);
    expect(canonicalAST).toBeDefined();
    expect(canonicalAST.children.length).toBeGreaterThan(initialAST.children.length);

    client.disconnect();
  });

  // TASK 5: Version history consistency during mixed REST and WebSocket operations
  it('TASK 5: should maintain strictly monotonic versions and immutable snapshots across mixed updates', async () => {
    // 1. Initial creation -> v1
    const createRes = await request(app)
      .post('/api/documents')
      .send({ title: 'Version History Monotonicity Doc' });
    const docId = createRes.body.data._id;
    const initialAST = createRes.body.data.root as DocumentNode;

    const client = await createTestClient();
    const clientYDoc = new Y.Doc();

    await new Promise<void>((resolve) => {
      client.once('yjs-sync', (payload: { documentId: string; update: number[] }) => {
        Y.applyUpdate(clientYDoc, new Uint8Array(payload.update));
        resolve();
      });
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_version', userName: 'VersionUser', userColor: '#999999' },
      });
    });

    const session = wsCollaborationServer.getSession(docId)!;

    // 2. REST update -> should create v2
    const v2AST = cloneAST(initialAST);
    v2AST.children.push(createNode('paragraph', v2AST.id, 5, { content: 'V2 Content via REST' }));
    const putRes = await request(app)
      .put(`/api/documents/${docId}/ast`)
      .send({ root: v2AST, author: 'REST v2' });
    expect(putRes.status).toBe(200);

    // 3. WebSocket update -> should save v3
    let v3Delta: Uint8Array | null = null;
    const updateHandler = (update: Uint8Array) => {
      v3Delta = update;
    };
    session.doc.on('update', updateHandler);
    session.doc.transact(() => {
      session.doc.getArray<any>('nodes').push([
        createNode('paragraph', v2AST.id, 6, { content: 'V3 Content via WebSocket' }),
      ]);
    });
    session.doc.off('update', updateHandler);

    session.hasUnsavedChanges = true;
    session.changeCount++;
    await wsCollaborationServer.flushDocumentSave(docId);

    // 4. Another REST update -> should create v4
    const v3DB = await DocumentModel.findById(docId).lean();
    const v4AST = cloneAST(v3DB!.root);
    v4AST.children.push(createNode('paragraph', v4AST.id, 7, { content: 'V4 Content via REST' }));
    const putRes2 = await request(app)
      .put(`/api/documents/${docId}/ast`)
      .send({ root: v4AST, author: 'REST v4' });
    expect(putRes2.status).toBe(200);

    // 5. Query all versions
    const versions = await DocumentVersionModel.find({ documentId: docId }).sort({ versionNumber: 1 });
    expect(versions.length).toBe(4);

    const versionNumbers = versions.map((v) => v.versionNumber);
    expect(versionNumbers).toEqual([1, 2, 3, 4]);

    // Check historical snapshot immutability
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.astSnapshot.children.length).toBe(initialAST.children.length);

    expect(versions[1]!.versionNumber).toBe(2);
    expect(versions[1]!.astSnapshot.children.length).toBe(initialAST.children.length + 1);

    expect(versions[2]!.versionNumber).toBe(3);
    expect(versions[2]!.astSnapshot.children.length).toBe(initialAST.children.length + 2);

    expect(versions[3]!.versionNumber).toBe(4);
    expect(versions[3]!.astSnapshot.children.length).toBe(initialAST.children.length + 3);

    // Latest snapshot matches DB document and live Y.Doc
    const latestDB = await DocumentModel.findById(docId).lean();
    expect(latestDB!.version).toBe(4);
    const liveCanonical = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);
    expect(liveCanonical.version).toBe(4);

    client.disconnect();
  });

  // TASK 6: Invalid REST update rejection while WebSocket session is active
  it('TASK 6: should reject invalid REST AST update without corrupting active Y.Doc or MongoDB', async () => {
    const createRes = await request(app)
      .post('/api/documents')
      .send({ title: 'Invalid REST Update Safety Doc' });
    const docId = createRes.body.data._id;
    const initialAST = createRes.body.data.root as DocumentNode;

    const client = await createTestClient();
    const clientYDoc = new Y.Doc();

    await new Promise<void>((resolve) => {
      client.once('yjs-sync', (payload: { documentId: string; update: number[] }) => {
        Y.applyUpdate(clientYDoc, new Uint8Array(payload.update));
        resolve();
      });
      client.emit('join-document', {
        documentId: docId,
        user: { userId: 'u_invalid_test', userName: 'InvalidTestUser', userColor: '#ff0000' },
      });
    });

    const session = wsCollaborationServer.getSession(docId)!;
    expect(session).toBeDefined();

    // Snapshot pre-state
    const preDB = await DocumentModel.findById(docId).lean();
    const preVersions = await DocumentVersionModel.find({ documentId: docId });
    const preCanonicalAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);

    // Track any yjs-sync broadcasted to client
    let invalidBroadcastReceived = false;
    client.on('yjs-sync', () => {
      invalidBroadcastReceived = true;
    });

    // Send invalid AST via REST (invalid heading level = 99)
    const badAST = cloneAST(initialAST);
    (badAST.children[0] as any).level = 99;

    const putRes = await request(app)
      .put(`/api/documents/${docId}/ast`)
      .send({ root: badAST, author: 'Malicious REST User' });

    // 1. HTTP request is rejected (400 Bad Request)
    expect(putRes.status).toBe(400);
    expect(putRes.body.success).toBe(false);

    // 2. MongoDB remains unchanged
    const postDB = await DocumentModel.findById(docId).lean();
    expect(postDB!.version).toBe(preDB!.version);
    expect(postDB!.root).toEqual(preDB!.root);

    // 3. Live Y.Doc in memory remains unchanged
    const postCanonicalAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, docId);
    expect(postCanonicalAST).toEqual(preCanonicalAST);

    // 4. No invalid state was broadcast to connected client
    expect(invalidBroadcastReceived).toBe(false);

    // 5. Historical versions remain unchanged
    const postVersions = await DocumentVersionModel.find({ documentId: docId });
    expect(postVersions.length).toBe(preVersions.length);

    client.disconnect();
  });
});

