import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const uploadDirs = ["uploads/images", "uploads/videos"];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Simple storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let destDir = "uploads/images";
    if (file.mimetype.startsWith("image/")) {
      destDir = "uploads/images";
    } else if (file.mimetype.startsWith("video/")) {
      destDir = "uploads/videos";
    }
    // Ensure directory exists before saving
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Simple file filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files allowed!"), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export default upload;