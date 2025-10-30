import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  listUsersForChat,
  sendChatRequest,
  listChatRequests,
  acceptChatRequest,
  rejectChatRequest,
  listConnections,
  getChatProfile
} from '../controllers/chatController.js';

const router = express.Router();

// All chat routes require authentication
router.use(userAuth);

// Discover users to start chat with
router.get('/users', listUsersForChat);

// Requests
router.get('/requests', listChatRequests);
router.post('/requests', sendChatRequest);
router.post('/requests/:requestId/accept', acceptChatRequest);
router.post('/requests/:requestId/reject', rejectChatRequest);

// Connections
router.get('/connections', listConnections);
router.get('/profiles/:connectionId', getChatProfile);

export default router;


