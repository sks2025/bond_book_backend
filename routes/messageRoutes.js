import express from 'express';
import {
    sendMessage,
    getConversations,
    getConversation,
    getUnreadCount,
    markAsRead,
    markConversationAsRead
} from '../controllers/messageController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

// Send a message
router.post('/send', userAuth, sendMessage);

// Get all conversations for a user
router.get('/conversations', userAuth, getConversations);

// Get conversation between two users
router.get('/conversation/:userId', userAuth, getConversation);

// Get unread message count
router.get('/unread', userAuth, getUnreadCount);

// Mark a message as read
router.put('/read/:messageId', userAuth, markAsRead);

// Mark all messages in a conversation as read
router.put('/read-conversation/:userId', userAuth, markConversationAsRead);

export default router;


