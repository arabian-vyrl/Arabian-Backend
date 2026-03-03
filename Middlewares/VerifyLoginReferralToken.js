const jwtToken = require("jsonwebtoken");
require("dotenv").config()

// const VerifyLoginReferralToken = (req, res, next) => {
//   const token = req.cookies.referalToken;
//   if (!token) {
//     return res.status(401).json({ message: "Unauthorized: Token not found" });
//   }
//   try {
//     const decoded = jwtToken.verify(token, process.env.SECRET_KEY);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     return res.status(403).json({ message: "Forbidden: Invalid token" });
//   }
// };


const VerifyLoginReferralToken = (req, res, next) => {
  const token = req.cookies.referalToken;
  if (!token) {
    // Instead of 401
    return res.status(200).json({ valid: false, message: "No token found" });
  }
  try {
    const decoded = jwtToken.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    // Instead of 403
    return res.status(200).json({ valid: false, message: "Invalid token" });
  }
};


module.exports = VerifyLoginReferralToken; 
