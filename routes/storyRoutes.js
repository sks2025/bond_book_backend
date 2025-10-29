import express from 'express';
import {
  createStory,
  getAllStories,
  getStoriesByUser,
  getStoryById,
  updateStory,
  deleteStory,
  getStoryFeed,
  cleanupExpiredStories,
  getStoryStats,
  getStoriesGroupedByUser,
  getMyStories
} from '../controllers/storyController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(userAuth);

// Story CRUD operations
router.post('/', upload.any(), createStory);      // Create a new story
router.get('/', getAllStories);                   // Get all active stories
router.get('/feed', getStoryFeed);                // Get story feed (from followed users)
router.get('/me', getMyStories);                  // Get my stories (logged-in user)
router.get('/grouped', getStoriesGroupedByUser);  // Get stories grouped by user
router.get('/stats/:userId', getStoryStats);      // Get story statistics for a user
router.get('/user/:userId', getStoriesByUser);    // Get stories by specific user
router.get('/:storyId', getStoryById);            // Get single story by ID
router.put('/:storyId', updateStory);             // Update story
router.delete('/:storyId', deleteStory);          // Delete story

// Utility routes
router.delete('/cleanup/expired', cleanupExpiredStories); // Clean up expired stories

export default router;
