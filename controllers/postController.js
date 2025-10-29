import Post from '../models/postModel.js';
import { addUrlsToPost, addUrlsToPosts, getFileUrl } from '../utils/urlHelper.js';

// Create a new post
export const createPost = async (req, res) => {
  try {
    const { caption, tags, location, isPrivate } = req.body;
    const userId = req.user.userId;

    // Get file from request (upload.any() puts files in req.files array)
    const file = req.file || (req.files && req.files[0]);

    if (!file) {
      return res.status(400).json({ message: "Please upload an image or video file." });
    }

    // Create post data
    const postData = {
      user: userId,
      caption: caption || "",
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      location: location || "",
      isPrivate: isPrivate === 'true' || isPrivate === true
    };

    // Add image or video based on file type
    if (file.mimetype.startsWith('image/')) {
      postData.image = file.path;
    } else if (file.mimetype.startsWith('video/')) {
      postData.video = file.path;
    }

    const newPost = new Post(postData);
    const savedPost = await newPost.save();

    // Add URLs to the response
    const postWithUrls = addUrlsToPost(savedPost, req);

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: postWithUrls
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all posts
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 });
    
    // Add URLs to all posts and user profile pictures
    const postsWithUrls = posts.map(post => {
      const postObj = post.toObject ? post.toObject() : post;
      
      // Add post media URLs
      if (postObj.image) {
        postObj.imageUrl = getFileUrl(postObj.image, req);
      }
      if (postObj.video) {
        postObj.videoUrl = getFileUrl(postObj.video, req);
      }
      
      // Only include username and profilePictureUrl in user object
      if (postObj.user) {
        postObj.user = {
          username: postObj.user.username,
          profilePictureUrl: postObj.user.profilePicture ? getFileUrl(postObj.user.profilePicture, req) : null
        };
      }
      
      return postObj;
    });
    
    res.status(200).json({
      message: 'Posts retrieved successfully',
      posts: postsWithUrls,
      count: postsWithUrls.length
    });
  } catch (error) {
    console.error('Error getting posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get post by ID
export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findById(id)
      .populate('user', 'name email profilePicture');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment view count
    await Post.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    
    // Add URLs to the post
    const postWithUrls = addUrlsToPost(post, req);
    
    res.status(200).json({
      message: 'Post retrieved successfully',
      post: postWithUrls
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update post
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, tags, location, isPrivate } = req.body;
    const userId = req.user.userId;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      {
        caption: caption || post.caption,
        tags: tags || post.tags,
        location: location !== undefined ? location : post.location,
        isPrivate: isPrivate !== undefined ? isPrivate : post.isPrivate
      },
      { new: true }
    ).populate('user', 'name email profilePicture');

    // Add URLs to the updated post
    const postWithUrls = addUrlsToPost(updatedPost, req);

    res.status(200).json({
      message: 'Post updated successfully',
      post: postWithUrls
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete post
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(id);

    res.status(200).json({
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get posts by user
export const getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const posts = await Post.find({ user: userId })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 });
    
    // Add URLs and trim user info
    const postsWithUrls = posts.map(post => {
      const postObj = addUrlsToPost(post, req);
      if (postObj.user) {
        postObj.user = {
          username: postObj.user.username,
          profilePictureUrl: postObj.user.profilePicture ? getFileUrl(postObj.user.profilePicture, req) : null
        };
      }
      return postObj;
    });
    
    res.status(200).json({
      message: 'User posts retrieved successfully',
      posts: postsWithUrls,
      count: postsWithUrls.length
    });
  } catch (error) {
    console.error('Error getting user posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get posts of the currently authenticated user
export const getMyPosts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const posts = await Post.find({ user: userId })
      .populate('user', 'username profilePicture')
      .sort({ createdAt: -1 });

    const postsWithUrls = posts.map(post => {
      const postObj = addUrlsToPost(post, req);
      if (postObj.user) {
        postObj.user = {
          username: postObj.user.username,
          profilePictureUrl: postObj.user.profilePicture ? getFileUrl(postObj.user.profilePicture, req) : null
        };
      }
      return postObj;
    });

    res.status(200).json({
      message: 'My posts retrieved successfully',
      posts: postsWithUrls,
      count: postsWithUrls.length
    });
  } catch (error) {
    console.error('Error getting my posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get total like count across all posts by a user
export const getTotalLikesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Aggregate total likes for all posts by user
    const result = await Post.aggregate([
      { $match: { user: new (require('mongoose')).Types.ObjectId(userId) } },
      { $group: { _id: null, totalLikes: { $sum: { $ifNull: ['$likes', 0] } } } }
    ]);

    const totalLikes = result.length > 0 ? result[0].totalLikes : 0;

    res.status(200).json({
      message: 'Total likes computed successfully',
      userId,
      totalLikes
    });
  } catch (error) {
    console.error('Error getting total likes by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get posts by tags
export const getPostsByTags = async (req, res) => {
  try {
    const { tag } = req.params;
    
    const posts = await Post.find({ tags: { $in: [tag] } })
      .populate('user', 'name email profilePicture')
      .sort({ createdAt: -1 });
    
    // Add URLs to all posts
    const postsWithUrls = addUrlsToPosts(posts, req);
    
    res.status(200).json({
      message: 'Posts with tag retrieved successfully',
      posts: postsWithUrls,
      count: postsWithUrls.length
    });
  } catch (error) {
    console.error('Error getting posts by tag:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Toggle like/unlike for a post
export const togglePostLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, like } = req.body; // Accept both 'action' and 'like' fields
    const userId = req.user.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Use either 'action' or 'like' field
    const actionValue = action !== undefined ? action : like;
    
    // Convert action to number and handle string inputs
    const actionNum = parseInt(actionValue);
    
    if (actionNum === 1 || actionValue === 1 || actionValue === '1' || actionValue === true) {
      await post.likePost(userId);
      res.status(200).json({
        message: 'Post liked successfully',
        likes: post.likes
      });
    } else if (actionNum === 0 || actionValue === 0 || actionValue === '0' || actionValue === false) {
      await post.unlikePost(userId);
      res.status(200).json({
        message: 'Post unliked successfully',
        likes: post.likes
      });
    } else {
      res.status(400).json({ 
        message: 'Invalid action. Send {"action": 1} or {"like": 1} to like. Send {"action": 0} or {"like": 0} to unlike' 
      });
    }
  } catch (error) {
    console.error('Error toggling post like:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get likes for a post
export const getPostLikes = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate('likedBy', 'name email profilePicture');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({
      message: 'Post likes retrieved successfully',
      likes: post.likes,
      likedBy: post.likedBy
    });
  } catch (error) {
    console.error('Error getting post likes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Check if user liked a post
export const checkPostLikeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.isLikedBy(userId);

    res.status(200).json({
      liked: isLiked,
      likes: post.likes
    });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get comments for a post
export const getPostComments = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate('comments.user', 'name email profilePicture');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({
      message: 'Comments retrieved successfully',
      comments: post.comments,
      commentCount: post.commentCount
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Add comment to a post
export const addPostComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.userId;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await post.addComment(userId, comment.trim());

    res.status(201).json({
      message: 'Comment added successfully',
      commentCount: post.commentCount
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete comment from a post
export const deletePostComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.userId;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await post.removeComment(commentId, userId);

    res.status(200).json({
      message: 'Comment deleted successfully',
      commentCount: post.commentCount
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};