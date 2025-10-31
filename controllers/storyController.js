import mongoose from 'mongoose';
import Story from '../models/storyModel.js';
import User from '../models/userModel.js';
import multer from 'multer';
import { addUrlsToStory, addUrlsToStories, getFileUrl } from '../utils/urlHelper.js';
// Create a new story
export const createStory = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get file from request (upload.any() puts files in req.files array)
    const file = req.file || (req.files && req.files[0]);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image or video file is required for story"
      });
    }

    // Check if it's an image or video file
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return res.status(400).json({
        success: false,
        message: "Only image and video files are allowed for stories"
      });
    }

    // Set expiration time (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create story data
    const storyData = {
      user: userId,
      expiresAt
    };

    // Add image or video based on file type
    if (file.mimetype.startsWith('image/')) {
      storyData.image = file.path;
    } else if (file.mimetype.startsWith('video/')) {
      storyData.video = file.path;
    }

    // Create new story
    const newStory = new Story(storyData);
    const savedStory = await newStory.save();
    
    // Populate user details
    const populatedStory = await Story.findById(savedStory._id)
      .populate('user', 'username profilePicture');

    // Add URL to the story
    const storyWithUrl = addUrlsToStory(populatedStory, req);

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      story: storyWithUrl
    });

  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating story",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all active stories (not expired)
