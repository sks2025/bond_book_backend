import mongoose from 'mongoose';
import User from '../models/userModel.js';
import PendingUser from '../models/pendingUserModel.js';
import Post from '../models/postModel.js';
import FollowRequest from '../models/followRequestModel.js';
import MutualConnection from '../models/mutualConnectionModel.js';
import { createNotification } from './notificationController.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sendEmail from '../config/nodeMailer.js';

// Register a new user
export async function register(request, response) {
  try {
    const { username, email, password } = request.body;

    // Validation
    if (!username || !email || !password) {
      return response.status(400).json({ 
        success: false, 
        message: "Username, email and password are required" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if user already exists (finalized)
    const existingUser = await User.findOne({ 
      $or: [{ email: email.trim().toLowerCase() }, { username: username.trim() }] 
    });
    
    if (existingUser) {
      return response.status(409).json({ 
        success: false, 
        message: existingUser.email === email.toLowerCase() ? "Email already exists" : "Username already taken" 
      });
    }

    // Also ensure no pending registration for this email
    const existingPending = await PendingUser.findOne({ email: email.trim().toLowerCase() });
    if (existingPending) {
      await PendingUser.deleteOne({ _id: existingPending._id }); // replace with new OTP request
    }

    // Generate OTP for email verification (pre-registration)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Store as PendingUser until verified
    await PendingUser.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      otp,
      otpExpires
    });

    // Send verification email
    try {
      const subject = 'Welcome! Verify Your Account';
      const text = `Welcome to our platform! Your account has been created successfully with username: ${username}. Please verify your email address using the OTP: ${otp}. This OTP will expire in 10 minutes.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to our platform!</h2>
          <p>Your account has been created successfully with username: <strong>${username}</strong></p>
          <p>Please verify your email address using the OTP below:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p>If you didn't create this account, please ignore this email.</p>
        </div>
      `;

      await sendEmail(email, subject, text, html);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail registration if email fails
    }

    return response.status(200).json({ 
      success: true, 
      message: "OTP sent to email. Complete verification to create your account."
    });

  } catch (error) {
    console.error('Registration error:', error);
    return response.status(500).json({ 
      success: false, 
      message: "Internal server error during registration",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Verify OTP for email verification
export async function verifyOTP(request, response) {
  try {
    const { email, otp } = request.body;

    if (!email || !otp) {
      return response.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const pending = await PendingUser.findOne({ 
      email: email.trim().toLowerCase(),
      otp: otp,
      otpExpires: { $gt: new Date() }
    });

    if (!pending) {
      return response.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Before creating, ensure no existing user was created during window
    const existingUser = await User.findOne({ 
      $or: [{ email: pending.email }, { username: pending.username }] 
    });
    if (existingUser) {
      await PendingUser.deleteOne({ _id: pending._id });
      return response.status(409).json({
        success: false,
        message: "Account already exists for this email/username"
      });
    }

    // Create the real user from pending
    const user = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.password,
      isVerified: true
    });

    // Remove the pending record
    await PendingUser.deleteOne({ _id: pending._id });

    // Send verification confirmation email
    try {
      const subject = 'Email Verification Successful';
      const text = `Hello ${user.username}, Congratulations! Your email address has been successfully verified. You can now enjoy all the features of our platform. Thank you for joining us!`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Email Verification Successful!</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>Congratulations! Your email address has been successfully verified.</p>
          <p>You can now enjoy all the features of our platform.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d;">Account Details:</p>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Verified:</strong> ✅ Yes</p>
          </div>
          <p>Thank you for joining us!</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(user.email, subject, text, html);
    } catch (emailError) {
      console.error('Verification confirmation email sending failed:', emailError);
      // Don't fail verification if email fails
    }

    return response.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    return response.status(500).json({
      success: false,
      message: "Internal server error during OTP verification"
    });
  }
}

// Resend OTP
export async function resendOTP(request, response) {
  try {
    const { email } = request.body;

    if (!email) {
      return response.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Look up pending registration
    const pending = await PendingUser.findOne({ email: email.trim().toLowerCase() });
    if (!pending) {
      // If no pending, check if already verified user exists
      const existing = await User.findOne({ email: email.trim().toLowerCase() });
      if (existing) {
        return response.status(400).json({ success: false, message: "Email is already verified" });
      }
      return response.status(404).json({ success: false, message: "No pending registration found" });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    pending.otp = otp;
    pending.otpExpires = otpExpires;
    await pending.save();

    // Send new OTP email
    try {
      const subject = 'New Verification OTP';
      const text = `Here's your new verification OTP: ${otp}. This OTP will expire in 10 minutes.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Verification Code</h2>
          <p>Here's your new verification OTP:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
        </div>
      `;

      await sendEmail(email, subject, text, html);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return response.status(500).json({
        success: false,
        message: "Failed to send OTP email"
      });
    }

    return response.status(200).json({
      success: true,
      message: "New OTP sent successfully"
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return response.status(500).json({
      success: false,
      message: "Internal server error during OTP resend"
    });
  }
}

// Login user
export const loginUser = async (req, res) => {  
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
      
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { 
        expiresIn: '7d' 
      }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });

    // Send login notification email
    try {
      const currentTime = new Date().toLocaleString();
      const subject = 'Login Notification';
      const text = `Hello ${user.username}, You have successfully logged into your account at ${currentTime}. If you did not make this login, please change your password immediately and contact our support team.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">Login Notification</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>You have successfully logged into your account.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d;">Login Details:</p>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Login Time:</strong> ${currentTime}</p>
            <p style="margin: 5px 0;"><strong>Session Duration:</strong> 7 days</p>
          </div>
          <p>If you did not make this login, please change your password immediately and contact our support team.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is an automated security notification, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(user.email, subject, text, html);
    } catch (emailError) {
      console.error('Login notification email sending failed:', emailError);
      // Don't fail login if email fails
    }

    // Calculate followers and following counts
    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;

    // Get posts count
    let postsCount = user.postsCount || 0;
    if (!user.postsCount || user.postsCount === undefined) {
      postsCount = await Post.countDocuments({ user: user._id });
      if (postsCount > 0) {
        user.postsCount = postsCount;
        await user.save();
      }
    }

    // Remove password from response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      followersCount: followersCount,
      followingCount: followingCount,
      postsCount: postsCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      token: token
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: "Internal server error during login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Forgot Password - Send reset OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address"
      });
    }

    // Generate reset OTP
    const resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const resetOTPExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset OTP to user
    user.resetPasswordOTP = resetOTP;
    user.resetPasswordExpires = resetOTPExpires;
    await user.save();

    // Send reset OTP email
    try {
      const subject = 'Password Reset Request';
      const text = `Hello ${user.username}, You have requested to reset your password. Use the OTP below to reset your password: ${resetOTP}. This OTP will expire in 15 minutes. If you did not request this, please ignore this email.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Password Reset Request</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>You have requested to reset your password. Use the OTP below to reset your password:</p>
          <div style="background-color: #f8d7da; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #dc3545; font-size: 32px; margin: 0;">${resetOTP}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 15 minutes.</p>
          <p style="color: #dc3545;"><strong>Important:</strong> If you did not request this password reset, please ignore this email and consider changing your account password.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is a security-related email, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(email, subject, text, html);
    } catch (emailError) {
      console.error('Password reset email sending failed:', emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email address"
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during password reset request"
    });
  }
};

// Reset Password - Verify OTP and set new password
export const resetPassword = async (req, res) => {  
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, newPassword and confirmPassword are required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "newPassword and confirmPassword do not match"
      });
    }

    // Find user with valid reset OTP
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found"
      });
    }

    // Ensure OTP was verified recently
    if (!user.resetPasswordVerifiedUntil || user.resetPasswordVerifiedUntil <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reset OTP not verified or verification window expired"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset verification window
    user.password = hashedPassword;
    user.resetPasswordVerifiedUntil = undefined;
    await user.save();

    // Send password reset confirmation email
    try {
      const currentTime = new Date().toLocaleString();
      const subject = 'Password Reset Successful';
      const text = `Hello ${user.username}, Your password has been successfully reset at ${currentTime}. If you did not make this change, please contact our support team immediately.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Password Reset Successful!</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>Your password has been successfully reset.</p>
          <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #155724;">Password Reset Details:</p>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Reset Time:</strong> ${currentTime}</p>
          </div>
          <p style="color: #dc3545;"><strong>Security Notice:</strong> If you did not make this password change, please contact our support team immediately.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is a security notification, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(user.email, subject, text, html);
    } catch (emailError) {
      console.error('Password reset confirmation email sending failed:', emailError);
      // Don't fail password reset if email fails
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during password reset"
    });
  }
};

// Verify reset OTP (without changing password)
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: new Date() }
    }).select('_id email username');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as verified for a short window and clear OTP
    const verifyWindowMs = 15 * 60 * 1000; // 15 minutes
    await User.updateOne(
      { _id: user._id },
      {
        $set: { resetPasswordVerifiedUntil: new Date(Date.now() + verifyWindowMs) },
        $unset: { resetPasswordOTP: "", resetPasswordExpires: "" }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during OTP verification'
    });
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, bio, profilePicture } = req.body;

    if (!username && !bio && !profilePicture) {
      return res.status(400).json({
        success: false,
        message: "At least one field (username, bio, or profilePicture) is required to update"
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        username: username.trim(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Username already taken"
        });
      }
      user.username = username.trim();
    }

    // Update other fields if provided
    if (bio !== undefined) {
      user.bio = bio;
    }
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    await user.save();

    // Send profile update notification email
    try {
      const currentTime = new Date().toLocaleString();
      const subject = 'Profile Updated Successfully';
      const text = `Hello ${user.username}, Your profile has been successfully updated at ${currentTime}. If you did not make these changes, please contact our support team immediately.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">Profile Updated Successfully!</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>Your profile has been successfully updated.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d;">Profile Update Details:</p>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Bio:</strong> ${user.bio || 'Not set'}</p>
            <p style="margin: 5px 0;"><strong>Update Time:</strong> ${currentTime}</p>
          </div>
          <p style="color: #dc3545;"><strong>Security Notice:</strong> If you did not make these profile changes, please contact our support team immediately.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is a security notification, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(user.email, subject, text, html);
    } catch (emailError) {
      console.error('Profile update notification email sending failed:', emailError);
      // Don't fail profile update if email fails
    }

    // Calculate followers and following counts
    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;

    // Get posts count
    let postsCount = user.postsCount || 0;
    if (!user.postsCount || user.postsCount === undefined) {
      postsCount = await Post.countDocuments({ user: userId });
      if (postsCount > 0) {
        user.postsCount = postsCount;
        await user.save();
      }
    }

    // Return updated user data (without password)
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      followersCount: followersCount,
      followingCount: followingCount,
      postsCount: postsCount,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during profile update"
    });
  }
};

