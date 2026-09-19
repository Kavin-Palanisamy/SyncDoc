import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB, disconnectDB } from './config/db.js';
import documentRoutes from './routes/documentRoutes.js';
import { WebSocketCollaborationServer } from './collaboration/WebSocketServer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.WEBSOCKET_PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

// Unified CORS origins resolution
export function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawClientUrl = process.env.CLIENT_URL ?? CLIENT_URL;
  const configured = rawClientUrl.split(',').map((u) => u.trim()).filter(Boolean);
  if (isProduction) {
    return configured.length > 0 ? configured : ['http://localhost:5173'];
  }
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
  return Array.from(new Set([...configured, ...defaults]));
}

const allowedOrigins = getAllowedOrigins();

// CORS configuration for Express
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Express JSON body parser with configurable limit
app.use(express.json({ limit: BODY_LIMIT }));

// Body parser error handling middleware (handles 413 Payload Too Large and 400 Malformed JSON)
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({
      success: false,
      error: 'Payload Too Large',
      message: `Request body exceeds the maximum allowed size of ${BODY_LIMIT}.`,
    });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body.',
    });
    return;
  }
  next(err);
});

// REST Routes
app.use('/api', documentRoutes);

// Health Check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    service: 'SyncDoc Collaborative Engine',
  });
});

// HTTP & Socket.IO Server Setup
export const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

export const wsCollaborationServer = new WebSocketCollaborationServer(io);

// Connect DB & Start Server
export async function startServer(port: number | string = PORT): Promise<{ app: express.Express; server: http.Server; io: SocketIOServer }> {
  await connectDB();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`🚀 [SyncDoc Server] Running on http://localhost:${port}`);
      console.log(`⚡ [Socket.IO] Real-time collaboration engine active`);
      resolve({ app, server, io });
    });
  });
}

let isShuttingDown = false;

// Graceful Shutdown
export async function stopServer(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('🛑 [SyncDoc Server] Initiating graceful shutdown...');

  // 1. Destroy collaboration sessions and clear timers
  try {
    wsCollaborationServer.destroy();
    console.log('⚡ [Socket.IO] Active collaboration sessions destroyed and timers cleared');
  } catch (err) {
    console.error('[Socket.IO] Error destroying collaboration sessions:', err);
  }

  // 2. Close Socket.IO server
  await new Promise<void>((resolve) => {
    io.close(() => {
      console.log('⚡ [Socket.IO] Server closed');
      resolve();
    });
  });

  // 3. Close HTTP server
  await new Promise<void>((resolve) => {
    server.close(() => {
      console.log('🚀 [SyncDoc Server] HTTP server closed');
      resolve();
    });
  });

  // 4. Disconnect MongoDB
  await disconnectDB();

  console.log('✅ [SyncDoc Server] Graceful shutdown complete');
  isShuttingDown = false;
}

// Register signal handlers for graceful shutdown (outside test mode)
if (process.env.NODE_ENV !== 'test') {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}`);
    await stopServer();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// If run directly via node / tsx
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
