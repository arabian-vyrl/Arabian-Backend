// const jwt = require("jsonwebtoken");

// const JWT_SECRET = process.env.SECRET_KEY;
// const ADMIN_EMAIL = process.env.DASHBOARD_ADMIN_EMAIL;
// const ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;

// // console.log(ADMIN_EMAIL)
// // console.log(ADMIN_PASSWORD)

// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Both fields are required.",
//       });
//     }
//     if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password.",
//       });
//     }
//     const token = jwt.sign(
//       { email, role: "admin" },
//       JWT_SECRET,
//       { expiresIn: "6d" }
//     );
    
//     res.cookie("login_token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//       maxAge: 2 * 24 * 60 * 60 * 1000,
//     });

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//     });
//   } catch (error) {
//     console.error("❌ Login error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


// const verifyToken = async (req, res) => {
//   try {
//     res.status(200).json({
//       success: true,
//       user: req.user,
//     });
//   } catch (error) {
//     res.status(401).json({
//       success: false,
//       message: "Invalid token",
//     });
//   }
// };

// module.exports = {
//   login,
//   verifyToken,
// };

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.SECRET_KEY;
const ADMIN_EMAIL = process.env.DASHBOARD_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD;

// if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
//   console.error("❌ Missing required environment variables");
//   process.exit(1);
// }

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Both fields are required.",
      });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "2d" }
    );
    
    const isProduction = process.env.NODE_ENV === "production";
    
    res.cookie("login_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none" ,
      maxAge: 2 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
const verifyToken = async (req, res) => {
  try {
    const { email, role } = req.user;
    // console.log("This is the email", email, "This is the role", role)
    if (email !== ADMIN_EMAIL) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials in token",
      });
    }
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }
    res.status(200).json({
      success: true,
      user: {
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Token verification failed",
    });
  }
};




// Logout controller
const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("login_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/", 
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message,
    });
  }
};

module.exports = {
  login,
  verifyToken,
  logout
};