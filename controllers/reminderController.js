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

    // Parse date string (YYYY-MM-DD) and create date in local timezone
    // Frontend sends date as "YYYY-MM-DD" string, we need to parse it as local date
    let parsedDate;
    if (reminderDate instanceof Date) {
      parsedDate = reminderDate;
    } else if (typeof reminderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reminderDate)) {
      // Parse YYYY-MM-DD format and create date at midnight local time
      const [year, month, day] = reminderDate.split('-').map(Number);
      parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      console.log(`📝 Parsing reminder date: "${reminderDate}" -> local date: ${parsedDate.toLocaleDateString()}`);
    } else {
      parsedDate = new Date(reminderDate);
    }

    // Create reminder
    const reminder = new Reminder({
      user: userId,
      title,
      description,
      reminderDate: parsedDate,
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

    // Check if reminder is already due and create notification immediately
    const now = new Date();
    const reminderDateTime = new Date(reminder.reminderDate);
    const [hours = '00', minutes = '00'] = (reminder.reminderTime || '00:00').split(':');
    reminderDateTime.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
    
    if (reminderDateTime <= now && !reminder.isCompleted && !reminder.isDismissed) {
      try {
        await Notification.create({
          user: userId,
          fromUser: null,
          type: 'reminder_due',
          message: `Reminder due: ${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}`,
          relatedId: reminder._id,
          relatedModel: 'Reminder'
        });
        reminder.notificationSent = true;
        await reminder.save();
        console.log(`✅ Created immediate notification for reminder "${reminder.title}"`);
      } catch (notificationError) {
        console.error('Error creating immediate notification:', notificationError);
      }
    }

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

    let scheduleChanged = false;
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'reminderDate') {
          // Parse date string (YYYY-MM-DD) and create date in local timezone
          let parsedDate;
          if (updates[field] instanceof Date) {
            parsedDate = updates[field];
          } else if (typeof updates[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(updates[field])) {
            // Parse YYYY-MM-DD format and create date at midnight local time
            const [year, month, day] = updates[field].split('-').map(Number);
            parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            console.log(`📝 Updating reminder date: "${updates[field]}" -> local date: ${parsedDate.toLocaleDateString()}`);
          } else {
            parsedDate = new Date(updates[field]);
          }
          reminder[field] = parsedDate;
          scheduleChanged = true;
        } else {
          reminder[field] = updates[field];
          if (field === 'reminderTime') {
            scheduleChanged = true;
          }
        }
      }
    });

    if (scheduleChanged) {
      reminder.notificationSent = false;
    }

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
    reminder.notificationSent = false;
    await reminder.save();

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

