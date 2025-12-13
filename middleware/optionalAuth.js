import jwt from "jsonwebtoken";

// Optional authentication middleware
// Sets req.user if valid token is present, but doesn't require authentication
const optionalAuth = async (req, res, next) => {
  try {
    // Extract token from cookies or Authorization header
    let token = req.cookies?.token;

    // Check Authorization header if no cookie token
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // If no token, continue without setting req.user
    if (!token) {
      return next();
    }

    // Try to verify the token
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

    // If token is valid and contains userId, set req.user
    if (tokenDecode.userId) {
      req.user = { userId: tokenDecode.userId };
    }

    next();
  } catch (err) {
    // Token invalid or expired - continue without authentication
    // This is optional auth, so we don't return an error
    console.log('Optional auth: Invalid token, continuing without auth');
    next();
  }
};

export default optionalAuth;
