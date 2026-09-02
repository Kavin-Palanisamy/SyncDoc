import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db.js';
import documentRoutes from './routes/documentRoutes.js';
import { WebSocketCollaborationServer } from './collaboration/WebSocketServer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration
app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));

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
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', '*'],
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

// If run directly via node / tsx
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
