import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OAuth2Client } from 'google-auth-library';
import { app } from '../server/src/server.js';
import { UserModel } from '../server/src/models/User.js';
import { TeamMemberModel } from '../server/src/models/TeamMember.js';

describe('SyncDoc Authentication & Account Security Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let testUserToken: string;
  let testUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Local Email / Password Registration & Login', () => {
    it('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ fullName: '', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ fullName: 'Alice Developer', email: 'invalid-email-format', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('valid email');
    });

    it('should reject registration with password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ fullName: 'Alice Developer', email: 'alice@syncdoc.io', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('at least 6 characters');
    });

    it('should successfully register a new user and return JWT session token', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          fullName: 'Alice Developer',
          email: 'alice@syncdoc.io',
          password: 'securePassword123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('alice@syncdoc.io');
      expect(res.body.user.name).toBe('Alice Developer');
      expect(res.body.user.userColor).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined(); // never expose hash in response

      testUserToken = res.body.token;
      testUserId = res.body.user.userId;

      // Verify user was persisted with hashed password in database
      const dbUser = await UserModel.findOne({ email: 'alice@syncdoc.io' });
      expect(dbUser).toBeDefined();
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe('securePassword123!');

      // Verify team member roster was upserted for presence
      const teamMember = await TeamMemberModel.findOne({ userId: testUserId });
      expect(teamMember).toBeDefined();
      expect(teamMember?.userName).toBe('Alice Developer');
    });

    it('should prevent duplicate registration with the same email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          fullName: 'Alice Clone',
          email: 'alice@syncdoc.io',
          password: 'differentPassword!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should successfully log in with valid credentials and return JWT session', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alice@syncdoc.io',
          password: 'securePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.userId).toBe(testUserId);
      expect(res.body.user.name).toBe('Alice Developer');
    });

    it('should support case-insensitive email login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'ALICE@SyncDoc.IO',
          password: 'securePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.userId).toBe(testUserId);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'alice@syncdoc.io',
          password: 'incorrectPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid password');
    });

    it('should reject login for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nobody@syncdoc.io',
          password: 'somePassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No account found');
    });
  });

  describe('Session Validation (GET /api/auth/me) & Logout', () => {
    it('should reject /api/auth/me when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject /api/auth/me with invalid or forged token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged-fake-jwt-token-12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('invalid or expired');
    });

    it('should validate and return user profile for valid session token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.userId).toBe(testUserId);
      expect(res.body.user.email).toBe('alice@syncdoc.io');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should return 200 on /api/auth/logout', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Google OAuth Sign-In & Safe Account Linking', () => {
    it('should reject Google login if token/credential is missing', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should reject Google login if GOOGLE_CLIENT_ID is not configured on server', async () => {
      const originalClientId = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'mock-google-credential' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('GOOGLE_CLIENT_ID');

      process.env.GOOGLE_CLIENT_ID = originalClientId || 'test-client-id.apps.googleusercontent.com';
    });

    it('should reject Google login with an invalid or tampered token', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'invalid-untrusted-token-from-client' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('untrusted Google credential');
    });

    it('should reject Google login if Google claims unverified email', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      const verifySpy = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_unverified_123',
          email: 'unverified@gmail.com',
          email_verified: false,
          name: 'Unverified User',
        }),
      } as any);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'mock-valid-signature-token' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unverified Google email');

      verifySpy.mockRestore();
    });

    it('should successfully authenticate fresh Google user and create account', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      const verifySpy = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_sub_987654321',
          email: 'bob.google@gmail.com',
          email_verified: true,
          name: 'Bob Google',
          picture: 'https://lh3.googleusercontent.com/bob-avatar.png',
        }),
      } as any);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'verified-google-id-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('bob.google@gmail.com');
      expect(res.body.user.name).toBe('Bob Google');
      expect(res.body.user.avatarUrl).toBe('https://lh3.googleusercontent.com/bob-avatar.png');
      expect(res.body.user.authProvider).toBe('google');

      // Verify stored in DB
      const dbUser = await UserModel.findOne({ googleId: 'google_sub_987654321' });
      expect(dbUser).toBeDefined();
      expect(dbUser?.email).toBe('bob.google@gmail.com');

      verifySpy.mockRestore();
    });

    it('should prevent duplicate accounts on subsequent Google logins for the same user', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      const verifySpy = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_sub_987654321',
          email: 'bob.google@gmail.com',
          email_verified: true,
          name: 'Bob Google',
          picture: 'https://lh3.googleusercontent.com/bob-avatar.png',
        }),
      } as any);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'verified-google-id-token-again' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const count = await UserModel.countDocuments({ googleId: 'google_sub_987654321' });
      expect(count).toBe(1);

      verifySpy.mockRestore();
    });

    it('should safely link Google account to existing user with matching verified email', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      // Alice already exists with email 'alice@syncdoc.io' from previous local test
      const verifySpy = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_sub_alice_456',
          email: 'alice@syncdoc.io',
          email_verified: true,
          name: 'Alice Developer',
          picture: 'https://lh3.googleusercontent.com/alice-avatar.png',
        }),
      } as any);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'alice-google-verified-id-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.userId).toBe(testUserId); // linked to existing user ID!

      // Verify Google ID was linked to Alice
      const updatedAlice = await UserModel.findOne({ userId: testUserId });
      expect(updatedAlice?.googleId).toBe('google_sub_alice_456');

      verifySpy.mockRestore();
    });
  });
});
