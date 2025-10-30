import mongoose from 'mongoose';

const chatConnectionSchema = new mongoose.Schema({
  users: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    validate: [arr => Array.isArray(arr) && arr.length === 2, 'Connection requires two users']
  }
}, { timestamps: true });

// Ensure unique pair regardless of order
chatConnectionSchema.index({ users: 1 }, { unique: true });

const ChatConnection = mongoose.model('ChatConnection', chatConnectionSchema);
export default ChatConnection;


