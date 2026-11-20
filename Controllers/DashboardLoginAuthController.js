const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";
const REFRESH_COOKIE = "dashboard_refresh_token";

const isProduction = () => process.env.NODE_ENV === "production";

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? "none" : "lax",
  path: "/",
});

const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Both fields are required.",
      });
    }

    const adminEmail = process.env.DASHBOARD_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.DASHBOARD_ADMIN_PASSWORD?.trim();

    if (!adminEmail || !adminPassword || !process.env.ACCESS_SECRET || !process.env.REFRESH_SECRET) {
      console.error("❌ Dashboard auth env variables are missing");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    if (!safeEqual(email.trim(), adminEmail) || !safeEqual(password, adminPassword)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const payload = { email: adminEmail, role: "admin" };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: { email: adminEmail, role: "admin" },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ success: false, message: "No refresh token found" });
    }

    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);

    if (decoded.role !== "admin" || decoded.email !== process.env.DASHBOARD_ADMIN_EMAIL?.trim()) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const accessToken = generateAccessToken({ email: decoded.email, role: decoded.role });
    return res.status(200).json({
      success: true,
      accessToken,
      user: { email: decoded.email, role: decoded.role },
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
};

const verifyToken = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: { email: req.user.email, role: req.user.role },
  });
};

const logout = async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};

module.exports = {
  login,
  refreshToken,
  verifyToken,
  logout,
};
