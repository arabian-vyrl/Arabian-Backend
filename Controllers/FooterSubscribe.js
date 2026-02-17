const nodemailer = require("nodemailer");

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_MAILER_EMAIL,
    pass: process.env.NODE_MAILER_PASSWORD,
  },
});

const subscribeEmail = async (req, res) => {
  try {
    const { email } = req.body;
    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }
    const mailOptions = {
      from: `"Website Subscription" <${email}>`,
      to: "adeel8128377@gmail.com",
      subject: "New Email Subscription",
      html: `<p>New subscriber email: <strong>${email}</strong></p>`,
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({
      success: true,
      message: "Subscription received successfully!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sending subscription email:",
      error: error.message,
    });
  }
};

module.exports = {
  subscribeEmail,
};
