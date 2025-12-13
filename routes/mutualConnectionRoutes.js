import express from 'express';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';
import {
  getMutualConnection,
  getMutualConnectionById,
  getUserMutualConnections,
  updateMutualConnectionProfile,
  uploadMutualConnectionProfilePicture,
  followMutualConnection,
  unfollowMutualConnection,
  unmergeMutualConnection
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
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/my-connections', userAuth, getUserMutualConnections);
router.get('/by-id/:mutualConnectionId', userAuth, getMutualConnectionById);

// Unmerge route - must be before catch-all routes
// Test route to verify DELETE is working
router.delete('/unmerge/:otherUserId', userAuth, async (req, res, next) => {
  console.log('DELETE /unmerge route matched!', req.params);
  next();
}, unmergeMutualConnection);

router.get('/:otherUserId', userAuth, getMutualConnection);
router.put('/:mutualConnectionId/profile', userAuth, updateMutualConnectionProfile);
router.put('/:mutualConnectionId/profile-picture', userAuth, upload.any(), uploadMutualConnectionProfilePicture);
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

