import express from 'express';
import {
  createReminder,
  getAllReminders,
  getReminderById,
  updateReminder,
  deleteReminder,
  markReminderCompleted,
  snoozeReminder,
  getUpcomingReminders,
  getOverdueReminders,
  getTodayReminders,
  getReminderStats,
  getUserFriendsForSharing,
  shareReminderWithFriends,
  getSharedReminders
} from '../controllers/reminderController.js';
import userAuth from '../middleware/userAuth.js';

const reminderRouter = express.Router();

// All routes require authentication
reminderRouter.use(userAuth);

// CRUD operations
reminderRouter.post('/', createReminder);
reminderRouter.get('/', getAllReminders);
reminderRouter.get('/stats', getReminderStats);
reminderRouter.get('/upcoming', getUpcomingReminders);
reminderRouter.get('/overdue', getOverdueReminders);
reminderRouter.get('/today', getTodayReminders);
reminderRouter.get('/shared', getSharedReminders);
reminderRouter.get('/friends', getUserFriendsForSharing);
reminderRouter.get('/:reminderId', getReminderById);
reminderRouter.put('/:reminderId', updateReminder);
reminderRouter.delete('/:reminderId', deleteReminder);

// Actions
reminderRouter.patch('/:reminderId/complete', markReminderCompleted);
reminderRouter.patch('/:reminderId/snooze', snoozeReminder);
reminderRouter.post('/:reminderId/share', shareReminderWithFriends);

export default reminderRouter;
