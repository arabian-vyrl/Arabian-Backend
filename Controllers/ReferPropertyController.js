const ReferralProperty = require('../Models/ReferalPropertyModel');
const axios = require('axios'); // For Salesforce integration
const { response } = require('express');
const nodemailer = require('nodemailer');
const jwtToken = require("jsonwebtoken");
require("dotenv").config()

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
      }
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

    const referrals = await ReferralProperty.find({
      "referrer.full_name": referrerFullName,
      "referrer.email": refferalEmail
    });

    if (!referrals || referrals.length === 0) {
      return res.status(404).json({
        valid: false,
        message: "No referrals found for this user",
      });
    }
    const referralData = referrals.map((r) => ({
      refereeName: r.referee.full_name,
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

const generateRandomPassword = (length = 6) => {
  const chars = '0123456789';
  let password = '';
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
    const user = await ReferralProperty.find({
      "referrer.email": email,
      "referrer.password": password
    });

    if (!user || user.length === 0) {
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
      refereeName: r.referee.full_name,
      trackingCode: r.tracking_code,
    }));

    const referrerFullName = referrals[0].referrer.full_name;
    const refferalEmail = referrals[0].referrer.email;

    const payload = {
      referrerFullName: referrerFullName, 
      refferalEmail: refferalEmail
    };

    const secretKey = process.env.SECRET_KEY;
    const options = {
      expiresIn: '1h'
    };
    const token = jwtToken.sign(payload, secretKey, options)
  
    res.cookie("referalToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 10 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      details: referralData,
      // generatedToken: token,
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

const GetAllReferal = async (req, res) => {
  try {
    const referells = await ReferralProperty.find();
    return res.status(200).json({
      success: true,
      message: 'All Referrals fetched successfully',
      data: referells
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

// const ReferProperty = async (req, res) => {
//   try {
//     const {
//       Reffrer_FullName,
//       Reffrer_PhoneNumber,
//       Reffrer_EmailAdress,
//       Relation_to_Reffrer,
//       PropertyArea,
//       Refree_FullName,
//       Refree_EmailAdress,
//       Refree_PhoneNumber,
//       Refree_Preffered_Contact_Form,
//       Best_Time_To_Contect,
//       Urgency_Level,
//       Special_Requirements
//     } = req.body;
//     console.log("WORKING")
//     console.log(req.body);

//     // Step 1: Validation
//     const validationErrors = validateReferralData(req.body);
//     if (validationErrors.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Validation failed',
//         errors: validationErrors
//       });
//     }

//     // Step 2: Save to Database
//     const referralData = new ReferralProperty({
//       referrer: {
//         full_name: Reffrer_FullName,
//         email: Reffrer_EmailAdress,
//         phone: Reffrer_PhoneNumber
//       },
//       property: {
//         area: PropertyArea || null
//       },
//       referee: {
//         full_name: Refree_FullName,
//         email: Refree_EmailAdress,
//         phone: Refree_PhoneNumber,
//         relationship: Relation_to_Reffrer,
//         preferred_contact: Refree_Preffered_Contact_Form || 'Phone',
//         best_time_contact: Best_Time_To_Contect || 'Anytime'
//       },
//       query_details: {
//         urgency_level: Urgency_Level || 'No rush',
//         special_requirements: Special_Requirements || null
//       }
//     });

//     const savedReferral = await referralData.save();

//     // Step 3: Generate tracking code (auto-generated in pre-save hook)
//     const trackingCode = savedReferral.tracking_code;
//     // Step 4: Send email to referrer
//     // await sendReferrerConfirmationEmail(savedReferral);

//     // Step 5: Send email to referee
//     // await sendRefereeIntroductionEmail(savedReferral);

//     // Step 6: Send lead to Salesforce
//     // await sendToSalesforce(savedReferral);

//     // Step 7: Update progress to "Lead Sent to Sales"
//     // await updateQueryProgress(savedReferral._id, 'Lead Sent to Sales', 'Lead automatically sent to sales team');

//     res.status(201).json({
//       success: true,
//       message: 'Referral submitted successfully',
//       data: {
//         objectID: id, 
//         tracking_code: trackingCode,
//         referral_id: savedReferral._id,
//         referrer_name: Reffrer_FullName,
//         referee_name: Refree_FullName
//       }
//     });

//   } catch (error) {
//     console.error('Error in ReferProperty:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       error: error.message
//     });
//   }
// };

const ReferProperty = async (req, res) => {

  try {
    const {
      Reffrer_FullName,
      Reffrer_PhoneNumber,
      Reffrer_EmailAdress,
      Relation_to_Reffrer,
      PropertyArea,
      Refree_FullName,
      Refree_EmailAdress,
      Refree_PhoneNumber,
      Refree_Preffered_Contact_Form,
      Best_Time_To_Contect,
      Urgency_Level,
      Special_Requirements,
    } = req.body;
    console.log("WORKING")
    console.log(req.body);

    // Step 1: Validation
    const validationErrors = validateReferralData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Step 2: Save to Database
    const existingReferrer = await ReferralProperty.findOne({
      'referrer.email': Reffrer_EmailAdress,
      'referrer.full_name': Reffrer_FullName
    });

    if (existingReferrer) {
      ReffrerPassword = existingReferrer.referrer.password;
      console.log("Existing referrer found, reusing password:", ReffrerPassword);
    } else {
      ReffrerPassword = generateRandomPassword(6);
      console.log("New referrer, password generated:", ReffrerPassword);
    }
    const referralData = new ReferralProperty({
      referrer: {
        full_name: Reffrer_FullName,
        email: Reffrer_EmailAdress,
        phone: Reffrer_PhoneNumber,
        password: ReffrerPassword,
      },
      property: {
        area: PropertyArea || null
      },
      referee: {
        full_name: Refree_FullName,
        email: Refree_EmailAdress,
        phone: Refree_PhoneNumber,
        relationship: Relation_to_Reffrer,
        preferred_contact: Refree_Preffered_Contact_Form || 'Phone',
        best_time_contact: Best_Time_To_Contect || 'Anytime'
      },
      query_details: {
        urgency_level: Urgency_Level || 'No rush',
        special_requirements: Special_Requirements || null
      }
    });

    const savedReferral = await referralData.save();

    console.log("Referral saved with ID:", savedReferral._id);


    const previousReferrals = await ReferralProperty.find({
      'referrer.email': Reffrer_EmailAdress
    }).select("tracking_code");


    const allTrackingCodes = previousReferrals.map(r => r.tracking_code);

  //   const transporter = nodemailer.createTransport({
  //     service: "gmail",
  //     auth: {
  //       user: "adeel8128377@gmail.com",
  //       pass: "xeio pmwi xxey asku",
  //     },
  //   });

  //   const sendEmail = async (to, subject, html) => {
  //     try {
  //       await transporter.sendMail({
  //         from: process.env.EMAIL,
  //         to,
  //         subject,
  //         html
  //       });
  //       console.log("Email sent to:", to);
  //     } catch (err) {
  //       console.error("Email send error:", err.message);
  //     }
  //   };

  //   await sendEmail(
  //     Reffrer_EmailAdress,
  //     "Your Property Referral – Login & Tracking Details",
  //     `
  // <div style="font-family: Arial, sans-serif; line-height: 1.6;">

  //   <h2>Hello ${Reffrer_FullName},</h2>

  //   <p>Thank you for submitting a new property referral. We have successfully received your details.</p>

  //   <h3>Your Portal Login Details</h3>
  //   <p>
  //     <strong>Email:</strong> ${Reffrer_EmailAdress}<br/>
  //     <strong>Password:</strong> ${ReffrerPassword}
  //   </p>

  //   <p>You can log into your referral dashboard to track the status of all your referrals.</p>

  //   <h3>All Your Referral Tracking Codes</h3>
  //   <p>Here are all the tracking codes associated with your referrals:</p>

  //   <ul>
  //     ${allTrackingCodes
  //       .map(code => `<li><strong>${code}</strong></li>`)
  //       .join("")}
  //   </ul>

  //   <p>You can use these tracking codes to monitor the progress of each referral.</p>

  //   <br/>

  //   <p>Thank you for helping us connect with new clients.</p>

  //   <p>
  //     <strong>Best Regards,</strong><br/>
  //     Your Company Name
  //   </p>

  // </div>
  // `
  //   );


    // Try to do with WEB3 Form

    // const WEB3FORMS_ACCESS_KEY = process.env.WEB3_FORM_KEY

    // console.log("Web3 Forms Access Key:", WEB3FORMS_ACCESS_KEY);

    // const formData = {
    //   access_key: WEB3FORMS_ACCESS_KEY,
    //   name: "Adeel",
    //   email: "adeel8128377@gmail.com",
    //   subject: "New Property Referral Submitted",
    //   message: "Property referral details here" // Required field
    // };

    // try {
    //   const response = await axios.post(
    //     'https://api.web3forms.com/submit',
    //     formData,
    //     {
    //       headers: {
    //         'Content-Type': 'application/json',
    //       }
    //     }
    //   );

    //   if (response.data.success) {
    //     return res.status(200).json({
    //       success: true,
    //       message: 'Email sent successfully!',
    //       data: response.data
    //     });
    //   } else {
    //     return res.status(400).json({
    //       success: false,
    //       message: 'Failed to send email',
    //       error: response.data.message
    //     });
    //   }

    // } catch (err) {
    //   console.error("Failed to send Web3 form email:", err.message);
    //   return res.status(500).json({
    //     success: false,
    //     message: 'Server error while sending email',
    //     error: err.message
    //   });
    // }


    // Step 3: Generate tracking code (auto-generated in pre-save hook)
    const trackingCode = savedReferral.tracking_code;
    // Step 4: Send email to referrer
    // await sendReferrerConfirmationEmail(savedReferral);

    // Step 5: Send email to referee
    // await sendRefereeIntroductionEmail(savedReferral);

    // Step 6: Send lead to Salesforce
    // await sendToSalesforce(savedReferral);

    // Step 7: Update progress to "Lead Sent to Sales"
    // await updateQueryProgress(savedReferral._id, 'Lead Sent to Sales', 'Lead automatically sent to sales team');

    res.status(201).json({
      success: true,
      message: 'Referral submitted successfully',
      data: {
        tracking_code: trackingCode,
        referral_id: savedReferral._id,
        referrer_name: Reffrer_FullName,
        referee_name: Refree_FullName
      }
    });

  } catch (error) {
    console.error('Error in ReferProperty:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
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
        message: 'Tracking code is required'
      });
    }

    // Validate 6-digit format
    if (!/^\d{6}$/.test(trackingCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking code format. Please enter a 6-digit number.'
      });
    }

    // Step 2: Search in database
    const referral = await ReferralProperty.findOne({ tracking_code: trackingCode });

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'No referral found with this tracking code. Please check your code and try again.'
      });
    }
    const progressData = {
      tracking_info: {
        tracking_code: referral.tracking_code,
        submission_date: referral.created_at,
        last_updated: referral.query_progress.last_updated
      },

      referral_details: {
        referrer_name: referral.referrer.full_name,
        referee_name: referral.referee.full_name,
        property_area: referral.property.area || 'Not specified',
        urgency_level: referral.query_details.urgency_level
      },

      current_status: {
        status: referral.query_progress.status,
        assigned_agent: referral.agent_assign.agent_name || "Not Assigned Yet",
        last_updated: referral.query_progress.last_updated
      },
    };

    res.status(200).json({
      success: true,
      message: 'Query progress retrieved successfully',
      data: progressData
    });

  } catch (error) {
    console.error('Error in trackQueryProgress:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving query progress',
      error: error.message
    });
  }
}

