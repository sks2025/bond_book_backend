import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: { type: String },
  video: { type: String },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// TTL index - MongoDB will automatically delete documents after expiresAt
// This runs every 60 seconds at the database level
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Validation - at least one media file required
storySchema.pre('validate', function(next) {
  if (!this.image && !this.video) {
    return next(new Error('Story must have either an image or video'));
  }
  next();
});

const Story = mongoose.model('Story', storySchema);
export default Story;