import Reminder from '../models/reminderModel.js';
import User from '../models/userModel.js';

// Create a reminder (for yourself or a friend)
export const createReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, reminderDate, forUser, priority, repeat } = req.body;

    if (!title || !reminderDate) {
      return res.status(400).json({
        success: false,
        message: 'Title and reminder date are required'
      });
    }

    // If reminder is for a friend, verify you follow them
    if (forUser) {
      const currentUser = await User.findById(userId);
      const friendUser = await User.findById(forUser);

      if (!friendUser) {
        return res.status(404).json({
          success: false,
          message: 'Friend not found'
        });
      }

      // Check if you follow this friend (one-way is enough for reminders)
      const isFollowing = currentUser.following.some(
        id => id.toString() === forUser.toString()
      );

      if (!isFollowing) {
        return res.status(403).json({
          success: false,
          message: 'You can only create reminders for friends you follow'
        });
      }
    }

    const reminder = await Reminder.create({
      title,
      description: description || '',
      reminderDate: new Date(reminderDate),
      createdBy: userId,
      forUser: forUser || null, // If null, reminder is for creator
      priority: priority || 'medium',
      repeat: repeat || 'none'
    });

    await reminder.populate('forUser', 'username profilePicture');
    await reminder.populate('createdBy', 'username profilePicture');

    return res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all reminders (created by user or for user)
export const getReminders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const reminders = await Reminder.find({
      $or: [
        { createdBy: userId },
        { forUser: userId }
      ]
    })
    .populate('createdBy', 'username profilePicture')
    .populate('forUser', 'username profilePicture')
    .sort({ reminderDate: 1 });

    // Separate by status
    const now = new Date();
    const upcoming = reminders.filter(r => !r.isCompleted && new Date(r.reminderDate) >= now);
    const past = reminders.filter(r => !r.isCompleted && new Date(r.reminderDate) < now);
    const completed = reminders.filter(r => r.isCompleted);

    return res.status(200).json({
      success: true,
      message: 'Reminders retrieved successfully',
      reminders: {
        all: reminders,
        upcoming,
        past,
        completed
      },
      counts: {
        total: reminders.length,
        upcoming: upcoming.length,
        past: past.length,
        completed: completed.length
      }
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get reminders for a specific friend (you follow)
export const getRemindersForFriend = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    // Verify you follow this friend
    const currentUser = await User.findById(userId);
    const friendUser = await User.findById(friendId);

    if (!friendUser) {
      return res.status(404).json({
        success: false,
        message: 'Friend not found'
      });
    }

    const isFollowing = currentUser.following.some(
      id => id.toString() === friendId.toString()
    );

    if (!isFollowing) {
      return res.status(403).json({
        success: false,
        message: 'You can only view reminders for friends you follow'
      });
    }

    // Get reminders you created for this friend, or reminders created by this friend for you
    const reminders = await Reminder.find({
      $or: [
        { createdBy: userId, forUser: friendId },
        { createdBy: friendId, forUser: userId }
      ]
    })
    .populate('createdBy', 'username profilePicture')
    .populate('forUser', 'username profilePicture')
    .sort({ reminderDate: 1 });

    return res.status(200).json({
      success: true,
      message: 'Reminders retrieved successfully',
      friend: {
        _id: friendUser._id,
        username: friendUser.username,
        profilePicture: friendUser.profilePicture
      },
      reminders,
      count: reminders.length
    });
  } catch (error) {
    console.error('Get reminders for friend error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update a reminder
export const updateReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;
    const { title, description, reminderDate, priority, repeat } = req.body;

    const reminder = await Reminder.findById(reminderId);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Only creator can update
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reminder'
      });
    }

    if (title) reminder.title = title;
    if (description !== undefined) reminder.description = description;
    if (reminderDate) reminder.reminderDate = new Date(reminderDate);
    if (priority) reminder.priority = priority;
    if (repeat) reminder.repeat = repeat;

    await reminder.save();
    await reminder.populate('createdBy', 'username profilePicture');
    await reminder.populate('forUser', 'username profilePicture');

    return res.status(200).json({
      success: true,
      message: 'Reminder updated successfully',
      reminder
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark reminder as completed
export const markReminderComplete = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;

    const reminder = await Reminder.findById(reminderId);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Creator or the person the reminder is for can mark complete
    const canMarkComplete = reminder.createdBy.toString() === userId.toString() ||
                           (reminder.forUser && reminder.forUser.toString() === userId.toString());

    if (!canMarkComplete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this reminder as complete'
      });
    }

    reminder.isCompleted = !reminder.isCompleted; // Toggle
    await reminder.save();
    await reminder.populate('createdBy', 'username profilePicture');
    await reminder.populate('forUser', 'username profilePicture');

    return res.status(200).json({
      success: true,
      message: reminder.isCompleted 
        ? 'Reminder marked as completed' 
        : 'Reminder marked as incomplete',
      reminder
    });
  } catch (error) {
    console.error('Mark reminder complete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete a reminder
export const deleteReminder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reminderId } = req.params;

    const reminder = await Reminder.findById(reminderId);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Only creator can delete
    if (reminder.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this reminder'
      });
    }

    await Reminder.findByIdAndDelete(reminderId);

    return res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all friends you follow (for creating reminders)
export const getFollowedFriends = async (req, res) => {
  try {
    const userId = req.user.userId;

    const currentUser = await User.findById(userId).populate('following', 'username profilePicture email');

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get friends you follow
    const followedFriends = currentUser.following.map(friend => ({
      _id: friend._id,
      username: friend.username,
      profilePicture: friend.profilePicture,
      email: friend.email
    }));

    return res.status(200).json({
      success: true,
      message: 'Followed friends retrieved successfully',
      friends: followedFriends,
      count: followedFriends.length
    });
  } catch (error) {
    console.error('Get followed friends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get reminders for all friends you follow
export const getRemindersForFollowedFriends = async (req, res) => {
  try {
    const userId = req.user.userId;

    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all reminders created for friends you follow
    const followedFriendIds = currentUser.following.map(id => id.toString());
    
    const reminders = await Reminder.find({
      createdBy: userId,
      forUser: { $in: currentUser.following }
    })
    .populate('forUser', 'username profilePicture email')
    .populate('createdBy', 'username profilePicture')
    .sort({ reminderDate: 1 });

    // Group reminders by friend
    const remindersByFriend = {};
    reminders.forEach(reminder => {
      if (reminder.forUser) {
        const friendId = reminder.forUser._id.toString();
        if (!remindersByFriend[friendId]) {
          remindersByFriend[friendId] = {
            friend: reminder.forUser,
            reminders: []
          };
        }
        remindersByFriend[friendId].reminders.push(reminder);
      }
    });

    // Convert to array
    const friendsWithReminders = Object.values(remindersByFriend);

    return res.status(200).json({
      success: true,
      message: 'Reminders for followed friends retrieved successfully',
      friendsWithReminders,
      totalReminders: reminders.length,
      friendsCount: friendsWithReminders.length
    });
  } catch (error) {
    console.error('Get reminders for followed friends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

