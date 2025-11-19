import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer } from 'http';
import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import reminderRouter from './routes/reminderRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import mutualConnectionRouter from './routes/mutualConnectionRoutes.js';
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

// Routes
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/stories', storyRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/mutual-connections', mutualConnectionRouter);




const PORT = process.env.PORT || 3000;
const dbURI = process.env.MONGODB_URI;

// Database connection with retry logic and better error handling
const connectDB = async (retries = 5, delay = 3000) => {
  try {
    if (!dbURI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      console.error('💡 Please create a .env file with: MONGODB_URI=mongodb://localhost:27017/your-database-name');
      console.error('💡 Or use MongoDB Atlas: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
      process.exit(1);
    }
    
    // Set connection options
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,
    };
    
    await mongoose.connect(dbURI, options);
    console.log('✅ Connected to MongoDB successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Start automatic story cleanup (runs every 60 minutes)
    startAutoCleanup(60);
  } catch (error) {
    if (retries > 0) {
      console.error(`❌ MongoDB connection failed. Retrying... (${retries} attempts left)`);
      console.error(`   Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retries - 1, delay);
    } else {
      console.error('❌ MongoDB connection error after all retries:');
      console.error(`   ${error.message}`);
      console.error('\n💡 Troubleshooting steps:');
      console.error('   1. Make sure MongoDB is running on your machine');
      console.error('   2. Check if MongoDB service is started:');
      console.error('      Windows: Open Services and start "MongoDB" service');
      console.error('      Or run: mongod (in a separate terminal)');
      console.error('   3. Verify your MONGODB_URI in .env file is correct');
      console.error('   4. For MongoDB Atlas, check your connection string and network access');
      console.error(`\n   Current MONGODB_URI: ${dbURI ? dbURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'NOT SET'}`);
      process.exit(1);
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

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
