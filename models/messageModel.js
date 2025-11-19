import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // The mutual connection this message belongs to
  mutualConnection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MutualConnection',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: { type: String, required: true },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'video', 'file'], 
    default: 'text' 
  },
  mediaUrl: { type: String },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: true });

// Indexes for faster queries
messageSchema.index({ mutualConnection: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ mutualConnection: 1, isRead: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;


