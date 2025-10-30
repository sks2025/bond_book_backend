import mongoose from 'mongoose';

const chatProfileSchema = new mongoose.Schema({
  connection: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConnection', required: true, unique: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  title: { type: String, required: true } // e.g., "alice & bob"
}, { timestamps: true });

chatProfileSchema.index({ connection: 1 }, { unique: true });

const ChatProfile = mongoose.model('ChatProfile', chatProfileSchema);
export default ChatProfile;


