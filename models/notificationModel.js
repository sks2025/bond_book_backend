import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for faster queries
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['follow_request', 'follow_accepted', 'new_post', 'new_story', 'profile_update', 'merge_request', 'merge_request_accepted', 'merge_request_rejected', 'mutual_connection_created', 'mutual_connection_reactivated'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel',
    default: null
  },
  relatedModel: {
    type: String,
    enum: ['Post', 'Story', 'User', 'FollowRequest', 'MergeRequest', 'MutualConnection', null],
    default: null
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });

// Index for faster queries - get unread notifications for a user
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Index for faster queries - get all notifications for a user
notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