// Upload/Update Profile Picture (multipart form-data with a file)
export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Expecting a file from multer: either req.file or first entry in req.files
    const file = req.file || (req.files && req.files[0]);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture file is required'
      });
    }

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed for profile picture'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Save relative disk path
    user.profilePicture = file.path;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during profile picture upload'
    });
  }
};

// Update Bio
export const updateBio = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bio } = req.body;

    if (bio === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Bio is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update bio
    user.bio = bio || '';
    await user.save();

    // Calculate followers and following counts
    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;

    // Get posts count
    let postsCount = user.postsCount || 0;
    if (!user.postsCount || user.postsCount === undefined) {
      postsCount = await Post.countDocuments({ user: userId });
      if (postsCount > 0) {
        user.postsCount = postsCount;
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Bio updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
        followersCount: followersCount,
        followingCount: followingCount,
        postsCount: postsCount
      }
    });
  } catch (error) {
    console.error('Update bio error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during bio update'
    });
  }
};

// Delete Profile
export const deleteProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Send account deletion notification email before deletion
    try {
      const currentTime = new Date().toLocaleString();
      const subject = 'Account Deletion Confirmation';
      const text = `Hello ${user.username}, Your account has been permanently deleted at ${currentTime}. We're sorry to see you go. If you did not request this deletion, please contact our support team immediately as this action cannot be undone.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Account Deleted</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>Your account has been permanently deleted.</p>
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #721c24;">Account Deletion Details:</p>
            <p style="margin: 5px 0;"><strong>Username:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Deletion Time:</strong> ${currentTime}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Permanently Deleted</p>
          </div>
          <p style="color: #dc3545;"><strong>Important:</strong> This action cannot be undone. If you did not request this deletion, please contact our support team immediately.</p>
          <p>We're sorry to see you go and hope you'll consider rejoining us in the future.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">This is a security notification, please do not reply to this email.</p>
        </div>
      `;

      await sendEmail(user.email, subject, text, html);
    } catch (emailError) {
      console.error('Account deletion notification email sending failed:', emailError);
      // Still proceed with deletion even if email fails
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    // Clear authentication cookie
    res.clearCookie('token');

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    });

  } catch (error) {
    console.error('Delete profile error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during account deletion"
    });
  }
};

