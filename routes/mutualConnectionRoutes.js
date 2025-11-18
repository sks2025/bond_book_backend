import express from 'express';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';
import {
  getMutualConnection,
  getMutualConnectionById,
  getUserMutualConnections,
  updateMutualConnectionProfile,
  followMutualConnection,
  unfollowMutualConnection
} from '../controllers/mutualConnectionController.js';
import {
  createMutualConnectionPost,
  getMutualConnectionPosts,
  getMutualConnectionPost,
  toggleLikeMutualPost,
  addCommentToMutualPost,
  deleteCommentFromMutualPost,
  deleteMutualConnectionPost
} from '../controllers/mutualConnectionPostController.js';
import {
  sendMessage,
  getMessages,
  getUnreadMessageCount,
  markMessagesAsRead
} from '../controllers/messageController.js';

const router = express.Router();

// Mutual Connection Routes
router.get('/my-connections', userAuth, getUserMutualConnections);
router.get('/:otherUserId', userAuth, getMutualConnection);
router.get('/by-id/:mutualConnectionId', userAuth, getMutualConnectionById);
router.put('/:mutualConnectionId/profile', userAuth, updateMutualConnectionProfile);
router.post('/:mutualConnectionId/follow', userAuth, followMutualConnection);
router.post('/:mutualConnectionId/unfollow', userAuth, unfollowMutualConnection);

// Post Routes
router.post('/:mutualConnectionId/posts', userAuth, upload.any(), createMutualConnectionPost);
router.get('/:mutualConnectionId/posts', userAuth, getMutualConnectionPosts);
router.get('/posts/:postId', userAuth, getMutualConnectionPost);
router.post('/posts/:postId/like', userAuth, toggleLikeMutualPost);
router.post('/posts/:postId/comments', userAuth, addCommentToMutualPost);
router.delete('/posts/:postId/comments/:commentId', userAuth, deleteCommentFromMutualPost);
router.delete('/posts/:postId', userAuth, deleteMutualConnectionPost);

// Message Routes
router.post('/:mutualConnectionId/messages', userAuth, sendMessage);
router.get('/:mutualConnectionId/messages', userAuth, getMessages);
router.get('/:mutualConnectionId/messages/unread-count', userAuth, getUnreadMessageCount);
router.put('/:mutualConnectionId/messages/read', userAuth, markMessagesAsRead);

export default router;

