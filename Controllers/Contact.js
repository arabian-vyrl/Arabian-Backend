// const Contact = require("../Models/ContactModel");
// const axios = require("axios");

// // Helper function to get Salesforce token
// const getSalesforceToken = async () => {
//   try {
//     const SALESFORCE = {
//       tokenUrl: process.env.SALESFORCE_TOKEN_URL,
//       clientId: process.env.SALESFORCE_CLIENT_ID,
//       clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
//       username: process.env.SALESFORCE_USERNAME,
//       password: process.env.SALESFORCE_PASSWORD,
//     };

//     const resp = await axios.post(SALESFORCE.tokenUrl, null, {
//       params: {
//         grant_type: "client_credentials",
//         client_id: SALESFORCE.clientId,
//         client_secret: SALESFORCE.clientSecret,
//         username: SALESFORCE.username,
//         password: SALESFORCE.password,
//       },
//     });

//     console.log("✓ Salesforce token retrieved");
//     return resp.data.access_token;
//   } catch (error) {
//     console.error("❌ Failed to get Salesforce token:", error.message);
//     throw error;
//   }
// };

// // Send To Salesforce Data - FIXED: Now accepts contactData parameter
// const sendToSalesforce = async (contactData) => {
//   try {
//     const token = await getSalesforceToken();
//     console.log("This is the Salesforce token:", token);

//     // Use actual contact data, not hardcoded test data
//     const salesforceData = {
//       firstName: contactData.firstName,
//       last_name: contactData.last_name,
//       email: contactData.email,
//       tele_phone: contactData.tele_phone,
//       message: contactData.message,
//       source: contactData.source,
//     };

//     console.log("📤 Sending data to Salesforce:", salesforceData);

//     const response = await axios.post(
//       "https://arabianestates.my.salesforce.com/services/apexrest/websiteleads",
//       salesforceData,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("✓ Successfully sent to Salesforce:", response.data);
//     return response.data;
//   } catch (error) {
//     console.error("❌ Error sending to Salesforce:", error.response?.data || error.message);
//     throw error;
//   }
// };

// const createContact = async (req, res) => {
//   try {
//     const { firstName, last_name, email, tele_phone, message, source } = req.body;

//     // Basic validation
//     if (!firstName || !last_name || !email || !tele_phone || !message || !source) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required.",
//       });
//     }

//     // Email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid email format.",
//       });
//     }

//     // Create contact in database
//     const contact = new Contact({
//       firstName,
//       last_name,
//       email,
//       tele_phone,
//       message,
//       source,
//     });

//     await contact.save();
//     console.log("✓ Contact saved to database:", contact._id);

//     // FIXED: Pass the contact data AND add error handling
//     sendToSalesforce(contact)
//       .then((sfResponse) => {
//         console.log("✓ Successfully synced with Salesforce");
//         // Update contact with Salesforce ID if returned
//         if (sfResponse && (sfResponse.id || sfResponse.Id)) {
//           Contact.findByIdAndUpdate(contact._id, {
//             salesforceId: sfResponse.id || sfResponse.Id,
//             salesforceSynced: true,
//             salesforceSyncedAt: new Date(),
//           }).catch((err) => console.error("Error updating Salesforce ID:", err));
//         }
//       })
//       .catch((error) => {
//         console.error("✗ Failed to sync with Salesforce:", error.message);
//         // Mark as failed sync for retry later
//         Contact.findByIdAndUpdate(contact._id, {
//           salesforceSynced: false,
//           salesforceError: error.message,
//           salesforceLastAttempt: new Date(),
//         }).catch((err) => console.error("Error marking sync failed:", err));
//       });

//     res.status(201).json({
//       success: true,
//       message: "Message sent successfully!",
//       data: contact,
//     });
//   } catch (error) {
//     console.error("❌ Error creating contact:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error.",
//       error: error.message,
//     });
//   }
// };

// // GET all contact messages
// const getContacts = async (req, res) => {
//   try {
//     const contacts = await Contact.find().sort({ createdAt: -1 });
//     res.status(200).json({ success: true, data: contacts });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error.",
//       error: error.message,
//     });
//   }
// };

// // DELETE a contact message by ID
// const deleteContact = async (req, res) => {
//   try {
//     const contact = await Contact.findByIdAndDelete(req.query.id);
//     if (!contact) {
//       return res.status(404).json({
//         success: false,
//         message: "Contact not found.",
//       });
//     }
//     res.status(200).json({
//       success: true,
//       message: "Contact deleted successfully.",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error.",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   createContact,
//   getContacts,
//   deleteContact,
// };



// controllers/ContactController.js

const Contact = require("../Models/ContactModel");
const salesforceService = require("../services/SalesforceService");

const createContact = async (req, res) => {
  try {
    const { firstName, lastName, email, telephone, message, source } = req.body;
    console.log(req.body)
    // Validation
    if (!firstName || !lastName || !email || !telephone || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

    // Save to database (salesforceSynced defaults to false)
    const contact = new Contact({
      firstName,
      lastName,
      email,
      telephone,
      message,
      source: source,
    });

    await contact.save();
    console.log("✓ Contact saved to database:", contact._id);

     res.status(201).json({
      success: true,
      message: "Message sent successfully!",
      data: contact,
    });

    const salesforceData = {
      firstName: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      tele_phone: contact.telephone,
      message: contact.message,
      source: contact.source,
    };
    salesforceService.syncWithRetry(Contact, contact._id, salesforceData);
    
  } catch (error) {
    console.error("❌ Error creating contact:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.query.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Contact deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

module.exports = {
  createContact,
  getContacts,
  deleteContact,
};