import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../server/src/server.js';
import { createDocumentAST } from '../shared/src/index.js';

describe('SyncDoc REST API Endpoints', () => {
  let mongoServer: MongoMemoryServer;
  let createdDocId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('POST /api/documents should create a new document with valid AST', async () => {
    const res = await request(app)
      .post('/api/documents')
      .send({ title: 'API Test Document' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.title).toBe('API Test Document');
    createdDocId = res.body.data._id;
  });

  it('GET /api/documents should return a list of documents', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/documents/:id should retrieve a single document by ID', async () => {
    const res = await request(app).get(`/api/documents/${createdDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(createdDocId);
    expect(res.body.data.root).toBeDefined();
  });

  it('PUT /api/documents/:id should update title and AST', async () => {
    const updatedAST = createDocumentAST('Updated API Document Title', 2);
    const res = await request(app)
      .put(`/api/documents/${createdDocId}`)
      .send({
        title: 'Updated API Document Title',
        root: updatedAST,
        author: 'Test Bot',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated API Document Title');
  });

  it('GET /api/documents/:id/versions should return version history', async () => {
    const res = await request(app).get(`/api/documents/${createdDocId}/versions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/documents/:id/versions/:v/rollback should rollback to previous version', async () => {
    const res = await request(app).post(`/api/documents/${createdDocId}/versions/1/rollback`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBeGreaterThan(1);
  });

  it('GET /api/documents/:id/export?format=html should export HTML', async () => {
    const res = await request(app).get(`/api/documents/${createdDocId}/export?format=html`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
  });

  it('GET /api/documents/:id/export?format=markdown should export Markdown', async () => {
    const res = await request(app).get(`/api/documents/${createdDocId}/export?format=markdown`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/markdown');
  });

  it('POST /api/documents/import should import Markdown and create document', async () => {
    const md = '# Imported Technical Doc\n\n- Point 1\n- Point 2';
    const res = await request(app).post('/api/documents/import').send({ markdown: md });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Imported Technical Doc');
  });

  it('POST /api/conflict/merge should execute conflict merge engine via API', async () => {
    const baseAST = createDocumentAST('Base Merge');
    const nodeId = baseAST.children[1]!.id;

    const res = await request(app)
      .post('/api/conflict/merge')
      .send({
        baseAST,
        localOperations: [
          {
            id: 'op1',
            type: 'UPDATE_CONTENT',
            nodeId,
            newValue: 'Local change',
            timestamp: 100,
            clientId: 'c1',
          },
        ],
        remoteOperations: [
          {
            id: 'op2',
            type: 'UPDATE_CONTENT',
            nodeId,
            newValue: 'Remote change',
            timestamp: 200,
            clientId: 'c2',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conflicts.length).toBe(1);
  });

  // --- STEP 4 HARDENING TESTS ---

  describe('AST Validation at Write Boundaries & Document Creation', () => {
    it('POST /api/documents should reject creation with invalid root type', async () => {
      const invalidAST = {
        id: 'bad_doc',
        type: 'paragraph', // Must be 'document'
        content: 'Invalid Root',
        parentId: null,
        children: [],
        order: 0,
      };

      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Bad Type Doc', root: invalidAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Root node must be of type 'document'/);
    });

    it('POST /api/documents should reject creation with duplicate node IDs in AST', async () => {
      const root = createDocumentAST('Duplicate ID Test');
      root.children[1]!.id = root.children[0]!.id; // Duplicate ID

      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Duplicate ID Doc', root });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Duplicate node ID/);
    });

    it('POST /api/documents should reject creation with invalid heading level', async () => {
      const root = createDocumentAST('Invalid Heading Test');
      (root.children[0] as any).level = 9;

      const res = await request(app)
        .post('/api/documents')
        .send({ title: 'Invalid Level Doc', root });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/must have a level between 1 and 6/);
    });
  });

  describe('AST Update Hardening (PUT /api/documents/:id/ast)', () => {
    it('PUT /api/documents/:id/ast should accept valid AST update', async () => {
      const doc = await request(app).get(`/api/documents/${createdDocId}`);
      const validAST = doc.body.data.root;
      validAST.children[0].content = 'Valid Content Modification via PUT AST';

      const res = await request(app)
        .put(`/api/documents/${createdDocId}/ast`)
        .send({ root: validAST, author: 'Harness Test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.children[0].content).toBe('Valid Content Modification via PUT AST');
    });

    it('PUT /api/documents/:id/ast should reject invalid AST and leave database unchanged', async () => {
      const beforeRes = await request(app).get(`/api/documents/${createdDocId}`);
      const beforeContent = beforeRes.body.data.root.children[0].content;
      const beforeVersion = beforeRes.body.data.version;

      const invalidAST = JSON.parse(JSON.stringify(beforeRes.body.data.root));
      invalidAST.children[1].id = invalidAST.children[0].id; // Duplicate ID

      const res = await request(app)
        .put(`/api/documents/${createdDocId}/ast`)
        .send({ root: invalidAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Duplicate node ID/);

      // Verify database state is completely unchanged
      const afterRes = await request(app).get(`/api/documents/${createdDocId}`);
      expect(afterRes.body.data.version).toBe(beforeVersion);
      expect(afterRes.body.data.root.children[0].content).toBe(beforeContent);
    });
  });

  describe('Rollback Safety & Immutability', () => {
    it('POST /api/documents/:id/rollback/:version should rollback and leave historical snapshot unchanged', async () => {
      // 1. Get version 1 snapshot content
      const historyRes = await request(app).get(`/api/documents/${createdDocId}/versions`);
      const v1Snapshot = historyRes.body.data.find((v: any) => v.versionNumber === 1);
      expect(v1Snapshot).toBeDefined();
      const v1HeadingContent = v1Snapshot.astSnapshot.children[0].content;

      // 2. Perform rollback to version 1 using the alias route
      const rollbackRes = await request(app).post(`/api/documents/${createdDocId}/rollback/1`);
      expect(rollbackRes.status).toBe(200);
      expect(rollbackRes.body.success).toBe(true);
      const newCurrentVersion = rollbackRes.body.data.version;
      expect(newCurrentVersion).toBeGreaterThan(1);

      // 3. Verify historical version 1 snapshot in DB was NOT mutated
      const afterHistoryRes = await request(app).get(`/api/documents/${createdDocId}/versions`);
      const v1AfterRollback = afterHistoryRes.body.data.find((v: any) => v.versionNumber === 1);
      expect(v1AfterRollback.astSnapshot.version).toBe(1); // Historical version remains 1
      expect(v1AfterRollback.astSnapshot.children[0].content).toBe(v1HeadingContent);

      // 4. Verify new current snapshot was created for the rollback version
      const newSnapshot = afterHistoryRes.body.data.find((v: any) => v.versionNumber === newCurrentVersion);
      expect(newSnapshot).toBeDefined();
      expect(newSnapshot.versionNumber).toBe(newCurrentVersion);
      expect(newSnapshot.changeDescription).toContain('Rolled back to version 1');
    });
  });

  describe('Import Safety & Validation Pipeline', () => {
    it('POST /api/documents/import should accept valid AST tree import', async () => {
      const validAST = createDocumentAST('Direct AST Import Spec');
      const res = await request(app)
        .post('/api/documents/import')
        .send({ root: validAST });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Direct AST Import Spec');
      expect(res.body.data.version).toBe(1);
    });

    it('POST /api/documents/import should reject invalid AST tree import', async () => {
      const invalidAST = createDocumentAST('Bad AST Import');
      invalidAST.children[1]!.id = invalidAST.children[0]!.id; // Duplicate ID

      const res = await request(app)
        .post('/api/documents/import')
        .send({ root: invalidAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Duplicate node ID/);
    });

    it('POST /api/documents/import should reject non-array children in AST', async () => {
      const badAST = createDocumentAST('Bad Children Import');
      (badAST as any).children = 'not an array';

      const res = await request(app)
        .post('/api/documents/import')
        .send({ root: badAST });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid children/i);
    });
  });

  describe('Strict Monotonic Versioning', () => {
    it('should maintain strictly monotonic versions across multiple updates without duplicates', async () => {
      const docRes = await request(app)
        .post('/api/documents')
        .send({ title: 'Monotonic Version Test Doc' });
      const testDocId = docRes.body.data._id;

      // Make 3 sequential updates
      await request(app).put(`/api/documents/${testDocId}`).send({ title: 'Update 1' });
      await request(app).put(`/api/documents/${testDocId}`).send({ title: 'Update 2' });
      await request(app).put(`/api/documents/${testDocId}`).send({ title: 'Update 3' });

      const historyRes = await request(app).get(`/api/documents/${testDocId}/versions`);
      expect(historyRes.status).toBe(200);
      const versions = historyRes.body.data.map((v: any) => v.versionNumber);

      // Verify versions are strictly unique and sorted descending
      const uniqueVersions = new Set(versions);
      expect(versions.length).toBe(uniqueVersions.size);
      expect(versions).toEqual([4, 3, 2, 1]);

      // Clean up
      await request(app).delete(`/api/documents/${testDocId}`);
    });
  });

  describe('Comprehensive Error Handling', () => {
    it('GET /api/documents/:id should return 404 for non-existent document ID', async () => {
      const res = await request(app).get('/api/documents/000000000000000000000000');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/documents/:id should return 404 for invalid/malformed ObjectId', async () => {
      const res = await request(app).get('/api/documents/non_existent_doc_id_123');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/documents/:id/rollback/:version should return 400 for invalid version format', async () => {
      const res = await request(app).post(`/api/documents/${createdDocId}/rollback/invalid_version`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid version number');
    });

    it('POST /api/documents/:id/rollback/:version should return 404 for non-existent version number', async () => {
      const res = await request(app).post(`/api/documents/${createdDocId}/rollback/9999`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Version 9999 not found');
    });

    it('GET /api/documents/:id/export should return 400 for unsupported format', async () => {
      const res = await request(app).get(`/api/documents/${createdDocId}/export?format=exe`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unsupported export format');
    });
  });

  it('DELETE /api/documents/:id should delete document', async () => {
    const res = await request(app).delete(`/api/documents/${createdDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
