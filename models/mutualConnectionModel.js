import mongoose from 'mongoose';

const mutualConnectionSchema = new mongoose.Schema({
  // The two users in this connection
  user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Unique identifier for this connection (e.g., "userA_userB")
  connectionId: { type: String, required: true, unique: true },
  
  // Profile details
  profilePicture: { type: String, default: "" },
  bio: { type: String, default: "" },
  displayName: { type: String, default: "" }, // e.g., "Alice & Bob"
  
  // Social features
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  postsCount: { type: Number, default: 0 },
  
  // Reference to the follow request that created this
  createdFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'FollowRequest' },
  
  // Status
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique pair and create connectionId
mutualConnectionSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate connectionId if not already provided
    if (!this.connectionId && this.user1 && this.user2) {
      const [id1, id2] = [this.user1.toString(), this.user2.toString()].sort();
      this.connectionId = `${id1}_${id2}`;
    }
    
    // Set display name from usernames if not already provided
    if (!this.displayName && this.user1 && this.user2) {
      try {
        const User = mongoose.model('User');
        const [user1, user2] = await User.find({ 
          _id: { $in: [this.user1, this.user2] } 
        }).select('username');
        if (user1 && user2) {
          const names = [user1.username, user2.username].sort((a, b) => a.localeCompare(b));
          this.displayName = `${names[0]} & ${names[1]}`;
        }
      } catch (error) {
        console.error('Error setting display name:', error);
      }
    }
  }
  next();
});

// Index for faster lookups
mutualConnectionSchema.index({ user1: 1, user2: 1 }, { unique: true });
// connectionId already has unique: true in schema definition, no need for explicit index

const MutualConnection = mongoose.model('MutualConnection', mutualConnectionSchema);
export default MutualConnection;


