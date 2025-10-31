import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer } from 'http';
import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import { initializeSocket, setSocketIO } from './config/socket.js';
import { startAutoCleanup } from './controllers/storyController.js';

dotenv.config();

const app = express();

// Middleware for parsing JSON requests and cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes dsdss
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/stories', storyRouter);
app.use('/api/messages', messageRouter);
app.use('/api/chat', chatRouter);




const PORT = process.env.PORT || 3000;
const dbURI = process.env.MONGODB_URI;

// Database connection with better error handling
const connectDB = async () => {
  try {
    if (!dbURI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB successfully');
    
    // Start automatic story cleanup (runs every 60 minutes)
    startAutoCleanup(60);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);
setSocketIO(io);

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`Socket.IO is ready for real-time messaging`);
});
