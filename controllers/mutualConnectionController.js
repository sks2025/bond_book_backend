import MutualConnection from '../models/mutualConnectionModel.js';
import User from '../models/userModel.js';

// Get mutual connection profile
export const getMutualConnection = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Other user ID is required'
      });
    }

    const mutualConnection = await MutualConnection.findOne({
      $and: [
        { $or: [{ user1: userId }, { user2: userId }] },
        { $or: [{ user1: otherUserId }, { user2: otherUserId }] }
      ],
      isActive: true
    })
      .populate('user1', 'username profilePicture email')
      .populate('user2', 'username profilePicture email')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    return res.status(200).json({
      success: true,
      mutualConnection: {
        _id: mutualConnection._id,
        connectionId: mutualConnection.connectionId,
        displayName: mutualConnection.displayName,
        profilePicture: mutualConnection.profilePicture,
        bio: mutualConnection.bio,
        users: [mutualConnection.user1, mutualConnection.user2],
        followersCount: mutualConnection.followers.length,
        followingCount: mutualConnection.following.length,
        postsCount: mutualConnection.postsCount,
        followers: mutualConnection.followers,
        following: mutualConnection.following,
        createdAt: mutualConnection.createdAt,
        updatedAt: mutualConnection.updatedAt
      }
    });
  } catch (error) {
    console.error('Get mutual connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get mutual connection by ID
export const getMutualConnectionById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;

    const mutualConnection = await MutualConnection.findById(mutualConnectionId)
      .populate('user1', 'username profilePicture email')
      .populate('user2', 'username profilePicture email')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    // Verify user is part of this connection
    const isPartOfConnection = 
      mutualConnection.user1._id.toString() === userId.toString() ||
      mutualConnection.user2._id.toString() === userId.toString();

    if (!isPartOfConnection && !mutualConnection.followers.some(f => f._id.toString() === userId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this connection'
      });
    }

    return res.status(200).json({
      success: true,
      mutualConnection: {
        _id: mutualConnection._id,
        connectionId: mutualConnection.connectionId,
        displayName: mutualConnection.displayName,
        profilePicture: mutualConnection.profilePicture,
        bio: mutualConnection.bio,
        users: [mutualConnection.user1, mutualConnection.user2],
        followersCount: mutualConnection.followers.length,
        followingCount: mutualConnection.following.length,
        postsCount: mutualConnection.postsCount,
        followers: mutualConnection.followers,
        following: mutualConnection.following,
        isPartOfConnection,
        createdAt: mutualConnection.createdAt,
        updatedAt: mutualConnection.updatedAt
      }
    });
  } catch (error) {
    console.error('Get mutual connection by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all mutual connections for a user
export const getUserMutualConnections = async (req, res) => {
  try {
    const userId = req.user.userId;

    const mutualConnections = await MutualConnection.find({
      $or: [{ user1: userId }, { user2: userId }],
      isActive: true
    })
      .populate('user1', 'username profilePicture email')
      .populate('user2', 'username profilePicture email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      mutualConnections: mutualConnections.map(mc => ({
        _id: mc._id,
        connectionId: mc.connectionId,
        displayName: mc.displayName,
        profilePicture: mc.profilePicture,
        bio: mc.bio,
        otherUser: mc.user1._id.toString() === userId.toString() 
          ? mc.user2 
          : mc.user1,
        postsCount: mc.postsCount,
        followersCount: mc.followers.length,
        followingCount: mc.following.length,
        createdAt: mc.createdAt,
        updatedAt: mc.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get user mutual connections error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update mutual connection profile
export const updateMutualConnectionProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;
    const { bio, profilePicture, displayName } = req.body;

    const mutualConnection = await MutualConnection.findById(mutualConnectionId);
    
    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    // Verify user is part of this connection
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();

    if (!isPartOfConnection) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    if (bio !== undefined) mutualConnection.bio = bio;
    if (profilePicture !== undefined) mutualConnection.profilePicture = profilePicture;
    if (displayName !== undefined) mutualConnection.displayName = displayName;

    await mutualConnection.save();

    return res.status(200).json({
      success: true,
      message: 'Mutual connection profile updated successfully',
      mutualConnection: {
        _id: mutualConnection._id,
        connectionId: mutualConnection.connectionId,
        displayName: mutualConnection.displayName,
        profilePicture: mutualConnection.profilePicture,
        bio: mutualConnection.bio
      }
    });
  } catch (error) {
    console.error('Update mutual connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Follow a mutual connection
export const followMutualConnection = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;

    const mutualConnection = await MutualConnection.findById(mutualConnectionId);
    
    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    // Cannot follow your own mutual connection
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();

    if (isPartOfConnection) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow your own mutual connection'
      });
    }

    // Check if already following
    const isAlreadyFollowing = mutualConnection.followers.some(
      id => id.toString() === userId.toString()
    );

    if (isAlreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Already following this mutual connection'
      });
    }

    // Add to followers
    mutualConnection.followers.push(userId);
    await mutualConnection.save();

    return res.status(200).json({
      success: true,
      message: 'Mutual connection followed successfully',
      followersCount: mutualConnection.followers.length
    });
  } catch (error) {
    console.error('Follow mutual connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Unfollow a mutual connection
export const unfollowMutualConnection = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;

    const mutualConnection = await MutualConnection.findById(mutualConnectionId);
    
    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    // Check if currently following
    const isCurrentlyFollowing = mutualConnection.followers.some(
      id => id.toString() === userId.toString()
    );

    if (!isCurrentlyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Not following this mutual connection'
      });
    }

    // Remove from followers
    mutualConnection.followers = mutualConnection.followers.filter(
      id => id.toString() !== userId.toString()
    );
    await mutualConnection.save();

    return res.status(200).json({
      success: true,
      message: 'Mutual connection unfollowed successfully',
      followersCount: mutualConnection.followers.length
    });
  } catch (error) {
    console.error('Unfollow mutual connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