// Validation function
function validateReferralData(data) {
  const errors = [];

  if (!data.Reffrer_FullName) errors.push('Referrer full name is required');
  if (!data.Reffrer_EmailAdress) errors.push('Referrer email is required');
  if (!data.Reffrer_PhoneNumber) errors.push('Referrer phone number is required');
  if (!data.Refree_FullName) errors.push('Referee full name is required');
  if (!data.Refree_EmailAdress) errors.push('Referee email is required');
  if (!data.Refree_PhoneNumber) errors.push('Referee phone number is required');
  if (!data.Relation_to_Reffrer) errors.push('Relationship to referee is required');

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.Reffrer_EmailAdress && !emailRegex.test(data.Reffrer_EmailAdress)) {
    errors.push('Invalid referrer email format');
  }
  if (data.Refree_EmailAdress && !emailRegex.test(data.Refree_EmailAdress)) {
    errors.push('Invalid referee email format');
  }

  return errors;
}



// Function to update query progress (work on it)
const updateQueryProgress = async (req, res) => {
  try {
    // Extract parameters from query
    const { newStatus, trackingId } = req.query;

    console.log('Updating progress:', { newStatus, trackingId });

    // Validate required parameters
    if (!newStatus || !trackingId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: newStatus and trackingId are required'
      });
    }

    // Validate status against enum values from your schema
    const validStatuses = [
      'Query Received',
      'Agent Assigned',
      'Contact Initiated',
      'Meeting Scheduled',
      'Property Shown',
      'Negotiation',
      'Deal Closed Collect Commission From Our Office',
      'Client Not Interested',
      'Cancelled',
    ];

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Prepare update data
    const updateData = {
      'query_progress.status': newStatus,
      'query_progress.last_updated': new Date()
    };

    // Update the referral document
    const referral = await ReferralProperty.findOneAndUpdate(
      { tracking_code: trackingId },
      { $set: updateData },
      {
        new: true, // Return the updated document
        runValidators: true // Run schema validations
      }
    );

    // Check if referral was found and updated
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found with the provided tracking ID'
      });
    }

    // Send update email to referrer (uncomment when email service is ready)
    // if (referral) {
    //   await sendProgressUpdateEmail(referral);
    // }

    return res.status(200).json({
      success: true,
      message: 'Query progress updated successfully',
      data: {
        id: referral._id,
        tracking_code: referral.tracking_code,
        status: referral.query_progress.status,
        last_updated: referral.query_progress.last_updated,
        notes: referral.query_progress.notes
      }
    });

  } catch (error) {
    console.error('Error updating query progress:', error);

    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking ID format'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating query progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteQuery = async (req, res) => {
  try {
    // Extract tracking ID from query parameters
    const { trackingId } = req.query;

    console.log('Deleting query with tracking ID:', trackingId);

    // Validate required parameter
    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: trackingId is required'
      });
    }

    // Find and delete the referral document
    const deletedReferral = await ReferralProperty.findOneAndDelete({
      tracking_code: trackingId
    });

    // Check if referral was found and deleted
    if (!deletedReferral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found with the provided tracking ID'
      });
    }

    // Log the deletion for audit purposes
    console.log(`Query deleted successfully: ${trackingId}`, {
      deletedAt: new Date(),
      referrerName: deletedReferral.referrer.full_name,
      refereeName: deletedReferral.referee.full_name
    });

    // Return success response with deleted referral info
    return res.status(200).json({
      success: true,
      message: 'Query deleted successfully',
      data: {
        tracking_code: deletedReferral.tracking_code,
        referrer_name: deletedReferral.referrer.full_name,
        referee_name: deletedReferral.referee.full_name,
        deleted_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error deleting query:', error);

    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking ID format'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting query',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Email to referrer
async function sendReferrerConfirmationEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: 'Property Referral Confirmation - Tracking Code Inside',
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
    `
  };

  return transporter.sendMail(mailOptions);
}

// Email to referee
async function sendRefereeIntroductionEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referee.email,
    subject: 'Property Search Application Submitted for You',
    html: `
      <h2>Property Search Application</h2>
      <p>Dear ${referralData.referee.full_name},</p>
      <p>${referralData.referrer.full_name} has submitted a property search application on your behalf.</p>
      
      <h3>About Our Company</h3>
      <p>We are a leading property dealer with years of experience in helping clients find their dream properties. Our team of expert agents will assist you in finding the perfect property that matches your requirements.</p>
      
      <p><strong>Your Requirements:</strong></p>
      <ul>
        <li>Urgency: ${referralData.query_details.urgency_level}</li>
        ${referralData.property.area ? `<li>Preferred Area: ${referralData.property.area}</li>` : ''}
        ${referralData.query_details.special_requirements ? `<li>Special Requirements: ${referralData.query_details.special_requirements}</li>` : ''}
      </ul>
      
      <p>One of our agents will contact you soon via ${referralData.referee.preferred_contact} during ${referralData.referee.best_time_contact}.</p>
      
      <p>Best regards,<br>Your Property Team</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Send to Salesforce (placeholder - implement based on your Salesforce setup)
async function sendToSalesforce(referralData) {
  try {
    // This is a placeholder - implement based on your Salesforce API
    const salesforceData = {
      tracking_code: referralData.tracking_code,
      referrer: referralData.referrer,
      referee: referralData.referee,
      property: referralData.property,
      query_details: referralData.query_details,
      created_at: referralData.created_at
    };

    // Example API call to Salesforce
    // const response = await axios.post('YOUR_SALESFORCE_ENDPOINT', salesforceData, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SALESFORCE_TOKEN}`,
    //     'Content-Type': 'application/json'
    //   }
    // });

    console.log('Lead sent to Salesforce:', salesforceData);
    return true;
  } catch (error) {
    console.error('Error sending to Salesforce:', error);
    throw error;
  }
}



// Send progress update email
async function sendProgressUpdateEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: `Referral Update - ${referralData.tracking_code}`,
    html: `
      <h2>Referral Progress Update</h2>
      <p>Dear ${referralData.referrer.full_name},</p>
      <p>Your referral (Tracking Code: <strong>${referralData.tracking_code}</strong>) has been updated.</p>
      
      <p><strong>Current Status:</strong> ${referralData.query_progress.status}</p>
      ${referralData.query_progress.assigned_agent ? `<p><strong>Assigned Agent:</strong> ${referralData.query_progress.assigned_agent}</p>` : ''}
      
      <p>We will continue to keep you updated on the progress.</p>
      
      <p>Best regards,<br>Your Property Team</p>
    `
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
          'query_progress.status': 'Deal Closed',
          'commission.amount': commissionAmount,
          'commission.percentage': commissionPercentage,
          'commission.deal_value': dealValue,
          'commission.status': 'Approved'
        }
      },
      { new: true }
    );

    // Send commission notification email
    await sendCommissionNotificationEmail(referral);

    return referral;
  } catch (error) {
    console.error('Error completing deal:', error);
    throw error;
  }
};

// Send commission notification email
async function sendCommissionNotificationEmail(referralData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: referralData.referrer.email,
    subject: 'Congratulations! Commission Ready for Collection',
    html: `
      <h2>🎉 Deal Completed Successfully!</h2>
      <p>Dear ${referralData.referrer.full_name},</p>
      <p>Great news! The deal for your referral has been successfully completed.</p>
      
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3>Commission Details:</h3>
        <p><strong>Commission Amount:</strong> ₹${referralData.commission.amount.toLocaleString()}</p>
        <p><strong>Deal Value:</strong> ₹${referralData.commission.deal_value.toLocaleString()}</p>
        <p><strong>Commission Rate:</strong> ${referralData.commission.percentage}%</p>
      </div>
      
      <p><strong>Please visit our office to collect your commission amount.</strong></p>
      <p>Bring a valid ID and mention your tracking code: <strong>${referralData.tracking_code}</strong></p>
      
      <p>Thank you for your referral!</p>
      <p>Best regards,<br>Your Property Team</p>
    `
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
  agentUpdate
};