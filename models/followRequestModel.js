import mongoose from 'mongoose';

const followRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

// Ensure unique pair to prevent duplicate requests
followRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);
export default FollowRequest;

