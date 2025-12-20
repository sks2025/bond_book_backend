import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  reminderDate: {
    type: Date,
    required: [true, 'Reminder date is required'],
    index: true
  },
  reminderTime: {
    type: String, // Format: "HH:MM"
    required: [true, 'Reminder time is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['personal', 'work', 'health', 'social', 'finance', 'other'],
    default: 'personal'
  },
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: null
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  isDismissed: {
    type: Boolean,
    default: false
  },
  snoozeUntil: {
    type: Date
  },
  attachments: [{
    type: String // URLs to attached files/images
  }],
  tags: [{
    type: String,
    trim: true
  }],
  color: {
    type: String,
    default: '#8B5CF6' // Default purple color
  },
  // Shared reminder fields
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isShared: {
    type: Boolean,
    default: false
  },
  wishMessage: {
    type: String,
    trim: true,
    maxlength: [200, 'Wish message cannot exceed 200 characters']
  }
}, {
  timestamps: true
});

// Index for efficient queries
reminderSchema.index({ user: 1, reminderDate: 1 });
reminderSchema.index({ user: 1, isCompleted: 1 });
reminderSchema.index({ user: 1, priority: 1 });
reminderSchema.index({ sharedWith: 1 }); // For shared reminders
reminderSchema.index({ sharedBy: 1 }); // For tracking who shared

// Virtual for checking if reminder is overdue
reminderSchema.virtual('isOverdue').get(function() {
  if (this.isCompleted) return false;
  const now = new Date();
  const reminderDateTime = new Date(this.reminderDate);
  const [hours, minutes] = this.reminderTime.split(':');
  reminderDateTime.setHours(parseInt(hours), parseInt(minutes));
  return reminderDateTime < now;
});

// Method to mark reminder as completed
reminderSchema.methods.markCompleted = function() {
  this.isCompleted = true;
  this.completedAt = new Date();
  return this.save();
};

// Method to snooze reminder
reminderSchema.methods.snoozeReminder = function(minutes) {
  const snoozeTime = new Date();
  snoozeTime.setMinutes(snoozeTime.getMinutes() + minutes);
  this.snoozeUntil = snoozeTime;
  return this.save();
};

// Static method to get upcoming reminders (local timezone)
reminderSchema.statics.getUpcoming = async function(userId, limit = 10) {
  const now = new Date();

  // Get today's LOCAL date as YYYY-MM-DD string
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const allReminders = await this.find({
    user: userId,
    isCompleted: false
  }).sort({ reminderDate: 1, reminderTime: 1 });

  // Filter for upcoming: future dates OR today but time not yet passed
  const upcoming = allReminders.filter((reminder) => {
    const reminderDate = new Date(reminder.reminderDate);
    const reminderYear = reminderDate.getFullYear();
    const reminderMonth = String(reminderDate.getMonth() + 1).padStart(2, '0');
    const reminderDay = String(reminderDate.getDate()).padStart(2, '0');
    const reminderDateStr = `${reminderYear}-${reminderMonth}-${reminderDay}`;

    // Future date
    if (reminderDateStr > todayStr) return true;

    // Today but time not yet passed
    if (reminderDateStr === todayStr) {
      const [hours = 0, minutes = 0] = (reminder.reminderTime || '00:00').split(':').map(Number);
      return (hours > currentHours) || (hours === currentHours && minutes > currentMinutes);
    }

    return false;
  });

  return upcoming.slice(0, limit);
};

// Static method to get overdue reminders (local timezone)
reminderSchema.statics.getOverdue = async function(userId) {
  const now = new Date();

  // Get today's LOCAL date as YYYY-MM-DD string
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const allReminders = await this.find({
    user: userId,
    isCompleted: false
  }).sort({ reminderDate: -1, reminderTime: -1 });

  // Filter for overdue: past dates OR today but time has passed
  return allReminders.filter((reminder) => {
    const reminderDate = new Date(reminder.reminderDate);
    const reminderYear = reminderDate.getFullYear();
    const reminderMonth = String(reminderDate.getMonth() + 1).padStart(2, '0');
    const reminderDay = String(reminderDate.getDate()).padStart(2, '0');
    const reminderDateStr = `${reminderYear}-${reminderMonth}-${reminderDay}`;

    // Past date
    if (reminderDateStr < todayStr) return true;

    // Today but time has passed
    if (reminderDateStr === todayStr) {
      const [hours = 0, minutes = 0] = (reminder.reminderTime || '00:00').split(':').map(Number);
      return (hours < currentHours) || (hours === currentHours && minutes <= currentMinutes);
    }

    return false;
  });
};

// Static method to get today's reminders (local timezone)
reminderSchema.statics.getToday = async function(userId) {
  const now = new Date();

  // Get today's LOCAL date as YYYY-MM-DD string
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

  // Get all incomplete reminders and filter by today's date
  const allReminders = await this.find({
    user: userId,
    isCompleted: false
  }).sort({ reminderTime: 1 });

  // Filter using LOCAL date string comparison
  return allReminders.filter((reminder) => {
    const reminderDate = new Date(reminder.reminderDate);
    const reminderYear = reminderDate.getFullYear();
    const reminderMonth = String(reminderDate.getMonth() + 1).padStart(2, '0');
    const reminderDay = String(reminderDate.getDate()).padStart(2, '0');
    const reminderDateStr = `${reminderYear}-${reminderMonth}-${reminderDay}`;
    return reminderDateStr === todayStr;
  });
};

// Pre-save hook for recurring reminders
reminderSchema.pre('save', function(next) {
  if (this.isModified('isCompleted') && this.isCompleted && this.isRecurring) {
    // Create next occurrence for recurring reminders
    // This will be handled in the controller
  }
  next();
});

const Reminder = mongoose.model('Reminder', reminderSchema);

export default Reminder;
