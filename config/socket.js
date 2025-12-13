import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// Store active users: { userId: socketId }
const activeUsers = new Map();

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Configure this based on your frontend URL
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      
      if (decoded.userId) {
        socket.userId = decoded.userId;
        next();
      } else {
        next(new Error('Invalid token'));
      }
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`✅ User ${userId} connected via socket`);

    // Store user's socket connection
    activeUsers.set(userId.toString(), socket.id);

    // Join a room for this user
    socket.join(`user_${userId}`);

    // Emit online status to user's followers/friends (optional)
    socket.broadcast.emit('user-online', { userId });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User ${userId} disconnected`);
      activeUsers.delete(userId.toString());
      socket.broadcast.emit('user-offline', { userId });
    });

    // Handle typing indicator
    socket.on('typing', ({ receiverId }) => {
      socket.to(`user_${receiverId}`).emit('typing', { 
        senderId: userId 
      });
    });

    // Handle stop typing
    socket.on('stop-typing', ({ receiverId }) => {
      socket.to(`user_${receiverId}`).emit('stop-typing', { 
        senderId: userId 
      });
    });

    // Handle join conversation room
    socket.on('join-conversation', ({ otherUserId }) => {
      const roomId = [userId, otherUserId].sort().join('_');
      socket.join(`conversation_${roomId}`);
    });

    // Handle leave conversation room
    socket.on('leave-conversation', ({ otherUserId }) => {
      const roomId = [userId, otherUserId].sort().join('_');
      socket.leave(`conversation_${roomId}`);
    });
  });

  return io;
};

// Function to emit message to specific user
export const emitMessage = (io, userId, messageData) => {
  io.to(`user_${userId}`).emit('new-message', messageData);
};

// Function to emit message to conversation room
export const emitToConversation = (io, userId1, userId2, messageData) => {
  const roomId = [userId1, userId2].sort().join('_');
  io.to(`conversation_${roomId}`).emit('new-message', messageData);
};

// Function to check if user is online
export const isUserOnline = (userId) => {
  return activeUsers.has(userId.toString());
};

// Get socket instance (will be set after initialization)
let socketIO = null;

export const setSocketIO = (io) => {
  socketIO = io;
};

export const getSocketIO = () => {
  return socketIO;
};

