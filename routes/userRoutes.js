import express from 'express';
import { 
  register, 
  loginUser, 
  verifyOTP, 
  resendOTP,
  forgotPassword,
  resetPassword,
  verifyResetOTP,
  updateProfile,
  deleteProfile,
  getCurrentUser,
  logoutUser,
  uploadProfilePicture,
  updateBio,
  toggleFollow,
  listFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  checkConnection
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
userRouter.post('/verify-reset-otp', verifyResetOTP);
userRouter.post('/logout', logoutUser);

// Protected routes (authentication required)
userRouter.get('/profile', userAuth, getCurrentUser);
userRouter.put('/update-profile', userAuth, updateProfile);
// Upload profile picture (form-data -> file field name can be any; using upload.any())
userRouter.put('/profile-picture', userAuth, upload.any(), uploadProfilePicture);
// Update bio
userRouter.put('/bio', userAuth, updateBio);
userRouter.delete('/delete-profile', userAuth, deleteProfile);

// Follow/Unfollow routes (must be before any /:id routes to avoid conflicts)
userRouter.post('/toggle-follow', userAuth, toggleFollow);
userRouter.get('/follow-requests', userAuth, listFollowRequests);
userRouter.post('/follow-requests/:requestId/accept', userAuth, acceptFollowRequest);
userRouter.post('/follow-requests/:requestId/reject', userAuth, rejectFollowRequest);
userRouter.get('/connection/:otherUserId', userAuth, checkConnection);

export default userRouter;
