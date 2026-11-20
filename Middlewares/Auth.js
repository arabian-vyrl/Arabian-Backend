const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code: "NO_TOKEN",
        message: "Access denied. No token provided.",
      });
    }

    if (!process.env.ACCESS_SECRET) {
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }

    req.user = { email: decoded.email, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "TOKEN_INVALID",
      message: "Token expired or invalid",
    });
  }
};

module.exports = authenticateToken;
