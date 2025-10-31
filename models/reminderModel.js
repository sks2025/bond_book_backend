import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  reminderDate: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  forUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If null, reminder is for creator
  isCompleted: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  repeat: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' }
}, { timestamps: true });

// Index for efficient queries
reminderSchema.index({ createdBy: 1, reminderDate: 1 });
reminderSchema.index({ forUser: 1, reminderDate: 1 });

const Reminder = mongoose.model('Reminder', reminderSchema);
export default Reminder;

