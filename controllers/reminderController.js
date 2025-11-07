import Reminder from '../models/reminderModel.js';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';

// Create a new reminder
export const createReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      title, 
      description, 
      reminderDate, 
      reminderTime, 
      priority, 
      category,
      isRecurring,
      recurringType,
      tags,
      color,
      attachments
    } = req.body;

    // Validation
    if (!title || !reminderDate || !reminderTime) {
      return res.status(400).json({
        success: false,
        message: 'Title, date, and time are required'
      });
    }

    // Create reminder
    const reminder = new Reminder({
      user: userId,
      title,
      description,
      reminderDate: new Date(reminderDate),
      reminderTime,
      priority: priority || 'medium',
      category: category || 'personal',
      isRecurring: isRecurring || false,
      recurringType: isRecurring ? recurringType : null,
      tags: tags || [],
      color: color || '#8B5CF6',
      attachments: attachments || []
    });

    await reminder.save();

    return res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all reminders for logged-in user
export const getAllReminders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      completed, 
      priority, 
      category, 
      startDate, 
      endDate,
      sortBy = 'reminderDate',
      order = 'asc'
    } = req.query;

    // Build filter
    const filter = { user: userId };
    
    if (completed !== undefined) {
      filter.isCompleted = completed === 'true';
    }
    
    if (priority) {
      filter.priority = priority;
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (startDate || endDate) {
      filter.reminderDate = {};
      if (startDate) filter.reminderDate.$gte = new Date(startDate);
      if (endDate) filter.reminderDate.$lte = new Date(endDate);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    const reminders = await Reminder.find(filter)
      .sort(sort)
      .populate('user', 'username profilePicture');

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get reminder by ID
export const getReminderById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;

    const reminder = await Reminder.findOne({
      _id: reminderId,
      user: userId
    }).populate('user', 'username profilePicture');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    return res.status(200).json({
      success: true,
      reminder
    });
  } catch (error) {
    console.error('Get reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update reminder
export const updateReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;
    const updates = req.body;

    const reminder = await Reminder.findOne({
      _id: reminderId,
      user: userId
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'reminderDate', 'reminderTime', 
      'priority', 'category', 'isRecurring', 'recurringType',
      'tags', 'color', 'attachments'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        reminder[field] = updates[field];
      }
    });

    await reminder.save();

    return res.status(200).json({
      success: true,
      message: 'Reminder updated successfully',
      reminder
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete reminder
export const deleteReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;

    const reminder = await Reminder.findOneAndDelete({
      _id: reminderId,
      user: userId
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Mark reminder as completed
export const markReminderCompleted = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;

    const reminder = await Reminder.findOne({
      _id: reminderId,
      user: userId
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    await reminder.markCompleted();

    // If recurring, create next occurrence
    if (reminder.isRecurring && reminder.recurringType) {
      const nextDate = new Date(reminder.reminderDate);
      
      switch (reminder.recurringType) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Create next reminder
      const nextReminder = new Reminder({
        user: reminder.user,
        title: reminder.title,
        description: reminder.description,
        reminderDate: nextDate,
        reminderTime: reminder.reminderTime,
        priority: reminder.priority,
        category: reminder.category,
        isRecurring: true,
        recurringType: reminder.recurringType,
        tags: reminder.tags,
        color: reminder.color
      });

      await nextReminder.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Reminder marked as completed',
      reminder
    });
  } catch (error) {
    console.error('Complete reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Snooze reminder
export const snoozeReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;
    const { minutes = 15 } = req.body;

    const reminder = await Reminder.findOne({
      _id: reminderId,
      user: userId
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    await reminder.snoozeReminder(minutes);

    return res.status(200).json({
      success: true,
      message: `Reminder snoozed for ${minutes} minutes`,
      reminder
    });
  } catch (error) {
    console.error('Snooze reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to snooze reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get upcoming reminders
export const getUpcomingReminders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const reminders = await Reminder.getUpcoming(userId, parseInt(limit));

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders
    });
  } catch (error) {
    console.error('Get upcoming reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get overdue reminders
export const getOverdueReminders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const reminders = await Reminder.getOverdue(userId);

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders
    });
  } catch (error) {
    console.error('Get overdue reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get today's reminders
export const getTodayReminders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const reminders = await Reminder.getToday(userId);

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders
    });
  } catch (error) {
    console.error('Get today reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get reminder statistics
export const getReminderStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [
      totalReminders,
      completedReminders,
      overdueReminders,
      todayReminders
    ] = await Promise.all([
      Reminder.countDocuments({ user: userId }),
      Reminder.countDocuments({ user: userId, isCompleted: true }),
      Reminder.getOverdue(userId).then(r => r.length),
      Reminder.getToday(userId).then(r => r.length)
    ]);

    // Get reminders by priority
    const byPriority = await Reminder.aggregate([
      { $match: { user: userId, isCompleted: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Get reminders by category
    const byCategory = await Reminder.aggregate([
      { $match: { user: userId, isCompleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: totalReminders,
        completed: completedReminders,
        pending: totalReminders - completedReminders,
        overdue: overdueReminders,
        today: todayReminders,
        byPriority,
        byCategory
      }
    });
  } catch (error) {
    console.error('Get reminder stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's friends/followers for sharing
export const getUserFriendsForSharing = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .populate('following', 'username profilePicture email')
      .select('following');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      friends: user.following || []
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Share/Send reminder to friends
export const shareReminderWithFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;
    const { friendIds, wishMessage } = req.body;

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one friend to share with'
      });
    }

    // Get original reminder
    const originalReminder = await Reminder.findOne({
      _id: reminderId,
      user: userId
    });

    if (!originalReminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Get sender info
    const sender = await User.findById(userId).select('username profilePicture');

    // Create shared reminders for each friend
    const sharedReminders = [];
    const notifications = [];

    for (const friendId of friendIds) {
      // Create a copy of reminder for friend
      const sharedReminder = new Reminder({
        user: friendId,
        title: originalReminder.title,
        description: originalReminder.description,
        reminderDate: originalReminder.reminderDate,
        reminderTime: originalReminder.reminderTime,
        priority: originalReminder.priority,
        category: originalReminder.category,
        isShared: true,
        sharedBy: userId,
        wishMessage: wishMessage || `${sender.username} sent you a reminder!`,
        color: originalReminder.color
      });

      await sharedReminder.save();
      sharedReminders.push(sharedReminder);

      // Create notification for friend
      const notification = new Notification({
        user: friendId,
        type: 'reminder',
        title: `${sender.username} sent you a reminder`,
        message: wishMessage || `${originalReminder.title}`,
        relatedUser: userId,
        relatedId: sharedReminder._id,
        link: `/reminders/${sharedReminder._id}`
      });

      await notification.save();
      notifications.push(notification);
    }

    return res.status(200).json({
      success: true,
      message: `Reminder shared with ${friendIds.length} friend(s)`,
      sharedReminders,
      notificationsSent: notifications.length
    });
  } catch (error) {
    console.error('Share reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to share reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get shared reminders (received from friends)
export const getSharedReminders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const sharedReminders = await Reminder.find({
      user: userId,
      isShared: true
    })
      .populate('sharedBy', 'username profilePicture')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sharedReminders.length,
      reminders: sharedReminders
    });
  } catch (error) {
    console.error('Get shared reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch shared reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
