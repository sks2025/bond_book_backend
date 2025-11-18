import mongoose from 'mongoose';
import User from './userModel.js';

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: { type: String },
  video: { type: String },
  caption: { type: String, default: "" },
  tags: [{ type: String }],
  location: { type: String },
  isPrivate: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  commentCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 }
}, { timestamps: true });

// Index for faster per-user queries
postSchema.index({ user: 1, createdAt: -1 });

// Simple validation - at least one media file required
postSchema.pre('validate', function(next) {
  if (!this.image && !this.video) {
    return next(new Error('Post must have either an image or video'));
  }
  next();
});

// Like methods
postSchema.methods.likePost = function(userId) {
  if (!this.likedBy.includes(userId)) {
    this.likedBy.push(userId);
    this.likes = this.likedBy.length;
    this.likeCount = this.likedBy.length;
  }
  return this.save();
};

postSchema.methods.unlikePost = function(userId) {
  this.likedBy = this.likedBy.filter(id => id.toString() !== userId.toString());
  this.likes = this.likedBy.length;
  this.likeCount = this.likedBy.length;
  return this.save();
};

postSchema.methods.isLikedBy = function(userId) {
  return this.likedBy.includes(userId);
};

// Comment methods
postSchema.methods.addComment = function(userId, comment) {
  this.comments.push({ user: userId, comment });
  this.commentCount = this.comments.length;
  return this.save();
};

postSchema.methods.removeComment = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (comment && comment.user.toString() === userId.toString()) {
    comment.deleteOne();
    this.commentCount = this.comments.length;
    return this.save();
  }
  throw new Error('Comment not found or not authorized');
};

// Maintain user's postsCount similar to followers/following counts
postSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      await User.findByIdAndUpdate(this.user, { $inc: { postsCount: 1 } });
    }
    next();
  } catch (err) {
    next(err);
  }
});

postSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    await User.findByIdAndUpdate(this.user, { $inc: { postsCount: -1 } });
    next();
  } catch (err) {
    next(err);
  }
});

postSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await User.findByIdAndUpdate(doc.user, { $inc: { postsCount: -1 } });
  }
});

// Static: total posts created by a specific user
postSchema.statics.countPostsByUser = function(userId) {
  return this.countDocuments({ user: userId });
};

const Post = mongoose.model('Post', postSchema);
export default Post;