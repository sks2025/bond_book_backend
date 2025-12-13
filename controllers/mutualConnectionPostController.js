import MutualConnectionPost from '../models/mutualConnectionPostModel.js';
import MutualConnection from '../models/mutualConnectionModel.js';
import { createNotification } from './notificationController.js';
import User from '../models/userModel.js';

// Create post on mutual connection
export const createMutualConnectionPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;
    
    // Get file from request (upload.any() puts files in req.files array)
    const file = req.file || (req.files && req.files[0]);
    
    // Get other fields from form-data
    const { caption, tags, location } = req.body;

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
        message: 'Not authorized to create posts for this connection'
      });
    }

    // Check if file is provided
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Post must have either an image or video file'
      });
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image and video files are allowed'
      });
    }

    // Create post data
    const postData = {
      mutualConnection: mutualConnectionId,
      createdBy: userId,
      caption: caption || '',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      location: location || ''
    };

    // Add image or video based on file type
    if (file.mimetype.startsWith('image/')) {
      postData.image = file.path;  // Use file.path from multer
      postData.video = '';
    } else if (file.mimetype.startsWith('video/')) {
      postData.video = file.path;  // Use file.path from multer
      postData.image = '';
    }

    const post = await MutualConnectionPost.create(postData);

    await post.populate('createdBy', 'username profilePicture');
    await post.populate('mutualConnection', 'displayName connectionId');

    // Get the creator user for notifications
    const creator = await User.findById(userId);
    
    // Notify the other user in the mutual connection
    const otherUserId = mutualConnection.user1.toString() === userId.toString()
      ? mutualConnection.user2
      : mutualConnection.user1;
    
    // Notify the other user in the connection
    if (creator) {
      createNotification(
        otherUserId,
        userId,
        'mutual_connection_post',
        `${creator.username} created a new post on your mutual connection`,
        post._id,
        'MutualConnectionPost'
      ).catch(err => console.error('Error creating mutual connection post notification:', err));
    }

    // Notify all followers of the mutual connection
    if (mutualConnection.followers && mutualConnection.followers.length > 0 && creator) {
      const followerNotifications = mutualConnection.followers
        .filter(followerId => followerId.toString() !== userId.toString() && followerId.toString() !== otherUserId.toString())
        .map(followerId =>
          createNotification(
            followerId,
            userId,
            'mutual_connection_post',
            `${creator.username} posted on ${mutualConnection.displayName}`,
            post._id,
            'MutualConnectionPost'
          )
        );
      
      Promise.all(followerNotifications).catch(err =>
        console.error('Error creating follower notifications:', err)
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: {
        _id: post._id,
        mutualConnection: post.mutualConnection,
        createdBy: post.createdBy,
        caption: post.caption,
        image: post.image,
        video: post.video,
        tags: post.tags,
        location: post.location,
        likes: post.likes,
        likeCount: post.likeCount,
        comments: post.comments,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    });
  } catch (error) {
    console.error('Create mutual connection post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get posts for a mutual connection
export const getMutualConnectionPosts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const mutualConnection = await MutualConnection.findById(mutualConnectionId);
    
    if (!mutualConnection) {
      return res.status(404).json({
        success: false,
        message: 'Mutual connection not found'
      });
    }

    // Check if user is part of connection or follows it
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();
    
    const isFollowing = mutualConnection.followers.some(
      id => id.toString() === userId.toString()
    );

    if (!isPartOfConnection && !isFollowing) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view posts for this connection'
      });
    }

    const posts = await MutualConnectionPost.find({
      mutualConnection: mutualConnectionId
    })
      .populate('createdBy', 'username profilePicture')
      .populate('likedBy', 'username profilePicture')
      .populate('comments.user', 'username profilePicture')
      .populate('mutualConnection', 'displayName connectionId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked flag for each post
    const postsWithLikes = posts.map(post => ({
      ...post,
      isLiked: post.likedBy.some(id => id._id.toString() === userId.toString())
    }));

    const totalPosts = await MutualConnectionPost.countDocuments({
      mutualConnection: mutualConnectionId
    });

    return res.status(200).json({
      success: true,
      posts: postsWithLikes,
      pagination: {
        page,
        limit,
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit)
      }
    });
  } catch (error) {
    console.error('Get mutual connection posts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single post
export const getMutualConnectionPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    const post = await MutualConnectionPost.findById(postId)
      .populate('createdBy', 'username profilePicture')
      .populate('likedBy', 'username profilePicture')
      .populate('comments.user', 'username profilePicture')
      .populate('mutualConnection', 'displayName connectionId');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check authorization
    const mutualConnection = await MutualConnection.findById(post.mutualConnection);
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();
    
    const isFollowing = mutualConnection.followers.some(
      id => id.toString() === userId.toString()
    );

    if (!isPartOfConnection && !isFollowing) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this post'
      });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    return res.status(200).json({
      success: true,
      post: {
        ...post.toObject(),
        isLiked: post.likedBy.some(id => id._id.toString() === userId.toString())
      }
    });
  } catch (error) {
    console.error('Get mutual connection post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Like/Unlike post
export const toggleLikeMutualPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    const post = await MutualConnectionPost.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user has already liked the post
    const isCurrentlyLiked = post.likedBy.some(
      id => id.toString() === userId.toString()
    );

    // Toggle like/unlike
    if (isCurrentlyLiked) {
      // User has liked, so unlike it
      await post.unlikePost(userId);
    } else {
      // User hasn't liked, so like it
      await post.likePost(userId);
    }

    // Reload the post to get updated data
    await post.populate('likedBy', 'username profilePicture');

    return res.status(200).json({
      success: true,
      message: isCurrentlyLiked ? 'Post unliked successfully' : 'Post liked successfully',
      isLiked: !isCurrentlyLiked,  // New like status after toggle
      likeCount: post.likeCount,
      likedBy: post.likedBy
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add comment to post
export const addCommentToMutualPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    const post = await MutualConnectionPost.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.addComment(userId, comment.trim());
    await post.populate('comments.user', 'username profilePicture');

    const newComment = post.comments[post.comments.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: newComment,
      commentCount: post.commentCount
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete comment from post
export const deleteCommentFromMutualPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId, commentId } = req.params;

    const post = await MutualConnectionPost.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.removeComment(commentId, userId);

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      commentCount: post.commentCount
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    if (error.message === 'Comment not found or not authorized') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete post
export const deleteMutualConnectionPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    const post = await MutualConnectionPost.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Only the creator can delete
    if (post.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await MutualConnectionPost.findByIdAndDelete(postId);

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