// Dismiss reminder (turn off reminder popup permanently)
export const dismissReminder = async (req, res) => {
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

    reminder.isDismissed = true;
    await reminder.save();

    return res.status(200).json({
      success: true,
      message: 'Reminder dismissed successfully',
      reminder
    });
  } catch (error) {
    console.error('Dismiss reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to dismiss reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get active due reminders for popup (not dismissed, not completed, due today)
export const getActiveDueReminders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    // Get today's LOCAL date as YYYY-MM-DD string
    const todayYear = now.getFullYear();
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
    const todayDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`; // Local date like "2024-12-20"

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    console.log(`🔔 Checking active due reminders for user ${userId}`);
    console.log(`   Today's LOCAL date: ${todayStr}`);
    console.log(`   Current local time: ${currentHours}:${String(currentMinutes).padStart(2, '0')}`);

    // DEBUG: First check ALL reminders for this user (regardless of status)
    const allUserReminders = await Reminder.find({ user: userId });
    console.log(`   🔍 DEBUG: Total ALL reminders for user: ${allUserReminders.length}`);
    allUserReminders.forEach((r, i) => {
      const rDate = new Date(r.reminderDate);
      const rDateStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
      console.log(`   🔍 [${i + 1}] "${r.title}" | Date: ${rDateStr} | Time: ${r.reminderTime} | Completed: ${r.isCompleted} | Dismissed: ${r.isDismissed}`);
    });

    // Find all incomplete and not dismissed reminders for the user
    const allReminders = await Reminder.find({
      user: userId,
      isCompleted: false,
      isDismissed: false
    }).sort({ reminderTime: 1 });

    console.log(`   Total incomplete & not dismissed reminders: ${allReminders.length}`);

    // Filter reminders for today using date string comparison
    const todayReminders = allReminders.filter((reminder) => {
      // Get reminder date in local timezone
      const reminderDate = new Date(reminder.reminderDate);
      // Convert to local date string (YYYY-MM-DD)
      const reminderYear = reminderDate.getFullYear();
      const reminderMonth = String(reminderDate.getMonth() + 1).padStart(2, '0');
      const reminderDay = String(reminderDate.getDate()).padStart(2, '0');
      const reminderDateStr = `${reminderYear}-${reminderMonth}-${reminderDay}`;
      
      const isToday = reminderDateStr === todayStr;

      console.log(`   📅 Reminder "${reminder.title}" date: ${reminderDateStr} (stored: ${reminder.reminderDate}, local: ${reminderDate.toLocaleDateString()}), today: ${todayStr}, match: ${isToday}`);

      return isToday;
    });

    console.log(`   Found ${todayReminders.length} reminders for today`);

    // Filter to only include reminders that are actually due (time has passed)
    // NOTE: For testing, we show ALL today's reminders regardless of time
    // In production, you might want to only show reminders where time has passed
    const dueReminders = todayReminders.filter((reminder) => {
      const [hours = 0, minutes = 0] = (reminder.reminderTime || '00:00').split(':').map(Number);
      const reminderTotalMinutes = hours * 60 + minutes;
      const currentTotalMinutes = currentHours * 60 + currentMinutes;
      
      // Check if time has passed
      const timeDiff = reminderTotalMinutes - currentTotalMinutes;
      const isDue = timeDiff <= 0; // Time has passed
      
      // For now, show ALL today's reminders (for testing)
      // To only show due reminders, change this to: return isDue;
      const shouldShow = true; // Show all today's reminders

      if (isDue) {
        console.log(`   ✅ Reminder "${reminder.title}" is due (${hours}:${String(minutes).padStart(2, '0')} <= ${currentHours}:${String(currentMinutes).padStart(2, '0')})`);
      } else {
        const minutesUntilDue = Math.floor(timeDiff);
        const hoursUntilDue = Math.floor(minutesUntilDue / 60);
        const minsUntilDue = minutesUntilDue % 60;
        console.log(`   ⏰ Reminder "${reminder.title}" scheduled for ${hours}:${String(minutes).padStart(2, '0')} (in ${hoursUntilDue}h ${minsUntilDue}m) - showing anyway for testing`);
      }

      return shouldShow;
    });

    console.log(`   Returning ${dueReminders.length} active due reminders`);

    return res.status(200).json({
      success: true,
      count: dueReminders.length,
      reminders: dueReminders
    });
  } catch (error) {
    console.error('Get active due reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active due reminders',
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

// Internal function to check due reminders for all users (used by scheduled job)
export const checkAllDueReminders = async () => {
  try {
    const now = new Date();
    console.log(`🕐 Checking due reminders at ${now.toISOString()}`);

    // Find all reminders that are not completed and haven't sent notification
    const candidates = await Reminder.find({
      isCompleted: false,
      notificationSent: false
    }).populate('user', '_id');

    console.log(`📋 Found ${candidates.length} candidate reminders to check`);

    let totalDueReminders = 0;
    let totalNotificationsCreated = 0;

    for (const reminder of candidates) {
      // Create a new date from the reminder date
      const reminderDate = new Date(reminder.reminderDate);
      
      // Parse the time string (format: "HH:MM")
      const [hours = '00', minutes = '00'] = (reminder.reminderTime || '00:00').split(':');
      const reminderHours = parseInt(hours, 10) || 0;
      const reminderMinutes = parseInt(minutes, 10) || 0;
      
      // Set the time on the reminder date
      reminderDate.setHours(reminderHours, reminderMinutes, 0, 0);
      
      // Check if reminder is due (time has passed or is exactly now)
      const timeDiff = now.getTime() - reminderDate.getTime();
      const isDue = timeDiff >= 0;
      
      if (isDue) {
        console.log(`⏰ Reminder "${reminder.title}" is due! (Due: ${reminderDate.toISOString()}, Now: ${now.toISOString()})`);
        try {
          // Get user ID - handle both populated and non-populated cases
          const userId = reminder.user?._id || reminder.user || reminder.userId;
          
          if (!userId) {
            console.error(`Reminder ${reminder._id} has no user ID`);
            continue;
          }
          
          // For reminder notifications, fromUser is optional (can be null)
          const notification = await Notification.create({
            user: userId,
            fromUser: null, // Reminder notifications don't need a fromUser
            type: 'reminder_due',
            message: `Reminder due: ${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}`,
            relatedId: reminder._id,
            relatedModel: 'Reminder'
          });
          
          console.log(`✅ Created notification for reminder "${reminder.title}" (Notification ID: ${notification._id})`);
          
          reminder.notificationSent = true;
          await reminder.save();
          
          totalDueReminders++;
          totalNotificationsCreated++;
        } catch (notificationError) {
          console.error(`❌ Error creating notification for reminder ${reminder._id}:`, notificationError);
          console.error(`   Error details:`, notificationError.message);
        }
      } else {
        // Log when reminder is not yet due (for debugging)
        const timeUntilDue = reminderDate.getTime() - now.getTime();
        const minutesUntilDue = Math.floor(timeUntilDue / (1000 * 60));
        if (minutesUntilDue <= 5) {
          console.log(`⏳ Reminder "${reminder.title}" due in ${minutesUntilDue} minutes`);
        }
      }
    }

    if (totalNotificationsCreated > 0) {
      console.log(`✅ Checked reminders: ${totalNotificationsCreated} notification(s) created for due reminders`);
    } else {
      console.log(`ℹ️  No due reminders found at this time`);
    }

    return {
      success: true,
      count: totalDueReminders,
      notificationsCreated: totalNotificationsCreated
    };
  } catch (error) {
    console.error('Error checking all due reminders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check due reminders and create notifications (API endpoint for current user)
export const checkDueReminders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    console.log(`🔔 Manual check due reminders for user ${userId} at ${now.toISOString()}`);

    // Get start and end of today
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Find reminders for today that are not completed
    const candidates = await Reminder.find({
      user: userId,
      isCompleted: false,
      reminderDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    console.log(`   Found ${candidates.length} reminders for today`);

    const dueReminders = [];
    const notificationsCreated = [];

    for (const reminder of candidates) {
      const reminderDateTime = new Date(reminder.reminderDate);
      const [hours = '00', minutes = '00'] = (reminder.reminderTime || '00:00').split(':');
      reminderDateTime.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0);
      
      const isDue = reminderDateTime <= now;
      
      if (isDue) {
        dueReminders.push(reminder);
        
        // Check if notification already exists
        const existingNotification = await Notification.findOne({
          user: userId,
          type: 'reminder_due',
          relatedId: reminder._id
        });

        if (!existingNotification && !reminder.notificationSent) {
          try {
            // For reminder notifications, fromUser is optional (can be null)
            const notification = await Notification.create({
              user: userId,
              fromUser: null, // Reminder notifications don't need a fromUser
              type: 'reminder_due',
              message: `Reminder due: ${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}`,
              relatedId: reminder._id,
              relatedModel: 'Reminder'
            });
            
            console.log(`   ✅ Created notification for reminder "${reminder.title}"`);
            notificationsCreated.push(notification);
            
            reminder.notificationSent = true;
            await reminder.save();
          } catch (notificationError) {
            console.error(`   ❌ Error creating notification for reminder ${reminder._id}:`, notificationError);
          }
        } else if (existingNotification) {
          console.log(`   ℹ️  Notification already exists for reminder "${reminder.title}"`);
        }
      }
    }

    console.log(`   Total due reminders: ${dueReminders.length}, Notifications created: ${notificationsCreated.length}`);

    return res.status(200).json({
      success: true,
      count: dueReminders.length,
      reminders: dueReminders,
      notificationsCreated: notificationsCreated.length
    });
  } catch (error) {
    console.error('Check due reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check due reminders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Scheduled job to check due reminders periodically
let reminderCheckInterval = null;

export const startReminderCheckJob = (intervalMinutes = 1) => {
  // Stop existing interval if any
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
    console.log('🛑 Stopped existing reminder check job');
  }

  console.log(`🔄 Starting reminder check job: Will check every ${intervalMinutes} minute(s)`);

  // Run check immediately on startup
  console.log('🚀 Running initial reminder check...');
  checkAllDueReminders().catch(err => {
    console.error('❌ Error in initial reminder check:', err);
  });

  // Run check every minute (default) or specified interval
  const intervalMs = intervalMinutes * 60 * 1000;
  reminderCheckInterval = setInterval(() => {
    checkAllDueReminders().catch(err => {
      console.error('❌ Error in scheduled reminder check:', err);
    });
  }, intervalMs);

  console.log(`✅ Reminder check job started successfully (interval: ${intervalMinutes} minute(s), ${intervalMs}ms)`);
  
  return reminderCheckInterval;
};

// Stop reminder check job
export const stopReminderCheckJob = () => {
  if (reminderCheckInterval) {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = null;
    console.log('🛑 Reminder check job stopped');
  }
};
