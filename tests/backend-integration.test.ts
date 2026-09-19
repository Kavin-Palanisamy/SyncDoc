import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import * as Y from 'yjs';
import {
  ASTNode,
  DocumentNode,
  createNode,
  cloneAST,
  countNodes,
  ASTOperation,
} from '@syncdoc/shared';
import { app, server, io, wsCollaborationServer } from '../server/src/server.js';
import { DocumentModel } from '../server/src/models/Document.js';
import { DocumentVersionModel } from '../server/src/models/DocumentVersion.js';
import { ASTCollaborationBridge } from '../server/src/collaboration/ASTCollaborationBridge.js';

describe('STEP 10: End-to-End Backend Integration Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let serverPort: number;
  let testDocId: string;

  beforeAll(async () => {
    // Disconnect any existing mongoose connection before binding to memory server
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 5059;
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

  // 15. Health Check Endpoint
  describe('15. Health Check Endpoint', () => {
    it('GET /api/health should return 200 with service metadata', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.service).toBe('SyncDoc Collaborative Engine');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  // 1 & 2. Create and Retrieve Document through REST
  describe('1 & 2. REST Document Lifecycle', () => {
    it('1. POST /api/documents should create document and initial V1 snapshot', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Full Integration Technical Spec' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.title).toBe('Full Integration Technical Spec');
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.root).toBeDefined();

      testDocId = res.body.data._id;

      // Verify V1 version snapshot was created
      const snapshots = await DocumentVersionModel.find({ documentId: testDocId });
      expect(snapshots.length).toBe(1);
      expect(snapshots[0]!.versionNumber).toBe(1);
      expect(snapshots[0]!.nodeCount).toBeGreaterThanOrEqual(2);
    });

    it('2. GET /api/documents/:id should retrieve the created document', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testDocId);
      expect(res.body.data.title).toBe('Full Integration Technical Spec');
    });

    it('GET /api/documents should list documents with pagination', async () => {
      const res = await request(app).get('/api/documents?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });
  });

  // 3 & 4. AST Retrieval and Update
  describe('3 & 4. AST Operations through REST', () => {
    it('3. GET /api/documents/:id/ast should return the root DocumentNode', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/ast`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('document');
      expect(res.body.data.children).toBeDefined();
      expect(res.body.data.id).toBeDefined();
    });

    it('4. PUT /api/documents/:id/ast should update tree and advance version to 2', async () => {
      const getRes = await request(app).get(`/api/documents/${testDocId}/ast`);
      const currentRoot = getRes.body.data as DocumentNode;

      const newPara = createNode('paragraph', currentRoot.id, currentRoot.children.length, {
        content: 'Integrated REST update paragraph.',
      });
      currentRoot.children.push(newPara);

      const putRes = await request(app)
        .put(`/api/documents/${testDocId}/ast`)
        .send({ root: currentRoot, author: 'REST Tester', changeDescription: 'Added paragraph via REST' });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.children.length).toBe(currentRoot.children.length);

      // Verify MongoDB document version incremented to 2
      const updatedInDB = await DocumentModel.findById(testDocId);
      expect(updatedInDB?.version).toBe(2);
    });
  });

  // 5 & 6. Version Snapshot Creation and History Retrieval
  describe('5 & 6. Version History', () => {
    it('5. POST /api/documents/:id/versions should create an explicit snapshot (V3)', async () => {
      const res = await request(app)
        .post(`/api/documents/${testDocId}/versions`)
        .send({ author: 'Release Manager', changeDescription: 'Pre-release milestone snapshot' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.versionNumber).toBe(3);
      expect(res.body.data.author).toBe('Release Manager');
    });

    it('6. GET /api/documents/:id/versions should retrieve descending version history', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/versions`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].versionNumber).toBe(3);
      expect(res.body.data[1].versionNumber).toBe(2);
      expect(res.body.data[2].versionNumber).toBe(1);
    });
  });

  // 7 & 12. Rollback and Historical Immutability
  describe('7 & 12. Rollback to Version & Snapshot Immutability', () => {
    it('7. POST /api/documents/:id/rollback/:version should restore V1 as a new monotonic version (V4)', async () => {
      const res = await request(app).post(`/api/documents/${testDocId}/rollback/1`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBe(4);

      // Verify DB version is 4
      const dbDoc = await DocumentModel.findById(testDocId);
      expect(dbDoc?.version).toBe(4);
    });

    it('12. Historical snapshots must remain completely immutable after rollback', async () => {
      const versions = await DocumentVersionModel.find({ documentId: testDocId }).sort({ versionNumber: 1 });
      expect(versions.length).toBe(4);
      expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3, 4]);

      // V1 snapshot has original child count
      const v1Snapshot = versions[0]!;
      expect(v1Snapshot.versionNumber).toBe(1);
      expect(v1Snapshot.changeDescription).toBe('Initial document creation');

      // V2 snapshot still reflects the paragraph addition
      const v2Snapshot = versions[1]!;
      expect(v2Snapshot.versionNumber).toBe(2);
      expect(v2Snapshot.astSnapshot.children.length).toBe(v1Snapshot.astSnapshot.children.length + 1);

      // V4 snapshot has same content as V1 but new monotonic version number
      const v4Snapshot = versions[3]!;
      expect(v4Snapshot.versionNumber).toBe(4);
      expect(v4Snapshot.astSnapshot.children.length).toBe(v1Snapshot.astSnapshot.children.length);
    });
  });

  // 8. Export Document
  describe('8. Multi-Format Export', () => {
    it('GET /api/documents/:id/export/html should export sanitized HTML', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/export/html`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<article class="syncdoc-document"');
    });

    it('GET /api/documents/:id/export/pdf should export printable HTML', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/export/pdf`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('@media print');
    });

    it('GET /api/documents/:id/export/markdown should export Markdown', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/export/markdown`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.text.length).toBeGreaterThan(0);
    });

    it('GET /api/documents/:id/export/json should export JSON AST', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/export/json`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      const parsed = JSON.parse(res.text);
      expect(parsed.type).toBe('document');
      expect(parsed.id).toBeDefined();
    });
  });

  // 9. Import Markdown & AST
  describe('9. Document Import', () => {
    it('POST /api/documents/import should create a new document from Markdown', async () => {
      const markdown = '# Imported Spec Title\n\nThis is an imported paragraph with *emphasis*.\n\n```typescript\nconst x = 42;\n```';
      const res = await request(app)
        .post('/api/documents/import')
        .send({ markdown, title: 'Imported Spec Document' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Imported Spec Document');
      expect(res.body.data.root.children.length).toBeGreaterThanOrEqual(3);

      const importedDocId = res.body.data._id;
      const dbDoc = await DocumentModel.findById(importedDocId);
      expect(dbDoc).toBeDefined();
    });

    it('POST /api/documents/:id/import should update existing document from AST', async () => {
      const getRes = await request(app).get(`/api/documents/${testDocId}/ast`);
      const ast = getRes.body.data as DocumentNode;
      ast.title = 'Imported Updated Title';

      const res = await request(app)
        .post(`/api/documents/${testDocId}/import`)
        .send({ root: ast, title: 'Imported Updated Title' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Imported Updated Title');
      expect(res.body.data.version).toBe(5);
    });
  });

  // 10. Conflict Merge
  describe('10. Semantic Conflict Merge', () => {
    it('POST /api/documents/:id/merge should perform 3-way merge and update document', async () => {
      const getRes = await request(app).get(`/api/documents/${testDocId}/ast`);
      const baseAST = getRes.body.data as DocumentNode;

      const localOp: ASTOperation = {
        id: 'op_local_1',
        type: 'INSERT_NODE',
        nodeId: 'para_local_1',
        targetParentId: baseAST.id,
        targetIndex: 1,
        nodeData: {
          id: 'para_local_1',
          type: 'paragraph',
          content: 'Local branch addition.',
          parentId: baseAST.id,
          children: [],
          order: 1,
        } as any,
        clientId: 'client_local',
        timestamp: Date.now(),
      };

      const remoteOp: ASTOperation = {
        id: 'op_remote_1',
        type: 'INSERT_NODE',
        nodeId: 'para_remote_1',
        targetParentId: baseAST.id,
        targetIndex: 2,
        nodeData: {
          id: 'para_remote_1',
          type: 'paragraph',
          content: 'Remote branch addition.',
          parentId: baseAST.id,
          children: [],
          order: 2,
        } as any,
        clientId: 'client_remote',
        timestamp: Date.now(),
      };

      const res = await request(app)
        .post(`/api/documents/${testDocId}/merge`)
        .send({
          baseAST,
          localOperations: [localOp],
          remoteOperations: [remoteOp],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mergedAST).toBeDefined();
      expect(res.body.data.document).toBeDefined();
      expect(res.body.data.document.version).toBe(6);
    });
  });

  // 11. Malformed AST Rejection
  describe('11. Malformed AST Validation & Rejection', () => {
    it('PUT /api/documents/:id/ast should return 400 when AST contains duplicate IDs', async () => {
      const getRes = await request(app).get(`/api/documents/${testDocId}/ast`);
      const badAST = getRes.body.data as DocumentNode;

      // Duplicate an ID
      badAST.children.push({
        id: badAST.children[0]!.id,
        type: 'paragraph',
        content: 'Duplicate ID',
        parentId: badAST.id,
        children: [],
        order: 99,
      } as any);

      const res = await request(app)
        .put(`/api/documents/${testDocId}/ast`)
        .send({ root: badAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Duplicate node ID');
    });

    it('PUT /api/documents/:id/ast should return 400 when AST contains invalid node type', async () => {
      const getRes = await request(app).get(`/api/documents/${testDocId}/ast`);
      const badAST = getRes.body.data as DocumentNode;

      badAST.children.push({
        id: 'node_invalid_type',
        type: 'evil_script' as any,
        content: 'hack',
        parentId: badAST.id,
        children: [],
        order: 99,
      } as any);

      const res = await request(app)
        .put(`/api/documents/${testDocId}/ast`)
        .send({ root: badAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid node type');
    });
  });

  // 13 & 14. Real-Time WebSocket Collaboration & Persistence Verification
  describe('13 & 14. WebSocket Collaborative Editing & Convergence', () => {
    it('13 & 14. Collaborative Yjs update should modify server AST and persist to MongoDB', async () => {
      const client = await createTestClient();

      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: testDocId,
          user: { userId: 'u_e2e', userName: 'Integration Collaborator', userColor: '#0a0' },
        });
      });

      const session = wsCollaborationServer.getSession(testDocId)!;
      expect(session).toBeDefined();

      const rootId = (session.doc.getMap('meta').get('id') as string) || testDocId;
      const initialNodeCount = session.doc.getArray('nodes').length;

      // Collaborator creates a code block update
      const cDoc = new Y.Doc();
      Y.applyUpdate(cDoc, Y.encodeStateAsUpdate(session.doc));
      const codeNode = createNode('code_block', rootId, initialNodeCount, {
        language: 'typescript',
        content: 'export const status = "converged";',
      });
      cDoc.getArray('nodes').push([codeNode]);
      const updateDelta = Y.encodeStateAsUpdate(cDoc, Y.encodeStateVector(session.doc));

      // Emit update to WebSocket server
      client.emit('yjs-update', { documentId: testDocId, update: Array.from(updateDelta) });
      await new Promise((r) => setTimeout(r, 60));

      // Verify canonical AST on server now includes the code block
      // Flush persistence to MongoDB
      await wsCollaborationServer.flushDocumentSave(testDocId);

      // Verify canonical AST on server now includes the code block and matches DB
      const canonicalAST = ASTCollaborationBridge.extractCanonicalAST(session.doc, testDocId);
      expect(canonicalAST.children.length).toBe(initialNodeCount + 1);

      // 14. Verify persisted MongoDB document matches canonical collaboration state
      const dbDoc = await DocumentModel.findById(testDocId).lean();
      expect(dbDoc?.root.children.length).toBe(canonicalAST.children.length);
      expect(dbDoc?.version).toBe(canonicalAST.version);

      // Verify latest version snapshot also matches
      const latestSnapshot = await DocumentVersionModel.findOne({ documentId: testDocId }).sort({ versionNumber: -1 });
      expect(latestSnapshot?.versionNumber).toBe(dbDoc?.version);
      expect(latestSnapshot?.astSnapshot.children.length).toBe(canonicalAST.children.length);

      client.disconnect();
      cDoc.destroy();
      await new Promise((r) => setTimeout(r, 100));
    });
  });

  // 16. Controlled Errors for Invalid IDs
  describe('16. Controlled Error Responses for Invalid ObjectIds', () => {
    it('GET /api/documents/invalid-id should return controlled 404 without leaking internals', async () => {
      const res = await request(app).get('/api/documents/not-a-valid-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
      expect(res.body.error).not.toContain('CastError');
      expect(res.body.error).not.toContain('C:\\');
      expect(res.body.error).not.toContain('mongodb://');
    });

    it('GET /api/documents/507f1f77bcf86cd799439011 (nonexistent) should return 404', async () => {
      const res = await request(app).get('/api/documents/507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  // 17. Controlled Errors for Invalid Versions
  describe('17. Controlled Errors for Invalid Version Numbers', () => {
    it('POST /api/documents/:id/rollback/abc should return 400 for non-numeric version', async () => {
      const res = await request(app).post(`/api/documents/${testDocId}/rollback/not-a-number`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid version number');
    });

    it('POST /api/documents/:id/rollback/0 should return 400 for non-positive version', async () => {
      const res = await request(app).post(`/api/documents/${testDocId}/rollback/0`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid version number');
    });

    it('POST /api/documents/:id/rollback/9999 should return 404 for nonexistent version', async () => {
      const res = await request(app).post(`/api/documents/${testDocId}/rollback/9999`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  // 18. Unsupported Export Format Handling
  describe('18. Unsupported Export Format Handling', () => {
    it('GET /api/documents/:id/export/yaml should return 400 with allowed formats', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}/export/yaml`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unsupported export format');
      expect(res.body.error).toContain('Allowed formats: html, pdf, markdown, json');
    });
  });

  // 19. Session Cleanup & Resource Safety
  describe('19. Session Cleanup & Resource Safety', () => {
    it('should evict session when all users leave and saves complete', async () => {
      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Cleanup Isolation Document' });
      const cleanupDocId = res.body.data._id;

      const client = await createTestClient();

      await new Promise<void>((r) => {
        client.once('yjs-sync', () => r());
        client.emit('join-document', {
          documentId: cleanupDocId,
          user: { userId: 'u_cleanup', userName: 'CleanupUser', userColor: '#333' },
        });
      });

      expect(wsCollaborationServer.getSession(cleanupDocId)).toBeDefined();

      // Disconnect
      client.disconnect();
      await new Promise((r) => setTimeout(r, 300));

      // Active session evicted
      expect(wsCollaborationServer.getSession(cleanupDocId)).toBeUndefined();
    });
  });
});
