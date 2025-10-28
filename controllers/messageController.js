import Message from '../models/messageModel.js';
import User from '../models/userModel.js';

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { receiver, content } = req.body;
    const sender = req.user.userId;

    if (!receiver || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Receiver and content are required' 
      });
    }

    // Check if receiver exists
    const receiverExists = await User.findById(receiver);
    if (!receiverExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Receiver not found' 
      });
    }

    // Check if sender is not the receiver
    if (sender.toString() === receiver.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send message to yourself' 
      });
    }

    const newMessage = new Message({
      sender,
      receiver,
      content
    });

    const savedMessage = await newMessage.save();

    // Populate sender and receiver details
    await savedMessage.populate('sender', 'username profilePicture');
    await savedMessage.populate('receiver', 'username profilePicture');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all conversations for a user (list of users they've messaged with)
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all unique users that the current user has conversed with
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: null,
          participants: {
            $push: {
              sender: '$sender',
              receiver: '$receiver'
            }
          }
        }
      }
    ]);

    // Extract unique user IDs
    const uniqueUsers = new Set();
    if (conversations.length > 0) {
      conversations[0].participants.forEach(participant => {
        if (participant.sender.toString() !== userId.toString()) {
          uniqueUsers.add(participant.sender.toString());
        }
        if (participant.receiver.toString() !== userId.toString()) {
          uniqueUsers.add(participant.receiver.toString());
        }
      });
    }

    // Get the last message with each user
    const conversationList = [];
    for (const otherUserId of uniqueUsers) {
      const lastMessage = await Message.findOne({
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId }
        ]
      })
      .sort({ createdAt: -1 })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

      if (lastMessage) {
        // Get unread count
        const unreadCount = await Message.countDocuments({
          sender: otherUserId,
          receiver: userId,
          isRead: false
        });

        conversationList.push({
          user: lastMessage.sender.toString() === userId.toString() 
            ? lastMessage.receiver 
            : lastMessage.sender,
          lastMessage: lastMessage,
          unreadCount
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Conversations retrieved successfully',
      conversations: conversationList
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get messages between two users
export const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Get all messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
    .populate('sender', 'username profilePicture')
    .populate('receiver', 'username profilePicture')
    .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Message.countDocuments({
      receiver: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Mark message as read
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    // Check if the user is the receiver
    if (message.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to mark this message as read' 
      });
    }

    message.isRead = true;
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Mark all messages from a sender as read
export const markConversationAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    await Message.updateMany(
      {
        sender: userId,
        receiver: currentUserId,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    );

    res.status(200).json({
      success: true,
      message: 'All messages marked as read'
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


