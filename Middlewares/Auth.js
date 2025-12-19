const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.SECRET_KEY;

const authenticateToken = (req, res, next) => {
  try {
    const token = req.cookies.login_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = authenticateToken;