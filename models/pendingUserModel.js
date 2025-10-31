import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  password: { type: String, required: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true }
}, { timestamps: true });

pendingUserSchema.index({ email: 1 }, { unique: true });

const PendingUser = mongoose.model('PendingUser', pendingUserSchema);
export default PendingUser;


