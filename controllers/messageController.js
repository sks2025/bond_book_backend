import Message from '../models/messageModel.js';
import MutualConnection from '../models/mutualConnectionModel.js';
import { getSocketIO } from '../config/socket.js';

// Send message
// IMPORTANT: Messages can ONLY be sent between users who have a mutual connection.
// Mutual connections are created when a merge request is accepted.
// Follow/unfollow does NOT enable messaging - only merge requests do.
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;
    const { content, messageType, mediaUrl } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

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
        message: 'Not authorized to send messages'
      });
    }

    // Determine receiver
    const receiverId = mutualConnection.user1.toString() === userId.toString()
      ? mutualConnection.user2
      : mutualConnection.user1;

    const message = await Message.create({
      mutualConnection: mutualConnectionId,
      sender: userId,
      receiver: receiverId,
      content: content.trim(),
      messageType: messageType || 'text',
      mediaUrl: mediaUrl || ''
    });

    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');
    await message.populate('mutualConnection', 'displayName connectionId');

    // Emit via Socket.IO if available
    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user_${receiverId}`).emit('new-message', {
          message: message.toObject(),
          mutualConnectionId: mutualConnectionId.toString()
        });
      }
    } catch (socketError) {
      console.log('Socket.IO not available:', socketError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get messages for a mutual connection
export const getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mutualConnectionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

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
        message: 'Not authorized to view messages'
      });
    }

    const messages = await Message.find({
      mutualConnection: mutualConnectionId
    })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        mutualConnection: mutualConnectionId,
        receiver: userId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    const totalMessages = await Message.countDocuments({
      mutualConnection: mutualConnectionId
    });

    return res.status(200).json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get unread message count for a mutual connection
export const getUnreadMessageCount = async (req, res) => {
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

    // Verify user is part of this connection
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();

    if (!isPartOfConnection) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const unreadCount = await Message.countDocuments({
      mutualConnection: mutualConnectionId,
      receiver: userId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Get unread message count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
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

    // Verify user is part of this connection
    const isPartOfConnection = 
      mutualConnection.user1.toString() === userId.toString() ||
      mutualConnection.user2.toString() === userId.toString();

    if (!isPartOfConnection) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const result = await Message.updateMany(
      {
        mutualConnection: mutualConnectionId,
        receiver: userId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


