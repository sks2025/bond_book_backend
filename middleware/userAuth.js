import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
  try {
    // Extract token from cookies
    const { token } = req.cookies;
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No authentication token provided. Please login again."
      });
    }
    
    // Verify the token
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    
    // Check if token contains userId
    if (tokenDecode.userId) {
      // Add user info to request object
      req.user = { userId: tokenDecode.userId };
      next(); // Continue to the next middleware/route handler
    } else {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token. Please login again." 
      });
    }
  } catch (err) {
    console.error('Authentication error:', err);
    
    // Handle different JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired. Please login again." 
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token. Please login again." 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: "Authentication error. Please try again." 
      });
    }
  }
};

export default userAuth;