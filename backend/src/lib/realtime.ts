import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

/**
 * Real-time layer (WebSockets via Socket.IO). This is what makes the Kanban board's "instant
 * refresh" requirement actually real: every client viewing a workflow is pushed a live event the
 * moment ANY user (not just the one dragging a card) creates, moves, edits, or comments on an
 * item, a reminder fires, or a workflow is created, instead of only updating the browser that
 * made the change. Clients join a room per workflow (`workflow:<id>`) so updates only reach
 * people actually looking at that board.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

let io: SocketServer | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    },
  });

  // Require a valid JWT on the socket handshake, same trust boundary as the REST API.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on('workflow:join', (workflowId: string) => {
      if (typeof workflowId === 'string') socket.join(`workflow:${workflowId}`);
    });
    socket.on('workflow:leave', (workflowId: string) => {
      if (typeof workflowId === 'string') socket.leave(`workflow:${workflowId}`);
    });
  });

  logger.info('realtime_socketio_initialized');
  return io;
}

// Broadcast that something about this workflow's items changed (created, status changed, edited,
// deleted, commented on). Every connected client viewing that workflow refetches instantly.
export function broadcastItemsChanged(workflowId: string, reason: string) {
  io?.to(`workflow:${workflowId}`).emit('items:changed', { workflowId, reason });
}

// Broadcast that the list of workflows itself changed (a new one created, a status added).
export function broadcastWorkflowsChanged() {
  io?.emit('workflows:changed', {});
}

// Broadcast a notification event to a specific user's room so their bell badge updates live.
export function broadcastNotification(userId: string) {
  io?.to(`user:${userId}`).emit('notifications:changed', {});
}
