const ReferralProperty = require("../Models/ReferalPropertyModel");
const { response } = require("express");
const nodemailer = require("nodemailer");
const jwtToken = require("jsonwebtoken");
const salesforceService = require("../services/SalesforceService");
const Agent = require("../Models/AgentModel");
const path = require("path");
require("dotenv").config();

// Email configuration
// const transporter = nodemailer.createTransporter({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// Update the refer Table to assign the Agent name and Agent ID:

const agentUpdate = async (req, res) => {
  try {
    const { trackingCode } = req.params;
    const { agentId, agentName } = req.body;

    if (!agentId || !agentName) {
      return res.status(400).json({
        success: false,
        message: "agent_id and agent_name are required",
      });
    }

    const updatedDocument = await ReferralProperty.findOneAndUpdate(
      { tracking_code: trackingCode },
      {
        $set: {
          "agent_assign.agent_id": agentId,
          "agent_assign.agent_name": agentName,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
    if (!updatedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found with this tracking code",
      });
    }

    res.status(200).json({
      success: true,
      message: "Agent assigned successfully",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating agent",
      error: error.message,
    });
  }
};

const verifyReferrerToken = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ valid: false, message: "Unauthorized" });
    }
    const { referrerFullName, refferalEmail } = req.user;

    // console.log("Working");
    // console.log(req.user);
    const referrals = await ReferralProperty.find({
      // "referrer.full_name": referrerFullName,
      "referrer.email": refferalEmail,
    });

    if (!referrals || referrals.length === 0) {
      return res.status(404).json({
        valid: false,
        message: "No referrals found for this user",
      });
    }
    const referralData = referrals.map((r) => ({
      refereeName: `${r.referee.first_name} ${r.referee.last_name}`,
      trackingCode: r.tracking_code,
    }));

    return res.status(200).json({
      valid: true,
      details: referralData,
    });
  } catch (error) {
    console.error("Error in verifyReferrerToken:", error);
    return res.status(500).json({
      valid: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const Referrerlogout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("referalToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
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

const generateRandomPassword = (length = 6) => {
  const chars = "0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const trackRefer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const ADMIN_EMAIL = process.env.REFER_ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.REFER_ADMIN_PASSWORD;

    console.log(ADMIN_EMAIL, ADMIN_PASSWORD);

    // ===== ADMIN LOGIN =====
    if (email === ADMIN_EMAIL) {
      if (password === ADMIN_PASSWORD) {
        return res.status(200).json({
          success: true,
          message: "Admin login successful",
          isAdmin: true,
          details: null,
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "Invalid admin credentials",
        });
      }
    }

    // ===== USER LOGIN =====
    const user = await ReferralProperty.findOne({
      "referrer.email": email,
      "referrer.password": password,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const referrals = await ReferralProperty.find({
      "referrer.email": email,
    });

    if (!referrals || referrals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No referrals found for this user",
      });
    }

    const referralData = referrals.map((r) => ({
      refereeName: `${r.referee.first_name} ${r.referee.last_name}`,
      trackingCode: r.tracking_code,
    }));

    // const payload = {
    //   referrerFullName: referrals[0].referrer.full_name,
    //   refferalEmail: referrals[0].referrer.email,
    //   isAdmin: false,
    //   role: "user",
    // };


    const payload = {
      referrerFullName: referrals[0].referrer.first_name,
      refferalEmail: referrals[0].referrer.email,
      details: referralData, // ✅ add this so verify can return it
      isAdmin: false,
      role: "user",
    };
    const token = jwtToken.sign(payload, process.env.SECRET_KEY, {
      expiresIn: "2d",
    });

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("referalToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 2 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      isAdmin: false,
      details: referralData,
    });
  } catch (error) {
    console.error("Error in trackRefer:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// const trackRefer = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password are required",
//       });
//     }
//     const user = await ReferralProperty.find({
//       "referrer.email": email,
//       "referrer.password": password
//     });

//     if (!user || user.length === 0) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password",
//       });
//     }
//     const referrals = await ReferralProperty.find({
//       "referrer.email": email,
//     });

//     if (!referrals || referrals.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No referrals found for this user",
//       });
//     }
//     const referralData = referrals.map((r) => ({
//       refereeName: r.referee.full_name,
//       trackingCode: r.tracking_code,
//     }));

//     const referrerFullName = referrals[0].referrer.full_name;
//     const refferalEmail = referrals[0].referrer.email;

//     const payload = {
//       referrerFullName: referrerFullName,
//       refferalEmail: refferalEmail
//     };

//     const secretKey = process.env.SECRET_KEY;
//     const options = {
//       expiresIn: '1h'
//     };
//     const token = jwtToken.sign(payload, secretKey, options)

//     res.cookie("referalToken", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
//       maxAge: 10 * 60 * 60 * 1000,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Login successful",
//       details: referralData,
//       // generatedToken: token,
//     });

//   } catch (error) {
//     console.error("Error in trackRefer:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const GetAllReferal = async (req, res) => {
  try {
    const referells = await ReferralProperty.find();
    return res.status(200).json({
      success: true,
      message: "All Referrals fetched successfully",
      data: referells,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const ReferProperty = async (req, res) => {
  try {
    const {
      Reffrer_FirstName,
      Reffrer_LastName,
      Reffrer_PhoneNumber,
      Reffrer_EmailAdress,
      Relation_to_Reffrer,
      PropertyArea,
      Refree_Firstname,
      Refree_Lastname,
      Refree_EmailAdress,
      Refree_PhoneNumber,
      Refree_Preffered_Contact_Form,
      Best_Time_To_Contect,
      Urgency_Level,
      Special_Requirements,
    } = req.body;

    console.log(req.body);

    // Step 1: Validation
    // const validationErrors = validateReferralData(req.body);
    // if (validationErrors.length > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Validation failed",
    //     errors: validationErrors,
    //   });
    // }

    // Step 2: Check for existing referrer
    let ReffrerPassword;
    const existingReferrer = await ReferralProperty.findOne({
      "referrer.email": Reffrer_EmailAdress,
      "referrer.first_name": Reffrer_FirstName,
      "referrer.last_name": Reffrer_LastName,
    });

    if (existingReferrer) {
      ReffrerPassword = existingReferrer.referrer.password;
    } else {
      ReffrerPassword = generateRandomPassword(6);
    }

    // Step 3: Save referral to DB
    const referralData = new ReferralProperty({
      referrer: {
        first_name: Reffrer_FirstName,
        last_name: Reffrer_LastName,
        email: Reffrer_EmailAdress,
        phone: Reffrer_PhoneNumber,
        password: ReffrerPassword,
      },
      property: { area: PropertyArea || null },
      referee: {
        first_name: Refree_Firstname,
        last_name: Refree_Lastname,
        email: Refree_EmailAdress,
        phone: Refree_PhoneNumber,
        relationship: Relation_to_Reffrer,
        preferred_contact: Refree_Preffered_Contact_Form || "Phone",
        best_time_contact: Best_Time_To_Contect || "Anytime",
      },
      query_details: {
        urgency_level: Urgency_Level || "No rush",
        special_requirements: Special_Requirements || null,
      },
    });

    console.log("referralData is", referralData);

    const savedReferral = await referralData.save();
    res.status(201).json({
      success: true,
      message: "Referral submitted successfully",
      data: {
        tracking_code: savedReferral.tracking_code,
        referral_id: savedReferral._id,
        referrer_name: `${Reffrer_FirstName} ${Reffrer_LastName}`,
        referee_name: `${Refree_Firstname} ${Refree_Lastname}`,
      },
    });
    const previousReferrals = await ReferralProperty.find({
      "referrer.email": Reffrer_EmailAdress,
    }).select("tracking_code");

    const allTrackingCodes = previousReferrals.map((r) => r.tracking_code);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODE_MAILER_EMAIL,
        pass: process.env.NODE_MAILER_PASSWORD,
      },
    });
    const sendEmail = async (to, subject, html, attachments = []) => {
      try {
        await transporter.sendMail({
          from: process.env.NODE_EMAIL,
          to,
          subject,
          html,
          attachments,
        });
        console.log("Email sent to:", to);
        await ReferralProperty.findByIdAndUpdate(savedReferral._id, {
          emailSent: true,
        });
      } catch (err) {
        console.error("Email send error:", err.message);
      }
    };
    await sendEmail(
      Reffrer_EmailAdress,
      "Your Property Referral – Login & Tracking Details",
      `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    
    <h2>Hello ${Reffrer_FirstName} ${Reffrer_LastName},</h2>

    <p>
      Thank you for submitting a new property referral. We have successfully received your details.
    </p>

    <h3>Next Steps:</h3>
    <ul>
      <li>
        Review and sign the attached terms and return them to us by replying to this email.
      </li>
      <li>
        Log in to your account using the details below:
      </li>
    </ul>

    <p>
      <strong>Email:</strong> ${Reffrer_EmailAdress}<br/>
      <strong>Password:</strong> ${ReffrerPassword}
    </p>

    <h3>All Your Referral Tracking Codes</h3>
    <ul>
      ${allTrackingCodes.map(code => `<li><strong>${code}</strong></li>`).join("")}
    </ul>

    <p>
      You can use these tracking codes to monitor the progress of each referral.
    </p>


    <p>
      Thank you for helping us connect with new clients.
    </p>

    <p>
      <strong>Best Regards,</strong><br/>
      Arabian Estates
    </p>

  </div>
  `,
      [
        {
          filename: "Referral Agreement.pdf",
          path: path.join(__dirname, "../document/Referral Agreement.pdf"),
        }
      ]
    );
    // Send to the data

    try {
      const salesforceData = {
        first_name: Reffrer_FirstName,
        last_name: Reffrer_LastName,
        email: Reffrer_EmailAdress,
        tele_phone: Reffrer_PhoneNumber,
        Property_Area: PropertyArea || null,
        Referee_First_Name: Refree_Firstname,
        Referee_Last_Name: Refree_Lastname,
        Referee_Email: Refree_EmailAdress,
        Referee_Phone: Refree_PhoneNumber,
        Relationship_To_Referrer: Relation_to_Reffrer,
        Preferred_Contact_Method: Refree_Preffered_Contact_Form,
        Best_Time_To_Contact: Best_Time_To_Contect,
        Urgency_Level: Urgency_Level,
        Special_Requirements: Special_Requirements,
        recordType: "Referral",
        leadSource: "Website",
        leadChannel: "Form",
        leadSourceContact: "Referral  ",
        defaultOwner: "info@arabianestates.ae",
      };

      salesforceService.syncWithRetry(
        ReferralProperty,
        savedReferral._id,
        salesforceData,
      );
    } catch (sfError) {
      console.error("Error syncing with Salesforce:", sfError);
    }
  } catch (error) {
    console.error("Error in ReferProperty:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const trackQUery = async (req, res) => {
  try {
    const trackingCode = req.query.trackingCode;

    // Step 1: Validate tracking code format
    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        message: "Tracking code is required",
      });
    }

    // Validate 6-digit format
    if (!/^\d{6}$/.test(trackingCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking code format. Please enter a 6-digit number.",
      });
    }

    // Step 2: Search in database
    const referral = await ReferralProperty.findOne({
      tracking_code: trackingCode,
    });

    if (!referral) {
      return res.status(404).json({
        success: false,
        message:
          "No referral found with this tracking code. Please check your code and try again.",
      });
    }
    const progressData = {
      tracking_info: {
        tracking_code: referral.tracking_code,
        submission_date: referral.created_at,
        last_updated: referral.query_progress.last_updated,
      },

      referral_details: {
        referee_name: `${referral.referee.first_name} ${referral.referrer.last_name}`,
        referrer_name: `${referral.referrer.first_name} ${referral.referrer.last_name}`,
        property_area: referral.property.area || "Not specified",
        urgency_level: referral.query_details.urgency_level,
      },

      current_status: {
        status: referral.query_progress.status,
        assigned_agent: referral.agent_assign.agent_name || "Not Assigned Yet",
        last_updated: referral.query_progress.last_updated,
      },
    };

    res.status(200).json({
      success: true,
      message: "Query progress retrieved successfully",
      data: progressData,
    });
  } catch (error) {
    console.error("Error in trackQueryProgress:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving query progress",
      error: error.message,
    });
  }
};

// Validation function
// function validateReferralData(data) {
//   const errors = [];

//   // if (!data.Reffrer_FullName) errors.push('Referrer full name is required');
//   if (!data.Reffrer_EmailAdress) errors.push('Referrer email is required');
//   if (!data.Reffrer_PhoneNumber) errors.push('Referrer phone number is required');
//   if (!data.Refree_FullName) errors.push('Referee full name is required');
//   if (!data.Refree_EmailAdress) errors.push('Referee email is required');
//   if (!data.Refree_PhoneNumber) errors.push('Referee phone number is required');
//   // if (!data.Relation_to_Reffrer) errors.push('Relationship to referee is required');

//   // Email validation
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   if (data.Reffrer_EmailAdress && !emailRegex.test(data.Reffrer_EmailAdress)) {
//     errors.push('Invalid referrer email format');
//   }
//   if (data.Refree_EmailAdress && !emailRegex.test(data.Refree_EmailAdress)) {
//     errors.push('Invalid referee email format');
//   }

//   return errors;
// }

// Function to update query progress (work on it)
// const updateQueryProgress = async (req, res) => {
//   try {
//     const { trackingCode, newStatus,  agentEmail } = req.query;
//     if (!newStatus) {
//       return res.status(400).json({
//         success: false,
//         message: "newStatus is required",
//       });
//     }
//     const validStatuses = [
//       "Query Received",
//       "Agent Assigned",
//       "Contact Initiated",
//       "Meeting Scheduled",
//       "Property Shown",
//       "Negotiation",
//       "Deal Closed Collect Commission From Our Office",
//       "Client Not Interested",
//       "Cancelled",
//     ];

//     if (!validStatuses.includes(newStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
//       });
//     }

//     const updateData = {
//       "query_progress.status": newStatus,
//       "query_progress.last_updated": new Date(),
//     };

//     if (newStatus === "Agent Assigned") {
//       if (!agentId || !agentName) {
//         return res.status(400).json({
//           success: false,
//           message: "agentId and agentName are required when status is Agent Assigned",
//         });
//       }

//       updateData["agent_assign.agent_id"] = agentId;
//       updateData["agent_assign.agent_name"] = agentName;
//     }

//     const updatedDocument = await ReferralProperty.findOneAndUpdate(
//       { tracking_code: trackingCode },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     if (!updatedDocument) {
//       return res.status(404).json({
//         success: false,
//         message: "Document not found with this tracking code",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Query progress updated successfully",
//       data: {
//         id: updatedDocument._id,
//         tracking_code: updatedDocument.tracking_code,
//         agent_assign: updatedDocument.agent_assign,
//         query_progress: updatedDocument.query_progress,
//       },
//     });
//   } catch (error) {
//     console.error("Error updating query progress:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Server error while updating query progress",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

const updateQueryProgress = async (req, res) => {
  try {
    const { trackingCode, newStatus, agentEmail } = req.query;
    console.log("email", req.query.agentEmail);
    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        message: "trackingCode is required",
      });
    }

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "newStatus is required",
      });
    }

    const validStatuses = [
      "Query Received",
      "Agent Assigned",
      "Contact Initiated",
      "Meeting Scheduled",
      "Property Shown",
      "Negotiation",
      "Deal Closed Collect Commission From Our Office",
      "Client Not Interested",
      "Cancelled",
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Base update (always applied)
    const updateData = {
      "query_progress.status": newStatus,
      "query_progress.last_updated": new Date(),
    };

    /**
     * ✅ Agent can be updated at ANY stage
     * If agentEmail is provided → update agent_assign
     */
    if (agentEmail) {
      const agentDoc = await Agent.findOne({
        email: agentEmail.trim().toLowerCase(),
        isActive: true,
      }).select("agentName agentId email");

      if (!agentDoc) {
        return res.status(404).json({
          success: false,
          message: "Active agent not found with this email",
        });
      }

      updateData["agent_assign.agent_name"] = agentDoc.agentName;
      updateData["agent_assign.agent_id"] = agentDoc.agentId;
      updateData["agent_assign.agent_email"] = agentDoc.email;
      updateData["agent_assign.updated_at"] = new Date();
    }

    const updatedDocument = await ReferralProperty.findOneAndUpdate(
      { tracking_code: trackingCode },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found with this tracking code",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Query updated successfully",
      data: {
        id: updatedDocument._id,
        tracking_code: updatedDocument.tracking_code,
        agent_assign: updatedDocument.agent_assign,
        query_progress: updatedDocument.query_progress,
      },
    });
  } catch (error) {
    console.error("Error updating query progress:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating query progress",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const deleteQuery = async (req, res) => {
  try {
    // Extract tracking ID from query parameters
    const { trackingId } = req.query;

    console.log("Deleting query with tracking ID:", trackingId);

    // Validate required parameter
    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: trackingId is required",
      });
    }

    // Find and delete the referral document
    const deletedReferral = await ReferralProperty.findOneAndDelete({
      tracking_code: trackingId,
    });

    // Check if referral was found and deleted
    if (!deletedReferral) {
      return res.status(404).json({
        success: false,
        message: "Referral not found with the provided tracking ID",
      });
    }

    // Log the deletion for audit purposes
    console.log(`Query deleted successfully: ${trackingId}`, {
      deletedAt: new Date(),
      referrerName: deletedReferral.referrer.full_name,
      refereeName: deletedReferral.referee.full_name,
    });

    // Return success response with deleted referral info
    return res.status(200).json({
      success: true,
      message: "Query deleted successfully",
      data: {
        tracking_code: deletedReferral.tracking_code,
        referrer_name: deletedReferral.referrer.full_name,
        referee_name: deletedReferral.referee.full_name,
        deleted_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Error deleting query:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid tracking ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting query",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Email to referrer
async function sendReferrerConfirmationEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: "Property Referral Confirmation - Tracking Code Inside",
    html: `
      <h2>Thank You for Your Referral!</h2>
      <p>Dear ${referralData.referrer.full_name},</p>
      <p>Your property referral has been successfully submitted. Here are the details:</p>
      
      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Your Tracking Code: <strong style="color: #007bff;">${referralData.tracking_code}</strong></h3>
      </div>
      
      <p><strong>Referee Details:</strong></p>
      <ul>
        <li>Name: ${referralData.referee.full_name}</li>
        <li>Email: ${referralData.referee.email}</li>
        <li>Phone: ${referralData.referee.phone}</li>
      </ul>
      
      <p>You can track the progress of this referral using the tracking code on our portal.</p>
      <p>We will keep you updated on the progress and notify you about any commission once the deal is closed.</p>
      
      <p>Best regards,<br>Your Property Team</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// Email to referee
async function sendRefereeIntroductionEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referee.email,
    subject: "Property Search Application Submitted for You",
    html: `
      <h2>Property Search Application</h2>
      <p>Dear ${referralData.referee.full_name},</p>
      <p>${referralData.referrer.full_name
      } has submitted a property search application on your behalf.</p>
      
      <h3>About Our Company</h3>
      <p>We are a leading property dealer with years of experience in helping clients find their dream properties. Our team of expert agents will assist you in finding the perfect property that matches your requirements.</p>
      
      <p><strong>Your Requirements:</strong></p>
      <ul>
        <li>Urgency: ${referralData.query_details.urgency_level}</li>
        ${referralData.property.area
        ? `<li>Preferred Area: ${referralData.property.area}</li>`
        : ""
      }
        ${referralData.query_details.special_requirements
        ? `<li>Special Requirements: ${referralData.query_details.special_requirements}</li>`
        : ""
      }
      </ul>
      
      <p>One of our agents will contact you soon via ${referralData.referee.preferred_contact
      } during ${referralData.referee.best_time_contact}.</p>
      
      <p>Best regards,<br>Your Property Team</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// async function sendToSalesforce(referralData) {
//   try {
//     // This is a placeholder - implement based on your Salesforce API
//     const salesforceData = {
//       tracking_code: referralData.tracking_code,
//       referrer: referralData.referrer,
//       referee: referralData.referee,
//       property: referralData.property,
//       query_details: referralData.query_details,
//       created_at: referralData.created_at
//     };

//     // Example API call to Salesforce
//     // const response = await axios.post('YOUR_SALESFORCE_ENDPOINT', salesforceData, {
//     //   headers: {
//     //     'Authorization': `Bearer ${process.env.SALESFORCE_TOKEN}`,
//     //     'Content-Type': 'application/json'
//     //   }
//     // });

//     console.log('Lead sent to Salesforce:', salesforceData);
//     return true;
//   } catch (error) {
//     console.error('Error sending to Salesforce:', error);
//     throw error;
//   }
// }

// Send progress update email
async function sendProgressUpdateEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: `Referral Update - ${referralData.tracking_code}`,
    html: `
      <h2>Referral Progress Update</h2>
      <p>Dear ${referralData.referrer.full_name},</p>
      <p>Your referral (Tracking Code: <strong>${referralData.tracking_code
      }</strong>) has been updated.</p>
      
      <p><strong>Current Status:</strong> ${referralData.query_progress.status
      }</p>
      ${referralData.query_progress.assigned_agent
        ? `<p><strong>Assigned Agent:</strong> ${referralData.query_progress.assigned_agent}</p>`
        : ""
      }
      
      <p>We will continue to keep you updated on the progress.</p>
      
      <p>Best regards,<br>Your Property Team</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// Function to handle deal completion and commission
const completeDeal = async (referralId, dealValue, commissionPercentage) => {
  try {
    const commissionAmount = (dealValue * commissionPercentage) / 100;

    const referral = await ReferralProperty.findByIdAndUpdate(
      referralId,
      {
        $set: {
          "query_progress.status": "Deal Closed",
          "commission.amount": commissionAmount,
          "commission.percentage": commissionPercentage,
          "commission.deal_value": dealValue,
          "commission.status": "Approved",
        },
      },
      { new: true },
    );

    // Send commission notification email
    await sendCommissionNotificationEmail(referral);

    return referral;
  } catch (error) {
    console.error("Error completing deal:", error);
    throw error;
  }
};

// Send commission notification email
async function sendCommissionNotificationEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: "Congratulations! Commission Ready for Collection",
    html: `
      <h2>🎉 Deal Completed Successfully!</h2>
      <p>Dear ${referralData.referrer.full_name},</p>
      <p>Great news! The deal for your referral has been successfully completed.</p>
      
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Commission Details:</h3>
        <p><strong>Commission Amount:</strong> ₹${referralData.commission.amount.toLocaleString()}</p>
        <p><strong>Deal Value:</strong> ₹${referralData.commission.deal_value.toLocaleString()}</p>
        <p><strong>Commission Rate:</strong> ${referralData.commission.percentage
      }%</p>
      </div>
      
      <p><strong>Please visit our office to collect your commission amount.</strong></p>
      <p>Bring a valid ID and mention your tracking code: <strong>${referralData.tracking_code
      }</strong></p>
      
      <p>Thank you for your referral!</p>
      <p>Best regards,<br>Your Property Team</p>
    `,
  };

  return transporter.sendMail(mailOptions);
}

// Export functions
module.exports = {
  ReferProperty,
  deleteQuery,
  updateQueryProgress,
  completeDeal,
  trackQUery,
  GetAllReferal,
  trackRefer,
  verifyReferrerToken,
  agentUpdate,
  Referrerlogout,
};