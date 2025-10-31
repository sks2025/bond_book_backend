import User from '../models/userModel.js';
import PendingUser from '../models/pendingUserModel.js';
import Post from '../models/postModel.js';
import FollowRequest from '../models/followRequestModel.js';
import ChatConnection from '../models/chatConnectionModel.js';
import ChatProfile from '../models/chatProfileModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sendEmail from '../config/nodeMailer.js';
import { getFileUrl } from '../utils/urlHelper.js';

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
      profilePictureUrl: getFileUrl(user.profilePicture, req),
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
      profilePictureUrl: getFileUrl(user.profilePicture, req),
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

    const profilePictureUrl = getFileUrl(user.profilePicture, req);

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: user.profilePicture,
      profilePictureUrl
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
        profilePictureUrl: getFileUrl(user.profilePicture, req),
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
      followingCount: followingCount,
      profilePictureUrl: getFileUrl(user.profilePicture, req)
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

// Send a follow request (toggle follow now sends a request)
export const toggleFollow = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Support both 'userId' and 'followUserId' for backward compatibility
    const followUserId = req.body.userId || req.body.followUserId;

    if (!followUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Convert to string for consistent comparison
    const currentUserIdStr = userId.toString();
    const followUserIdStr = followUserId.toString();

    if (currentUserIdStr === followUserIdStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send follow request to yourself'
      });
    }

    const userToFollow = await User.findById(followUserId);
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Current user not found'
      });
    }

    // Check if already following
    const isCurrentlyFollowing = currentUser.following.some(
      id => id.toString() === followUserIdStr
    );

    if (isCurrentlyFollowing) {
      // Unfollow: Remove from following list
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== followUserIdStr
      );
      await currentUser.save();

      // Remove from user's followers list
      userToFollow.followers = userToFollow.followers.filter(
        id => id.toString() !== currentUserIdStr
      );
      await userToFollow.save();

      // Delete any pending follow request
      await FollowRequest.findOneAndDelete({
        requester: userId,
        recipient: followUserId
      });

      return res.status(200).json({
        success: true,
        message: 'User unfollowed successfully',
        isFollowing: false,
        following: currentUser.following.length,
        followers: userToFollow.followers.length
      });
    }

    // Check if already has a pending request
    const existingRequest = await FollowRequest.findOne({
      requester: userId,
      recipient: followUserId
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'Follow request already sent',
          request: existingRequest
        });
      } else if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Already following this user'
        });
      }
    }

    // Create a new follow request
    const request = await FollowRequest.create({
      requester: userId,
      recipient: followUserId
    });

    return res.status(201).json({
      success: true,
      message: 'Follow request sent successfully',
      request: request
    });

  } catch (error) {
    console.error('Send follow request error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Follow request already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// List follow requests (incoming and outgoing)
export const listFollowRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    const incoming = await FollowRequest.find({ recipient: userId, status: 'pending' })
      .populate('requester', 'username profilePicture email')
      .sort({ createdAt: -1 });

    const outgoing = await FollowRequest.find({ requester: userId, status: 'pending' })
      .populate('recipient', 'username profilePicture email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      incoming,
      outgoing
    });
  } catch (error) {
    console.error('List follow requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Accept a follow request
export const acceptFollowRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    const request = await FollowRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    if (request.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this request'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`
      });
    }

    const requester = await User.findById(request.requester);
    const recipient = await User.findById(request.recipient);

    if (!requester || !recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update follow relationship
    const requesterIdStr = request.requester.toString();
    const recipientIdStr = request.recipient.toString();

    // Add to requester's following list
    const isAlreadyFollowing = requester.following.some(
      id => id.toString() === recipientIdStr
    );
    if (!isAlreadyFollowing) {
      requester.following.push(request.recipient);
      await requester.save();
    }

    // Add to recipient's followers list
    const isAlreadyFollower = recipient.followers.some(
      id => id.toString() === requesterIdStr
    );
    if (!isAlreadyFollower) {
      recipient.followers.push(request.requester);
      await recipient.save();
    }

    // Update request status
    request.status = 'accepted';
    await request.save();

    // Create chat connection
    const usersPair = [request.requester.toString(), request.recipient.toString()].sort();
    const connection = await ChatConnection.findOneAndUpdate(
      { users: usersPair },
      { $setOnInsert: { users: usersPair } },
      { upsert: true, new: true }
    );

    // Create chat profile if not exists
    const existingProfile = await ChatProfile.findOne({ connection: connection._id });
    if (!existingProfile) {
      const bothUsers = await User.find({ _id: { $in: usersPair } }, 'username');
      const names = bothUsers.map(u => u.username).sort((a, b) => a.localeCompare(b));
      const title = `${names[0]} & ${names[1]}`;
      await ChatProfile.create({ connection: connection._id, users: usersPair, title });
    }

    return res.status(200).json({
      success: true,
      message: 'Follow request accepted. Chat connection created.',
      isFollowing: true,
      following: requester.following.length,
      followers: recipient.followers.length
    });

  } catch (error) {
    console.error('Accept follow request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reject a follow request
export const rejectFollowRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    const request = await FollowRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found'
      });
    }

    if (request.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this request'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`
      });
    }

    request.status = 'rejected';
    await request.save();

    return res.status(200).json({
      success: true,
      message: 'Follow request rejected'
    });

  } catch (error) {
    console.error('Reject follow request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
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
