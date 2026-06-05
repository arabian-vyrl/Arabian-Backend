const OffPlanContact = require("../Models/OffPlanContact");
const salesforceService = require("../services/SalesforceService");
// CREATE a new off-plan contact message
// const createOffPlanContact = async (req, res) => {
//   try {
//     const { firstName,lastName, email, mobile, projectName, budgetRange, source } =
//       req.body;

//       console.log(firstName,lastName, email, mobile, projectName, budgetRange, source);

//     // Basic validation
//     if (!firstName || !email || !mobile || !projectName) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message: "Full Name, Email, Mobile, and Project Name are required.",
//         });
//     }

//     const contact = new OffPlanContact({
//       firstName,
//       lastName,
//       email,
//       mobile,
//       projectName,
//       budgetRange,
//       source,
//     });
//     console.log(contact,"CC");
//     await contact.save();

//     res.status(201).json({
//       success: true,
//       message: "Off-plan contact submitted successfully!",
//       data: contact,
//     });


//     // const salesforceData = {
//     //   // first_name: contact.firstName,
//     //   last_name: contact.lastName,
//     //   email: contact.email,
//     //   tele_phone: contact.mobile,
//     //   projectName: contact.projectName,
//     //   budgetRange: contact.budgetRange,
//     //   source: contact.source,
//     // };

//     // salesforceService.syncWithRetry(OffPlanContact, contact._id, salesforceData);
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error.",
//       error: error.message,
//     });
//   }
// };


const createOffPlanContact = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      projectName,
      budgetRange,
      source,
    } = req.body;

    console.log("BODY:", req.body);

    if (!firstName || !email || !mobile || !projectName) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const contact = new OffPlanContact({
      firstName,
      lastName,
      email,
      mobile,
      projectName,
      budgetRange,
      source,
    });

    console.log("CONTACT:", contact);

    await contact.save();

    // ✅ SAFE SALESFORCE CALL
    try {
      const salesforceData = {
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        tele_phone: contact.mobile,
        projectName: contact.projectName,
        budgetRange: contact.budgetRange,
        source: contact.source,
        record_type: "Off Plan enquiry",
        lead_source: "Website",
        lead_channel: "form",
        lead_source_contact: "Off Plan Form",
        default_owner: "info@arabianestates.ae",
      };

      await salesforceService.syncWithRetry(
        OffPlanContact,
        contact._id,
        salesforceData
      );
    } catch (sfError) {
      console.error("Salesforce error:", sfError.message);
    }

    // ✅ SEND RESPONSE LAST
    return res.status(201).json({
      success: true,
      message: "Saved successfully",
      data: contact,
    });

  } catch (error) {
    console.error("FINAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET all off-plan contacts
const getOffPlanContacts = async (req, res) => {
  try {
    const contacts = await OffPlanContact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

const deleteOffPlanContact = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await OffPlanContact.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }
    res.json({
      success: true,
      message: "Contact deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



// Get Similar Properties
const OffPlanSimilarProperties = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await OffPlanContact.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }
    res.json({
      success: true,
      message: "Contact deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createOffPlanContact,
  getOffPlanContacts,
  deleteOffPlanContact,
};
