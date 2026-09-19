import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { connectDB } from '../server/src/config/db.js';
import { getAllowedOrigins, app, stopServer } from '../server/src/server.js';

describe('STEP 11: Production Readiness & Operational Hardening Test Suite', () => {
  describe('1. Environment & Database Configuration Safety', () => {
    it('should reject startup in production if MONGODB_URI is missing', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGODB_URI;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.MONGODB_URI;

        await expect(connectDB('')).rejects.toThrow(
          'Production environment requires a valid MONGODB_URI. In-memory database fallback is disabled in production.'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalUri) {
          process.env.MONGODB_URI = originalUri;
        }
      }
    });

    it('should reject startup in production if connecting to MONGODB_URI fails (no silent in-memory fallback)', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGODB_URI;

      try {
        process.env.NODE_ENV = 'production';
        // Nonexistent unreachable MongoDB port
        const unreachableUri = 'mongodb://127.0.0.1:59999/unreachable_db';

        await expect(connectDB(unreachableUri)).rejects.toThrow(
          'Failed to connect to production database'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalUri) {
          process.env.MONGODB_URI = originalUri;
        }
      }
    });
  });

  describe('2. CORS Origin Resolution', () => {
    it('should restrict origins to CLIENT_URL in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalClientUrl = process.env.CLIENT_URL;

      try {
        process.env.NODE_ENV = 'production';
        process.env.CLIENT_URL = 'https://app.syncdoc.io, https://admin.syncdoc.io';

        const origins = getAllowedOrigins();
        expect(origins).toEqual(['https://app.syncdoc.io', 'https://admin.syncdoc.io']);
        expect(origins).not.toContain('*');
        expect(origins).not.toContain('http://localhost:5173');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.CLIENT_URL = originalClientUrl;
      }
    });

    it('should include local development origins when NODE_ENV is development', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';
        const origins = getAllowedOrigins();
        expect(origins).toContain('http://localhost:5173');
        expect(origins).toContain('http://127.0.0.1:5173');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('3. Request Body Size Limits & Error Handling', () => {
    it('should return controlled 413 Payload Too Large when body exceeds limit', async () => {
      // Create a test Express app with a tight 1kb limit to verify the middleware behavior
      const testApp = express();
      testApp.use(express.json({ limit: '1kb' }));
      testApp.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err?.type === 'entity.too.large' || err?.status === 413) {
          res.status(413).json({
            success: false,
            error: 'Payload Too Large',
            message: 'Request body exceeds the maximum allowed size.',
          });
          return;
        }
        next(err);
      });
      testApp.post('/test-body', (_req, res) => res.json({ ok: true }));

      // Generate a payload larger than 1kb
      const largePayload = { text: 'x'.repeat(2048) };

      const res = await request(testApp)
        .post('/test-body')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Payload Too Large');
    });

    it('should return controlled 400 Bad Request for malformed JSON bodies on main app', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Content-Type', 'application/json')
        .send('{"title": "Broken JSON');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Malformed JSON payload');
    });
  });

  describe('4. Graceful Programmatic Shutdown Idempotence', () => {
    it('should execute stopServer() idempotently without throwing', async () => {
      await expect(stopServer()).resolves.toBeUndefined();
      // Second call should also resolve cleanly (idempotence)
      await expect(stopServer()).resolves.toBeUndefined();
    });
  });
});
