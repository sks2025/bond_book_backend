import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';

// Helper function to create a notification
export const createNotification = async (userId, fromUserId, type, message, relatedId = null, relatedModel = null) => {
  try {
    // Don't create notification if user is trying to notify themselves
    if (userId.toString() === fromUserId.toString()) {
      return null;
    }

    const notification = await Notification.create({
      user: userId,
      fromUser: fromUserId,
      type,
      message,
      relatedId,
      relatedModel
    });

    // Populate fromUser before returning (if needed for real-time)
    await notification.populate('fromUser', 'username profilePicture');
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null; // Don't throw, just log the error
  }
};

// Get all notifications for a user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ user: userId })
      .populate('fromUser', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get unread count
    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    // Get total count
    const totalCount = await Notification.countDocuments({ user: userId });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: totalCount > skip + notifications.length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get unread notifications only
export const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    const notifications = await Notification.find({ 
      user: userId, 
      isRead: false 
    })
      .populate('fromUser', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get unread notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete all notifications
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.deleteMany({ user: userId });

    return res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get notification count (unread)
export const getNotificationCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Get notification count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

