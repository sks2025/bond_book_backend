import mongoose from 'mongoose';
import MutualConnection from './mutualConnectionModel.js';

const mutualConnectionPostSchema = new mongoose.Schema({
  mutualConnection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MutualConnection',
    required: true
  },
  // Who created this post (one of the two users)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: { type: String },
  video: { type: String },
  caption: { type: String, default: "" },
  tags: [{ type: String }],
  location: { type: String },
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

// Index for faster queries
mutualConnectionPostSchema.index({ mutualConnection: 1, createdAt: -1 });
mutualConnectionPostSchema.index({ createdBy: 1 });

// Simple validation - at least one media file required
mutualConnectionPostSchema.pre('validate', function(next) {
  if (!this.image && !this.video) {
    return next(new Error('Post must have either an image or video'));
  }
  next();
});

// Update post count when post is created
mutualConnectionPostSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      await MutualConnection.findByIdAndUpdate(this.mutualConnection, {
        $inc: { postsCount: 1 }
      });
    } catch (error) {
      console.error('Error updating posts count:', error);
    }
  }
  next();
});

// Update post count when post is deleted
mutualConnectionPostSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    await MutualConnection.findByIdAndUpdate(this.mutualConnection, {
      $inc: { postsCount: -1 }
    });
  } catch (error) {
    console.error('Error decrementing posts count:', error);
  }
  next();
});

mutualConnectionPostSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      await MutualConnection.findByIdAndUpdate(doc.mutualConnection, {
        $inc: { postsCount: -1 }
      });
    } catch (error) {
      console.error('Error decrementing posts count:', error);
    }
  }
});

// Like methods
mutualConnectionPostSchema.methods.likePost = function(userId) {
  if (!this.likedBy.some(id => id.toString() === userId.toString())) {
    this.likedBy.push(userId);
    this.likes = this.likedBy.length;
    this.likeCount = this.likedBy.length;
  }
  return this.save();
};

mutualConnectionPostSchema.methods.unlikePost = function(userId) {
  this.likedBy = this.likedBy.filter(id => id.toString() !== userId.toString());
  this.likes = this.likedBy.length;
  this.likeCount = this.likedBy.length;
  return this.save();
};

mutualConnectionPostSchema.methods.isLikedBy = function(userId) {
  return this.likedBy.some(id => id.toString() === userId.toString());
};

// Comment methods
mutualConnectionPostSchema.methods.addComment = function(userId, comment) {
  this.comments.push({ user: userId, comment });
  this.commentCount = this.comments.length;
  return this.save();
};

mutualConnectionPostSchema.methods.removeComment = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (comment && comment.user.toString() === userId.toString()) {
    comment.deleteOne();
    this.commentCount = this.comments.length;
    return this.save();
  }
  throw new Error('Comment not found or not authorized');
};

const MutualConnectionPost = mongoose.model('MutualConnectionPost', mutualConnectionPostSchema);
export default MutualConnectionPost;


