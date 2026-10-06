import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

/**
 * Returns the shared Socket.IO client instance for real-time app events & presence
 */
export function getSharedSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}
