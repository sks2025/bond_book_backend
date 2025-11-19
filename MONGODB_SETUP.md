# MongoDB Setup Guide

## Quick Start

### Option 1: Local MongoDB Installation

1. **Install MongoDB Community Edition**
   - Download from: https://www.mongodb.com/try/download/community
   - Follow installation instructions for Windows

2. **Start MongoDB Service (Windows)**
   - Open **Services** (Win + R, type `services.msc`)
   - Find "MongoDB" service
   - Right-click → **Start**
   - Or set it to start automatically

3. **Or Start MongoDB Manually**
   ```powershell
   # Navigate to MongoDB bin directory (usually)
   cd "C:\Program Files\MongoDB\Server\7.0\bin"
   mongod
   ```

4. **Create .env file** in `bond_book_backend` folder:
   ```env
   MONGODB_URI=mongodb://localhost:27017/bondbook
   PORT=5000
   JWT_SECRET=your-secret-key-here
   ```

### Option 2: MongoDB Atlas (Cloud - Recommended)

1. **Create Free Account**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Sign up for free tier (M0 cluster)

2. **Create Cluster**
   - Click "Build a Database"
   - Choose free tier (M0)
   - Select region closest to you
   - Click "Create"

3. **Setup Database Access**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Create username and password
   - Save credentials securely

4. **Setup Network Access**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name

6. **Create .env file** in `bond_book_backend` folder:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bondbook?retryWrites=true&w=majority
   PORT=5000
   JWT_SECRET=your-secret-key-here
   ```

## Verify Connection

After setting up, restart your server:
```powershell
npm start
```

You should see:
```
✅ Connected to MongoDB successfully
📊 Database: bondbook
Server is running on port 5000
```

## Troubleshooting

### Error: `connect ECONNREFUSED 127.0.0.1:27017`

**Solution:**
- MongoDB is not running
- Start MongoDB service (see Option 1 above)
- Or check if MongoDB is installed correctly

### Error: `MONGODB_URI is not defined`

**Solution:**
- Create `.env` file in `bond_book_backend` folder
- Add `MONGODB_URI=your-connection-string`
- Restart the server

### Error: Authentication failed (MongoDB Atlas)

**Solution:**
- Check username and password in connection string
- Verify database user has proper permissions
- Check network access allows your IP address

## Default MongoDB Port

- Local MongoDB: `27017`
- MongoDB Atlas: Uses connection string provided

## Need Help?

- MongoDB Documentation: https://docs.mongodb.com/
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- Community Support: https://www.mongodb.com/community/forums/

