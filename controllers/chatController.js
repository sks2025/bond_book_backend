import User from '../models/userModel.js';
import ChatRequest from '../models/chatRequestModel.js';
import ChatConnection from '../models/chatConnectionModel.js';
import ChatProfile from '../models/chatProfileModel.js';

// List users available to chat (excluding current user). Optionally include request/connection status.
export const listUsersForChat = async (req, res) => {
  try {
    const currentUserId = req.user?.userId;
    const users = await User.find({ _id: { $ne: currentUserId } }, 'username profilePicture');

    res.status(200).json({
      message: 'Users retrieved successfully',
      users
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Send a chat request
export const sendChatRequest = async (req, res) => {
  try {
    const requesterId = req.user?.userId;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ message: 'recipientId is required' });
    }
    if (recipientId === requesterId) {
      return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    // Prevent duplicates either direction
    const existing = await ChatRequest.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existing) {
      return res.status(409).json({ message: `Request already exists with status: ${existing.status}`, request: existing });
    }

    // Prevent if already connected
    const alreadyConnected = await ChatConnection.findOne({ users: { $all: [requesterId, recipientId] } });
    if (alreadyConnected) {
      return res.status(409).json({ message: 'Users are already connected' });
    }

    const request = await ChatRequest.create({ requester: requesterId, recipient: recipientId });
    res.status(201).json({ message: 'Chat request sent', request });
  } catch (error) {
    console.error('Error sending chat request:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Duplicate request' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// List incoming and outgoing chat requests for the current user
export const listChatRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const incoming = await ChatRequest.find({ recipient: userId, status: 'pending' })
      .populate('requester', 'username profilePicture')
      .sort({ createdAt: -1 });
    const outgoing = await ChatRequest.find({ requester: userId, status: 'pending' })
      .populate('recipient', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error('Error listing chat requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Accept a chat request
export const acceptChatRequest = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.params;

    const request = await ChatRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to accept this request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = 'accepted';
    await request.save();

    // Create mutual connection
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

    res.status(200).json({ message: 'Request accepted and connection + profile created' });
  } catch (error) {
    console.error('Error accepting chat request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Reject a chat request
export const rejectChatRequest = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { requestId } = req.params;

    const request = await ChatRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to reject this request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = 'rejected';
    await request.save();
    res.status(200).json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting chat request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// List connections (mutual) for current user
export const listConnections = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const connections = await ChatConnection.find({ users: userId })
      .populate('users', 'username profilePicture')
      .sort({ createdAt: -1 });

    // Attach profiles
    const connectionIds = connections.map(c => c._id);
    const profiles = await ChatProfile.find({ connection: { $in: connectionIds } });
    const connectionIdToProfile = new Map(profiles.map(p => [p.connection.toString(), p]));

    const data = connections.map(conn => ({
      _id: conn._id,
      users: conn.users,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
      profile: connectionIdToProfile.get(conn._id.toString()) || null
    }));

    res.status(200).json({ connections: data });
  } catch (error) {
    console.error('Error listing connections:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get a single chat profile by connection id
export const getChatProfile = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const profile = await ChatProfile.findOne({ connection: connectionId }).populate('users', 'username profilePicture');
    if (!profile) {
      return res.status(404).json({ message: 'Chat profile not found' });
    }
    res.status(200).json({ profile });
  } catch (error) {
    console.error('Error getting chat profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


