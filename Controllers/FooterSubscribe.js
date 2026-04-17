const nodemailer = require("nodemailer");
const salesforceService = require("../services/SalesforceService");
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

    console.log("Email", email)
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
      to: process.env.NODE_MAILER_EMAIL,
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

// const downloadFile = async (req, res) => {
//   try {
//     const { firstName, lastName, email, phone, source, type } = req.body;

//     console.log(firstName, lastName, email, phone, source, type);

//     // Validation
//     if (!firstName || !lastName || !email || !phone || !source || !type) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required.",
//       });
//     }

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid email format.",
//       });
//     }

//     const fullName = `${firstName} ${lastName}`;

//     // Admin email
//     const adminMailOptions = {
//       from: `"${type.charAt(0).toUpperCase() + type.slice(1)} Request" <${email}>`,
//       to: process.env.NODE_MAILER_EMAIL,
//       subject: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Download Request`,
//       html: `
//         <h3>New Download Request</h3>
//         <p><strong>First Name:</strong> ${firstName}</p>
//         <p><strong>Last Name:</strong> ${lastName}</p>
//         <p><strong>Email:</strong> ${email}</p>
//         <p><strong>Phone:</strong> ${phone}</p>
//         <p><strong>Property Link:</strong>
//           <a href="${source}" target="_blank">${source}</a>
//         </p>
//         <p><strong>Download Type:</strong> ${type}</p>
//       `,
//     };

//     // User email - simple notification
//     const userMailOptions = {
//       from: `${process.env.NODE_MAILER_EMAIL}`,
//       to: email,
//       subject: `Your ${type.charAt(0).toUpperCase() + type.slice(1)} Download Request`,
//       html: `
//         <p>Hi ${fullName},</p>
//         <p>Thank you for your interest. Your request for the ${type} has been received successfully.</p>
//         <p>Best regards,</p>
//       `,
//     };

//     // Send emails
//     await transporter.sendMail(adminMailOptions);
//     // await transporter.sendMail(userMailOptions);

//     return res.status(200).json({
//       success: true,
//       message: `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted successfully.`,
//     });

//   } catch (error) {
//     console.error("Error sending email:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error sending email",
//       error: error.message,
//     });
//   }
// };

module.exports = {
  subscribeEmail,
};  