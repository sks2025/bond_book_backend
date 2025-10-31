import express from 'express';
import {
  createReminder,
  getReminders,
  getRemindersForFriend,
  getFollowedFriends,
  getRemindersForFollowedFriends,
  updateReminder,
  markReminderComplete,
  deleteReminder
} from '../controllers/reminderController.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

// All routes require authentication
router.use(userAuth);

// Create a reminder
router.post('/', createReminder);

// Get all reminders (for user and created by user)
router.get('/', getReminders);

// Get all friends you follow (for creating reminders)
router.get('/friends', getFollowedFriends);

// Get reminders for all friends you follow
router.get('/friends/all', getRemindersForFollowedFriends);

// Get reminders for a specific friend
router.get('/friend/:friendId', getRemindersForFriend);

// Update a reminder
router.put('/:reminderId', updateReminder);

// Mark reminder as complete/incomplete (toggle)
router.put('/:reminderId/complete', markReminderComplete);

// Delete a reminder
router.delete('/:reminderId', deleteReminder);

export default router;

