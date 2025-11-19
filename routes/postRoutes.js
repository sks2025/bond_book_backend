import express from 'express';
import {
    createPost,
    getAllPosts,
    getPostById,
    updatePost,
    deletePost,
    getPostsByUser,
    getUserProfileByUserId,
    getMyPosts,
    getPostsByTags,
    togglePostLike,
    getPostLikes,
    checkPostLikeStatus,
    getPostComments,
    addPostComment,
    deletePostComment,
    getTotalLikesByUser,
    searchPosts
} from '../controllers/postController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Create a new post (with file upload)
router.post('/', userAuth, upload.any(), createPost);

// Get all posts
router.get('/', getAllPosts);

// Search posts by caption, username, or tag
router.get('/search', searchPosts);
router.post('/search', searchPosts);

// Get posts for the logged-in user (must be before /:id route)
router.get('/me', userAuth, getMyPosts);

// Get user profile by user ID (with all posts and follow info) - must be before /user/:userId
router.get('/user/:userId/profile', getUserProfileByUserId);

// Get posts by user
router.get('/user/:userId', getPostsByUser);

// Get total like count across all posts by a user
router.get('/user/:userId/likes/total', getTotalLikesByUser);

// Get posts by tag
router.get('/tag/:tag', getPostsByTags);

// Get post by ID (must be last to avoid conflicts)
router.get('/:id', getPostById);

// Update post
router.put('/:id', userAuth, updatePost);

// Delete post
router.delete('/:id', userAuth, deletePost);

// Like/unlike post
router.put('/:id/likes', userAuth, togglePostLike);

// Get likes for a post
router.get('/:id/likes', getPostLikes);

// Check if user liked a post
router.get('/:id/likes/status', userAuth, checkPostLikeStatus);

// Get comments for a post
router.get('/:id/comments', getPostComments);

// Add comment to a post
router.post('/:id/comments', userAuth, addPostComment);

// Delete comment from a post
router.delete('/:id/comments/:commentId', userAuth, deletePostComment);

export default router;