import express from 'express';
import {
    createPost,
    getAllPosts,
    getPostById,
    updatePost,
    deletePost,
    getPostsByUser,
    getPostsByTags,
    togglePostLike,
    getPostLikes,
    checkPostLikeStatus,
    getPostComments,
    addPostComment,
    deletePostComment
} from '../controllers/postController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Create a new post (with file upload)
router.post('/', userAuth, upload.any(), createPost);

// Get all posts
router.get('/', getAllPosts);

// Get post by ID
router.get('/:id', getPostById);

// Update post
router.put('/:id', userAuth, updatePost);

// Delete post
router.delete('/:id', userAuth, deletePost);

// Get posts by user
router.get('/user/:userId', getPostsByUser);

// Get posts by tag
router.get('/tag/:tag', getPostsByTags);

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