import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../models/User.js';
import { TeamMemberModel } from '../models/TeamMember.js';

const JWT_SECRET = process.env.JWT_SECRET || 'syncdoc-jwt-session-secret-production-and-dev-2026';
const JWT_EXPIRES_IN = '7d';

const USER_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)] || '#3b82f6';
}

export class AuthController {
  private static oauthClient: OAuth2Client | null = null;

  private static getOAuthClient(): OAuth2Client {
    if (!AuthController.oauthClient) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      AuthController.oauthClient = new OAuth2Client(clientId);
    }
    return AuthController.oauthClient;
  }

  /**
   * Generates a signed JWT session token for an authenticated user
   */
  public static generateSessionToken(user: { userId: string; email: string; name: string; role: string }): string {
    return jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * POST /api/auth/google
   * Verifies Google ID token / credential, deterministically links/creates user,
   * establishes authenticated application session.
   */
  public static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { idToken, credential } = req.body || {};
      const token = idToken || credential;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Google ID token or credential is required for Google authentication.',
        });
        return;
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        res.status(503).json({
          success: false,
          error: 'Google Authentication is not configured on the server. GOOGLE_CLIENT_ID environment variable is missing.',
        });
        return;
      }

      // Verify Google ID token using google-auth-library
      let ticket;
      try {
        const client = AuthController.getOAuthClient();
        ticket = await client.verifyIdToken({
          idToken: token,
          audience: googleClientId,
        });
      } catch (verifyErr: any) {
        console.error('[Google Auth] Token verification failed:', verifyErr?.message);
        res.status(401).json({
          success: false,
          error: 'Invalid, expired, or untrusted Google credential.',
          details: verifyErr?.message,
        });
        return;
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        res.status(401).json({
          success: false,
          error: 'Google token payload is missing required identity claims.',
        });
        return;
      }

      if (!payload.email_verified) {
        res.status(403).json({
          success: false,
          error: 'Unverified Google email address. Google account email must be verified to sign in.',
        });
        return;
      }

      const googleSub = payload.sub;
      const verifiedEmail = payload.email.toLowerCase().trim();
      const displayName = payload.name?.trim() || verifiedEmail.split('@')[0];
      const picture = payload.picture;

      // Safe Account Linking Strategy:
      // 1. Try to find user by existing googleId
      let user = await UserModel.findOne({ googleId: googleSub });

      if (!user) {
        // 2. Check if a user exists with the exact verified email
        const existingEmailUser = await UserModel.findOne({ email: verifiedEmail });

        if (existingEmailUser) {
          // Link Google identity to existing verified email account safely
          existingEmailUser.googleId = googleSub;
          if (picture && !existingEmailUser.avatarUrl) {
            existingEmailUser.avatarUrl = picture;
          }
          user = await existingEmailUser.save();
        } else {
          // 3. Create fresh user
          const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
          const userColor = getRandomColor();
          user = await UserModel.create({
            userId,
            email: verifiedEmail,
            name: displayName,
            googleId: googleSub,
            avatarUrl: picture,
            userColor,
            role: 'Member',
            authProvider: 'google',
          });
        }
      } else {
        // Update profile picture or name if changed in Google
        if (picture && user.avatarUrl !== picture) {
          user.avatarUrl = picture;
          await user.save();
        }
      }

      // Upsert TeamMember for real-time presence roster
      try {
        await TeamMemberModel.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            userName: user.name,
            userColor: user.userColor,
            role: user.role,
            lastSeen: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (presenceErr) {
        console.warn('[Google Auth] Failed to upsert team member presence:', presenceErr);
      }

      const sessionToken = AuthController.generateSessionToken({
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        token: sessionToken,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          userColor: user.userColor,
          avatarUrl: user.avatarUrl,
          role: user.role,
          authProvider: user.authProvider,
        },
      });
    } catch (error: any) {
      console.error('[Google Auth] Unexpected server error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unexpected internal error occurred during Google authentication.',
      });
    }
  }

  /**
   * POST /api/auth/login
   * Standard Email & Password authentication
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, email, password } = req.body || {};
      const loginId = (identifier || email || '').trim();

      if (!loginId || !password) {
        res.status(400).json({
          success: false,
          error: 'Email or username and password are required.',
        });
        return;
      }

      // Search by email (case-insensitive) or by display name
      const user = await UserModel.findOne({
        $or: [
          { email: loginId.toLowerCase() },
          { name: loginId },
        ],
      });

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials. No account found with the provided email or username.',
        });
        return;
      }

      if (!user.passwordHash) {
        res.status(400).json({
          success: false,
          error: 'This account was registered using Google Sign-In. Please click "Continue with Google" to log in.',
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: 'Invalid password. Please check your credentials and try again.',
        });
        return;
      }

      // Upsert TeamMember for real-time presence
      try {
        await TeamMemberModel.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            userName: user.name,
            userColor: user.userColor,
            role: user.role,
            lastSeen: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch {}

      const sessionToken = AuthController.generateSessionToken({
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        token: sessionToken,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          userColor: user.userColor,
          avatarUrl: user.avatarUrl,
          role: user.role,
          authProvider: user.authProvider,
        },
      });
    } catch (error: any) {
      console.error('[Auth Login] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error during authentication.',
      });
    }
  }

  /**
   * POST /api/auth/signup
   * Standard registration with password hashing
   */
  public static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { fullName, email, password } = req.body || {};

      if (!fullName || !email || !password) {
        res.status(400).json({
          success: false,
          error: 'Full name, email, and password are required.',
        });
        return;
      }

      const trimmedName = fullName.trim();
      const normalizedEmail = email.toLowerCase().trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.',
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long.',
        });
        return;
      }

      const existingUser = await UserModel.findOne({ email: normalizedEmail });
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'An account with this email already exists. Please log in.',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const userColor = getRandomColor();

      const user = await UserModel.create({
        userId,
        email: normalizedEmail,
        name: trimmedName,
        passwordHash,
        userColor,
        role: 'Member',
        authProvider: 'local',
      });

      // Upsert TeamMember for real-time presence
      try {
        await TeamMemberModel.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            userName: user.name,
            userColor: user.userColor,
            role: user.role,
            lastSeen: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch {}

      const sessionToken = AuthController.generateSessionToken({
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.status(201).json({
        success: true,
        token: sessionToken,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          userColor: user.userColor,
          avatarUrl: user.avatarUrl,
          role: user.role,
          authProvider: user.authProvider,
        },
      });
    } catch (error: any) {
      console.error('[Auth Signup] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error during registration.',
      });
    }
  }

  /**
   * GET /api/auth/me
   * Validates active session token and returns authenticated user profile
   */
  public static async getMe(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'No authentication token provided.',
        });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'No authentication token provided.',
        });
        return;
      }
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (tokenErr) {
        res.status(401).json({
          success: false,
          error: 'Session token is invalid or expired. Please log in again.',
        });
        return;
      }

      const user = await UserModel.findOne({ userId: decoded.userId }).select('-passwordHash');
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User associated with session token was not found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          userColor: user.userColor,
          avatarUrl: user.avatarUrl,
          role: user.role,
          authProvider: user.authProvider,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to authenticate user session.',
      });
    }
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }
}
