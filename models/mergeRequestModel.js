import mongoose from 'mongoose';

const mergeRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

// Ensure unique pair to prevent duplicate requests
mergeRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const MergeRequest = mongoose.model('MergeRequest', mergeRequestSchema);

export default MergeRequest;

