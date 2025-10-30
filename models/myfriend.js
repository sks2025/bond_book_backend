import mongoose from 'mongoose';

const myFriendSchema = new mongoose.Schema(
  {
    myid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    myfriendid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

const MyFriend = mongoose.model('MyFriend', myFriendSchema);

export default MyFriend;
