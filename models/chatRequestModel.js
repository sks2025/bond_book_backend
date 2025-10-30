import mongoose from 'mongoose';

const chatRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

chatRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const ChatRequest = mongoose.model('ChatRequest', chatRequestSchema);
export default ChatRequest;


