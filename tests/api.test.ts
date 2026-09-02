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

  it('DELETE /api/documents/:id should delete document', async () => {
    const res = await request(app).delete(`/api/documents/${createdDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
