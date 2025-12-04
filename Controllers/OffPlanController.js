const OffPlanContact = require("../Models/OffPlanContact");

// CREATE a new off-plan contact message
const createOffPlanContact = async (req, res) => {
  try {
    const { fullName, email, mobile, projectName, budgetRange, source } = req.body;

    // Basic validation
    if (!fullName || !email || !mobile || !projectName) {
      return res
        .status(400)
        .json({ success: false, message: "Full Name, Email, Mobile, and Project Name are required." });
    }

    const contact = new OffPlanContact({
      fullName,
      email,
      mobile,
      projectName,
      budgetRange,
      source
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: "Off-plan contact submitted successfully!",
      data: contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message
    });
  }
};

// GET all off-plan contacts
const getOffPlanContacts = async (req, res) => {
  try {
    const contacts = await OffPlanContact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

const deleteOffPlanContact = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await OffPlanContact.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact not found."
      });
    }
    res.json({
      success: true,
      message: "Contact deleted successfully."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  createOffPlanContact,
  getOffPlanContacts,
  deleteOffPlanContact
};
