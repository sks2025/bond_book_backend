import express from 'express';
import {
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationCount
} from '../controllers/notificationController.js';
import userAuth from '../middleware/userAuth.js';

const notificationRouter = express.Router();

// All routes require authentication
notificationRouter.get('/', userAuth, getNotifications);
notificationRouter.get('/unread', userAuth, getUnreadNotifications);
notificationRouter.get('/count', userAuth, getNotificationCount);
notificationRouter.put('/:notificationId/read', userAuth, markAsRead);
notificationRouter.put('/read-all', userAuth, markAllAsRead);
notificationRouter.delete('/:notificationId', userAuth, deleteNotification);
notificationRouter.delete('/', userAuth, deleteAllNotifications);

export default notificationRouter;