export const getAllStories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get current time to filter out expired stories
    const currentTime = new Date();

    const stories = await Story.find({ 
      expiresAt: { $gt: currentTime } 
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalStories = await Story.countDocuments({ 
      expiresAt: { $gt: currentTime } 
    });
    const totalPages = Math.ceil(totalStories / limit);

    // Add URLs to all stories
    const storiesWithUrls = addUrlsToStories(stories, req);

    res.status(200).json({
      success: true,
      stories: storiesWithUrls,
      pagination: {
        currentPage: page,
        totalPages,
        totalStories,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get all stories error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching stories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get stories by user ID
export const getStoriesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get current time to filter out expired stories
    const currentTime = new Date();

    const stories = await Story.find({ 
      user: userId,
      expiresAt: { $gt: currentTime }
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalStories = await Story.countDocuments({ 
      user: userId,
      expiresAt: { $gt: currentTime }
    });
    const totalPages = Math.ceil(totalStories / limit);

    res.status(200).json({
      success: true,
      stories,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalStories,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get stories by user error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching user stories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get my stories (logged-in user's stories)
export const getMyStories = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get current time to filter out expired stories
    const currentTime = new Date();

    const stories = await Story.find({ 
      user: userId,
      expiresAt: { $gt: currentTime }
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalStories = await Story.countDocuments({ 
      user: userId,
      expiresAt: { $gt: currentTime }
    });
    const totalPages = Math.ceil(totalStories / limit);

    // Add URLs to all stories
    const storiesWithUrls = addUrlsToStories(stories, req);

    res.status(200).json({
      success: true,
      message: 'My stories retrieved successfully',
      stories: storiesWithUrls,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        profilePictureUrl: user.profilePicture 
          ? getFileUrl(user.profilePicture, req)
          : null
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalStories,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching my stories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single story by ID
export const getStoryById = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId)
      .populate('user', 'username profilePicture');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Check if story has expired
    if (story.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        message: "Story has expired"
      });
    }

    // Add URL to the story
    const storyWithUrl = addUrlsToStory(story, req);

    res.status(200).json({
      success: true,
      story: storyWithUrl
    });

  } catch (error) {
    console.error('Get story by ID error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching story",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update story (only image can be updated)
export const updateStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { image } = req.body;
    const userId = req.user.userId;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Check if story has expired
    if (story.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        message: "Cannot update expired story"
      });
    }

    // Check if user owns the story
    if (story.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own stories"
      });
    }

    // Update story image
    if (image !== undefined) {
      story.image = image;
    }

    const updatedStory = await story.save();
    
    // Populate user details
    const populatedStory = await Story.findById(updatedStory._id)
      .populate('user', 'username profilePicture');

    res.status(200).json({
      success: true,
      message: "Story updated successfully",
      story: populatedStory
    });

  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating story",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete story
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.userId;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Check if user owns the story
    if (story.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own stories"
      });
    }

    await Story.findByIdAndDelete(storyId);

    res.status(200).json({
      success: true,
      message: "Story deleted successfully"
    });

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting story",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get stories from followed users (story feed)
export const getStoryFeed = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get user's following list
    const user = await User.findById(userId).select('following');
    const followingIds = user.following;
    
    // Only show stories from followed users (exclude own stories for Instagram-like behavior)
    if (followingIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No stories from followed users',
        stories: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalStories: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    // Get current time to filter out expired stories
    const currentTime = new Date();

    const stories = await Story.find({ 
      user: { $in: followingIds },
      expiresAt: { $gt: currentTime }
    })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalStories = await Story.countDocuments({ 
      user: { $in: followingIds },
      expiresAt: { $gt: currentTime }
    });
    const totalPages = Math.ceil(totalStories / limit);

    // Add URLs to all stories
    const storiesWithUrls = addUrlsToStories(stories, req);

    res.status(200).json({
      success: true,
      message: 'Story feed retrieved successfully',
      stories: storiesWithUrls,
      pagination: {
        currentPage: page,
        totalPages,
        totalStories,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get story feed error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching story feed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Internal function to clean up expired stories (called automatically)
const autoCleanupExpiredStories = async () => {
  try {
    const currentTime = new Date();
    
    const result = await Story.deleteMany({
      expiresAt: { $lt: currentTime }
    });

    if (result.deletedCount > 0) {
      console.log(`✅ Auto-cleaned ${result.deletedCount} expired story/stories`);
    }

    return result.deletedCount;
  } catch (error) {
    console.error('❌ Auto-cleanup expired stories error:', error);
    return 0;
  }
};

// Clean up expired stories (utility function - manual trigger via API)
export const cleanupExpiredStories = async (req, res) => {
  try {
    const deletedCount = await autoCleanupExpiredStories();

    res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedCount} expired stories`,
      deletedCount
    });

  } catch (error) {
    console.error('Cleanup expired stories error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while cleaning up expired stories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Start automatic cleanup job (runs every hour)
let cleanupInterval = null;

export const startAutoCleanup = (intervalMinutes = 60) => {
  // Stop existing interval if any
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Run cleanup immediately on startup
  autoCleanupExpiredStories();

  // Run cleanup every hour (default) or specified interval
  const intervalMs = intervalMinutes * 60 * 1000;
  cleanupInterval = setInterval(() => {
    autoCleanupExpiredStories();
  }, intervalMs);

  console.log(`🔄 Auto-cleanup started: Checking for expired stories every ${intervalMinutes} minutes`);
  
  return cleanupInterval;
};

// Stop automatic cleanup job
export const stopAutoCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🛑 Auto-cleanup stopped');
  }
};

// Get story statistics for a user
export const getStoryStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const currentTime = new Date();

    // Get active stories count
    const activeStoriesCount = await Story.countDocuments({
      user: userId,
      expiresAt: { $gt: currentTime }
    });

    // Get total stories count (including expired)
    const totalStoriesCount = await Story.countDocuments({
      user: userId
    });

    // Get stories created in last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentStoriesCount = await Story.countDocuments({
      user: userId,
      createdAt: { $gt: last24Hours }
    });

    res.status(200).json({
      success: true,
      stats: {
        activeStories: activeStoriesCount,
        totalStories: totalStoriesCount,
        recentStories: recentStoriesCount,
        expiredStories: totalStoriesCount - activeStoriesCount
      },
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Get story stats error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching story statistics",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all stories with user grouping (for story highlights)
export const getStoriesGroupedByUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get user's following list
    const user = await User.findById(userId).select('following');
    const followingIds = user.following.map(id => new mongoose.Types.ObjectId(id));
    
    if (followingIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No stories from followed users',
        storiesByUser: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalUsers: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    const currentTime = new Date();

    // Aggregate to group stories by user (only from followed users)
    const storiesByUser = await Story.aggregate([
      {
        $match: {
          user: { $in: followingIds },
          expiresAt: { $gt: currentTime }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $group: {
          _id: '$user',
          user: { $first: '$userInfo' },
          stories: {
            $push: {
              _id: '$_id',
              image: '$image',
              createdAt: '$createdAt',
              expiresAt: '$expiresAt'
            }
          },
          storyCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          user: {
            _id: '$user._id',
            username: '$user.username',
            profilePicture: '$user.profilePicture'
          },
          stories: 1,
          storyCount: 1
        }
      },
      {
        $sort: { 'stories.createdAt': -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    const totalUsers = await Story.aggregate([
      {
        $match: {
          user: { $in: followingIds },
          expiresAt: { $gt: currentTime }
        }
      },
      {
        $group: {
          _id: '$user'
        }
      },
      {
        $count: 'totalUsers'
      }
    ]);

    const totalUsersCount = totalUsers.length > 0 ? totalUsers[0].totalUsers : 0;
    const totalPages = Math.ceil(totalUsersCount / limit);

    // Add URLs to stories and user profile pictures
    const storiesByUserWithUrls = storiesByUser.map(group => {
      const userObj = {
        _id: group.user._id,
        username: group.user.username,
        profilePicture: group.user.profilePicture,
        profilePictureUrl: group.user.profilePicture 
          ? getFileUrl(group.user.profilePicture, req) 
          : null
      };

      const storiesWithUrls = group.stories.map(story => {
        const storyObj = { ...story };
        if (story.image) {
          storyObj.imageUrl = getFileUrl(story.image, req);
        }
        if (story.video) {
          storyObj.videoUrl = getFileUrl(story.video, req);
        }
        return storyObj;
      });

      return {
        _id: group._id,
        user: userObj,
        stories: storiesWithUrls,
        storyCount: group.storyCount
      };
    });

    res.status(200).json({
      success: true,
      message: 'Stories grouped by user retrieved successfully',
      storiesByUser: storiesByUserWithUrls,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: totalUsersCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get stories grouped by user error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching grouped stories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
