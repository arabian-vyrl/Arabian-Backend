const Contact = require("../Models/ContactModel");
const salesforceService = require("../services/SalesforceService");

const createContact = async (req, res) => {
  try {
    const { firstName, lastName, email, telephone, message, source } = req.body;
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

    res.status(201).json({
      success: true,
      message: "Message sent successfully!",
      data: contact,
    });

    const salesforceData = {
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email,
      phone: contact.telephone,
      message: contact.message,

      record_type: "General",
      record_type_api_name: "General",
      lead_source: "Website",
      lead_channel: "Form",
      lead_source_contact: "Contact form",
      leads_default_owner: "info@arabianestates.ae",
      
      source: "Website",
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