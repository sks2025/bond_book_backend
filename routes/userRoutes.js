import express from 'express';
import { 
  register, 
  loginUser, 
  verifyOTP, 
  resendOTP,
  forgotPassword,
  resetPassword,
  updateProfile,
  deleteProfile,
  getCurrentUser,
  logoutUser,
  uploadProfilePicture
} from '../controllers/UserController.js';
import userAuth from '../middleware/userAuth.js';
import upload from '../middleware/upload.js';

const userRouter = express.Router();

// Public routes (no authentication required)
userRouter.post('/register', register);
userRouter.post('/verify-otp', verifyOTP);
userRouter.post('/resend-otp', resendOTP);
userRouter.post('/login', loginUser);
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);
userRouter.post('/logout', logoutUser);

// Protected routes (authentication required)
userRouter.get('/profile', userAuth, getCurrentUser);
userRouter.put('/update-profile', userAuth, updateProfile);
// Upload profile picture (form-data -> file field name can be any; using upload.any())
userRouter.put('/profile-picture', userAuth, upload.any(), uploadProfilePicture);
userRouter.delete('/delete-profile', userAuth, deleteProfile);

export default userRouter;