// Get Current User Profile
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('-password -otp -otpExpires -resetPasswordOTP -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Ensure postsCount exists, if not calculate it
    let postsCount = user.postsCount || 0;
    if (!user.postsCount || user.postsCount === undefined) {
      postsCount = await Post.countDocuments({ user: userId });
      // Update user with postsCount if it was missing
      if (postsCount > 0) {
        user.postsCount = postsCount;
        await user.save();
      }
    }

    // Calculate followers and following counts from arrays
    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;

    const userResponse = {
      ...user.toObject(),
      postsCount: postsCount,
      followersCount: followersCount,
      followingCount: followingCount
    };

    return res.status(200).json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Follow a user
export const followUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { followUserId } = req.body;

    if (!followUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID to follow is required'
      });
    }

    // Convert to string for consistent comparison
    const currentUserIdStr = userId.toString();
    const followUserIdStr = followUserId.toString();

    if (currentUserIdStr === followUserIdStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    const userToFollow = await User.findById(followUserId);
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User to follow not found'
      });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Current user not found'
      });
    }

    // Check if already following (convert to string for proper comparison)
    const isAlreadyFollowing = currentUser.following.some(
      id => id.toString() === followUserIdStr
    );
    
    if (isAlreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Add to following list
    currentUser.following.push(followUserId);
    await currentUser.save();

    // Add to user's followers list (only if not already in the list)
    const isAlreadyFollower = userToFollow.followers.some(
      id => id.toString() === currentUserIdStr
    );
    
    if (!isAlreadyFollower) {
      userToFollow.followers.push(userId);
      await userToFollow.save();
    }

    return res.status(200).json({
      success: true,
      message: 'User followed successfully',
      following: currentUser.following.length,
      followers: userToFollow.followers.length
    });

  } catch (error) {
    console.error('Follow user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Unfollow a user
export const unfollowUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { unfollowUserId } = req.body;

    if (!unfollowUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID to unfollow is required'
      });
    }

    // Convert to string for consistent comparison
    const currentUserIdStr = userId.toString();
    const unfollowUserIdStr = unfollowUserId.toString();

    const userToUnfollow = await User.findById(unfollowUserId);
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'User to unfollow not found'
      });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Current user not found'
      });
    }

    // Check if currently following (convert to string for proper comparison)
    const isCurrentlyFollowing = currentUser.following.some(
      id => id.toString() === unfollowUserIdStr
    );
    
    if (!isCurrentlyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Not following this user'
      });
    }

    // Remove from following list
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== unfollowUserIdStr
    );
    await currentUser.save();

    // Remove from user's followers list
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUserIdStr
    );
    await userToUnfollow.save();

    return res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
      following: currentUser.following.length,
      followers: userToUnfollow.followers.length
    });

  } catch (error) {
    console.error('Unfollow user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle follow - Send follow request or unfollow
export const toggleFollow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const followUserId = req.body.userId || req.body.followUserId;

    // Validation
    if (!followUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const currentUserIdStr = userId.toString();
    const followUserIdStr = followUserId.toString();

    // Cannot follow yourself
    if (currentUserIdStr === followUserIdStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send follow request to yourself'
      });
    }

    // Find users
    const [currentUser, userToFollow] = await Promise.all([
      User.findById(userId),
      User.findById(followUserId)
    ]);

    if (!currentUser || !userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following (in actual following array)
    const isCurrentlyFollowing = currentUser.following.some(
      id => id.toString() === followUserIdStr
    );

    // If already following, unfollow
    if (isCurrentlyFollowing) {
      // Remove from current user's following list
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== followUserIdStr
      );
      
      // Remove from target user's followers list
      userToFollow.followers = userToFollow.followers.filter(
        id => id.toString() !== currentUserIdStr
      );

      await Promise.all([currentUser.save(), userToFollow.save()]);

      // Clean up any existing follow request
      await FollowRequest.findOneAndDelete({
        requester: userId,
        recipient: followUserId
      });

      return res.status(200).json({
        success: true,
        message: 'User unfollowed successfully',
        isFollowing: false,
        action: 'unfollowed',
        followingCount: currentUser.following.length,
        followersCount: userToFollow.followers.length
      });
    }

    // Check for existing follow request
    const existingRequest = await FollowRequest.findOne({
      requester: userId,
      recipient: followUserId
    });

    // If request exists and is pending, return error
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'Follow request already sent',
          requestId: existingRequest._id,
          status: existingRequest.status
        });
      }

      // If request was accepted/rejected, delete it and create new one
      if (existingRequest.status === 'accepted' || existingRequest.status === 'rejected') {
        await FollowRequest.findByIdAndDelete(existingRequest._id);
      }
    }

    // Create new follow request
    try {
      const newRequest = await FollowRequest.create({
        requester: userId,
        recipient: followUserId,
        status: 'pending'
      });

      await newRequest.populate('requester', 'username profilePicture');
      await newRequest.populate('recipient', 'username profilePicture');

      // Create notification for recipient (they received a follow request)
      // Use the populated requester username from newRequest
      const requesterUsername = newRequest.requester.username || currentUser.username;
      await createNotification(
        followUserId, // Notify the recipient
        userId, // From the requester (current user)
        'follow_request',
        `${requesterUsername} sent you a follow request`,
        newRequest._id, // Related to the follow request
        'FollowRequest'
      ).catch(err => console.error('Error creating follow request notification:', err));

      return res.status(201).json({
        success: true,
        message: 'Follow request sent successfully',
        request: {
          _id: newRequest._id,
          requester: {
            _id: newRequest.requester._id,
            username: newRequest.requester.username,
            profilePicture: newRequest.requester.profilePicture
          },
          recipient: {
            _id: newRequest.recipient._id,
            username: newRequest.recipient.username,
            profilePicture: newRequest.recipient.profilePicture
          },
          status: newRequest.status,
          createdAt: newRequest.createdAt
        }
      });
    } catch (createError) {
      if (createError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Follow request already exists'
        });
      }
      throw createError;
    }

  } catch (error) {
    console.error('Toggle follow error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// List follow requests (incoming and outgoing)
export const listFollowRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch incoming and outgoing requests in parallel
    const [incoming, outgoing] = await Promise.all([
      // Incoming: requests where current user is the recipient
      FollowRequest.find({
        recipient: userId,
        status: 'pending'
      })
        .populate('requester', 'username profilePicture email')
        .sort({ createdAt: -1 })
        .lean(),
      
      // Outgoing: requests where current user is the requester
      FollowRequest.find({
        requester: userId,
        status: 'pending'
      })
        .populate('recipient', 'username profilePicture email')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Format the response
    const formatRequest = (req) => ({
      _id: req._id,
      status: req.status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      ...(req.requester && {
        requester: {
          _id: req.requester._id,
          username: req.requester.username,
          profilePicture: req.requester.profilePicture,
          email: req.requester.email
        }
      }),
      ...(req.recipient && {
        recipient: {
          _id: req.recipient._id,
          username: req.recipient.username,
          profilePicture: req.recipient.profilePicture,
          email: req.recipient.email
        }
      })
    });

    return res.status(200).json({
      success: true,
      incoming: incoming.map(formatRequest),
      outgoing: outgoing.map(formatRequest),
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length,
        total: incoming.length + outgoing.length
      }
    });

  } catch (error) {
    console.error('List follow requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Accept a follow request
export const acceptFollowRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    // Find the follow request
    const request = await FollowRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Authorization check - only recipient can accept
    if (request.recipient.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this request'
      });
    }

    // Status check - only pending requests can be accepted
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept request. Request is already ${request.status}`
      });
    }

    // Find both users
    const [requester, recipient] = await Promise.all([
      User.findById(request.requester),
      User.findById(request.recipient)
    ]);

    if (!requester || !recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const requesterIdStr = requester._id.toString();
    const recipientIdStr = recipient._id.toString();

    // Add follow relationship
    // Add recipient to requester's following list
    if (!requester.following.some(id => id.toString() === recipientIdStr)) {
      requester.following.push(recipient._id);
    }

    // Add requester to recipient's followers list
    if (!recipient.followers.some(id => id.toString() === requesterIdStr)) {
      recipient.followers.push(requester._id);
    }

    // Update request status
    request.status = 'accepted';

    // Save all changes in parallel
    await Promise.all([
      requester.save(),
      recipient.save(),
      request.save()
    ]);

    // Create notification for requester (follow request accepted)
    await createNotification(
      requester._id,
      recipient._id,
      'follow_accepted',
      `${recipient.username} accepted your follow request`,
      recipient._id,
      'User'
    ).catch(err => console.error('Notification error:', err));

    // Create mutual connection profile
    const [user1Id, user2Id] = [requester._id, recipient._id].sort((a, b) => 
      a.toString().localeCompare(b.toString())
    );
    
    // Generate connectionId before creating (required field)
    const [id1, id2] = [user1Id.toString(), user2Id.toString()].sort();
    const connectionId = `${id1}_${id2}`;
    
    let mutualConnection = await MutualConnection.findOne({
      $or: [
        { user1: user1Id, user2: user2Id },
        { user1: user2Id, user2: user1Id },
        { connectionId: connectionId }
      ]
    });

    if (!mutualConnection) {
      // Generate displayName from usernames
      const names = [requester.username, recipient.username].sort((a, b) => a.localeCompare(b));
      const displayName = `${names[0]} & ${names[1]}`;
      
      // Create new mutual connection profile
      mutualConnection = await MutualConnection.create({
        user1: user1Id,
        user2: user2Id,
        connectionId: connectionId,
        displayName: displayName,
        createdFrom: request._id,
        isActive: true
      });

      // Notify both users that they became friends (mutual connection created)
      await Promise.all([
        createNotification(
          requester._id,
          recipient._id,
          'mutual_connection_created',
          `You and ${recipient.username} are now connected! Mutual connection profile created.`,
          mutualConnection._id,
          'MutualConnection'
        ).catch(err => console.error('Error creating mutual connection notification for requester:', err)),
        createNotification(
          recipient._id,
          requester._id,
          'mutual_connection_created',
          `You and ${requester.username} are now connected! Mutual connection profile created.`,
          mutualConnection._id,
          'MutualConnection'
        ).catch(err => console.error('Error creating mutual connection notification for recipient:', err))
      ]);
    } else if (!mutualConnection.isActive) {
      // Reactivate if it was deactivated
      mutualConnection.isActive = true;
      await mutualConnection.save();

      // Notify both users that their connection was reactivated
      await Promise.all([
        createNotification(
          requester._id,
          recipient._id,
          'mutual_connection_reactivated',
          `Your mutual connection with ${recipient.username} has been reactivated.`,
          mutualConnection._id,
          'MutualConnection'
        ).catch(err => console.error('Error creating reactivation notification for requester:', err)),
        createNotification(
          recipient._id,
          requester._id,
          'mutual_connection_reactivated',
          `Your mutual connection with ${requester.username} has been reactivated.`,
          mutualConnection._id,
          'MutualConnection'
        ).catch(err => console.error('Error creating reactivation notification for recipient:', err))
      ]);
    }

    // Note: Chat functionality is now handled through MutualConnection
    // Messages are stored with reference to the mutual connection

    return res.status(200).json({
      success: true,
      message: 'Follow request accepted successfully. Mutual connection profile created.',
      isFollowing: true,
      mutualConnection: {
        _id: mutualConnection._id,
        connectionId: mutualConnection.connectionId,
        displayName: mutualConnection.displayName
      },
      request: {
        _id: request._id,
        status: request.status,
        requester: {
          _id: requester._id,
          username: requester.username
        },
        recipient: {
          _id: recipient._id,
          username: recipient.username
        }
      },
      counts: {
        following: requester.following.length,
        followers: recipient.followers.length
      }
    });

  } catch (error) {
    console.error('Accept follow request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reject a follow request
export const rejectFollowRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    // Find the follow request
    const request = await FollowRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    // Authorization check - only recipient can reject
    if (request.recipient.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this request'
      });
    }

    // Status check - only pending requests can be rejected
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request. Request is already ${request.status}`
      });
    }

    // Update request status to rejected
    request.status = 'rejected';
    await request.save();

    return res.status(200).json({
      success: true,
      message: 'Follow request rejected successfully',
      request: {
        _id: request._id,
        status: request.status
      }
    });

  } catch (error) {
    console.error('Reject follow request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if users follow each other (mutual connection)
export const checkConnection = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Other user ID is required'
      });
    }

    const currentUser = await User.findById(userId);
    const otherUser = await User.findById(otherUserId);

    if (!currentUser || !otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert to string for proper comparison with ObjectIds
    const isFollowing = currentUser.following.some(
      id => id.toString() === otherUserId.toString()
    );
    const isFollowedBy = otherUser.following.some(
      id => id.toString() === userId.toString()
    );
    const isConnected = isFollowing && isFollowedBy;

    return res.status(200).json({
      success: true,
      isFollowing,
      isFollowedBy,
      isConnected
    });

  } catch (error) {
    console.error('Check connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check follow request status for a specific user
export const checkFollowRequestStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetUserId } = req.params;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    const currentUserIdStr = userId.toString();
    const targetUserIdStr = targetUserId.toString();

    if (currentUserIdStr === targetUserIdStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check follow request status for yourself'
      });
    }

    // Check if already following
    const currentUser = await User.findById(userId).select('following');
    const isFollowing = currentUser?.following.some(
      id => id.toString() === targetUserIdStr
    ) || false;

    // Check for pending follow request
    const pendingRequest = await FollowRequest.findOne({
      requester: userId,
      recipient: targetUserId,
      status: 'pending'
    });

    const hasPendingRequest = !!pendingRequest;

    return res.status(200).json({
      success: true,
      isFollowing,
      hasPendingRequest,
      requestId: pendingRequest?._id || null,
      status: isFollowing ? 'following' : hasPendingRequest ? 'pending' : 'none'
    });
  } catch (error) {
    console.error('Check follow request status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check follow request status by postId
export const checkFollowRequestByPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required'
      });
    }

    // Import Post model
    const Post = (await import('../models/postModel.js')).default;

    // Get post and populate user
    const post = await Post.findById(postId).select('user');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const postOwnerId = post.user.toString();
    const currentUserIdStr = userId.toString();

    // If post owner is current user, return early
    if (currentUserIdStr === postOwnerId) {
      return res.status(200).json({
        success: true,
        isOwnPost: true,
        isFollowing: false,
        hasPendingRequest: false,
        status: 'own_post'
      });
    }

    // Check if already following
    const currentUser = await User.findById(userId).select('following');
    const isFollowing = currentUser?.following.some(
      id => id.toString() === postOwnerId
    ) || false;

    // Check for pending follow request
    const pendingRequest = await FollowRequest.findOne({
      requester: userId,
      recipient: post.user,
      status: 'pending'
    });

    const hasPendingRequest = !!pendingRequest;

    return res.status(200).json({
      success: true,
      isOwnPost: false,
      postOwnerId: postOwnerId,
      isFollowing,
      hasPendingRequest,
      requestId: pendingRequest?._id || null,
      status: isFollowing ? 'following' : hasPendingRequest ? 'pending' : 'none'
    });
  } catch (error) {
    console.error('Check follow request by post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout User
export const logoutUser = async (req, res) => {
  try {
    // Clear the authentication cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during logout"
    });
  }
};
