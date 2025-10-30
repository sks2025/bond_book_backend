import User from '../models/userModel.js';
import MyFriend from '../models/myfriend.js';

// Create user and save who created whom (MyFriend relation)
export const createUser = async (req, res) => {
  try {
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body || {}));
    
    const { name, username, email, password, createdByUserId } = req.body || {};
    const finalUsername = username || name;

    if (!finalUsername || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username (or name), email, and password are required',
        received: {
          hasName: !!name,
          hasUsername: !!username,
          hasEmail: !!email,
          hasPassword: !!password,
          bodyKeys: Object.keys(req.body || {}),
          bodyType: typeof req.body
        }
      });
    }

    // Check if a user with the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create the user
    const newUser = new User({
      username: finalUsername,
      email,
      password
      // add other fields if needed
    });

    await newUser.save();

    // Save info about who created whom in MyFriend, only if createdByUserId is provided and valid
    if (createdByUserId) {
      // Optional: validate that creator exists
      const creatorUser = await User.findById(createdByUserId);
      if (creatorUser) {
        // Save link in MyFriend
        const friendRelation = new MyFriend({
          myid: createdByUserId,      // Who created
          myfriendid: newUser._id     // Whom they created
        });
        await friendRelation.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
