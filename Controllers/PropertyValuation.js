const PropertyValuation = require("../Models/PropertyValuationModel");
const salesforceService = require("../services/SalesforceService");
// CREATE a new property valuation request
const createPropertyValuation = async (req, res) => {
  console.log("This is the request Data", req.body);
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      preferredDate,
      preferredTime,
      propertyAddress,

      // Step 1 Fields
     
      // Step 2 Fields


      // Optional

    } = req.body;

    if (!firstName || !lastName || !phone || !email ) {
      return res.status(400).json({
        success: false,
        message:
          "First Name, Last Name, Phone, Email are required.",
      });
    }

    const propertyValuation = new PropertyValuation({
      firstName,
      lastName,
      phone,
      email,
      preferredDate,
      preferredTime,
      propertyAddress,
      // currentStep: currentStep || 1,
    });

    await propertyValuation.save();
    res.status(201).json({
      success: true,
      message: "Property valuation request submitted successfully!",
      data: propertyValuation,
    });

    const salesforceData = {
      first_name: propertyValuation.firstName,
      last_name: propertyValuation.lastName,
      phone: propertyValuation.phone,
      email: propertyValuation.email,
      address: propertyValuation.propertyAddress,
      preferred_date: propertyValuation.preferredDate, 
      preferred_time: propertyValuation.preferredTime,
      
      Record_type: "Seller Enquiry",
      record_type_api_name: "Residential_Seller",
      Lead_source: "Website",
      Lead_channel: "Form",
      lead_source_contact: "Valuation request",
      leads_default_owner: "info@arabianestates.ae",
     };

    salesforceService.syncWithRetry(
      PropertyValuation,
      propertyValuation._id,
      salesforceData
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};


const getPropertyValuations = async (req, res) => {
  try {
    const propertyValuations = await PropertyValuation.find().sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: propertyValuations });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// GET single property valuation by ID
const getPropertyValuationById = async (req, res) => {
  try {
    const propertyValuation = await PropertyValuation.findById(req.params.id);
    if (!propertyValuation) {
      return res.status(404).json({
        success: false,
        message: "Property valuation request not found.",
      });
    }
    res.status(200).json({ success: true, data: propertyValuation });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// UPDATE a property valuation by ID
const updatePropertyValuation = async (req, res) => {
  try {
    const propertyValuation = await PropertyValuation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!propertyValuation) {
      return res.status(404).json({
        success: false,
        message: "Property valuation request not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Property valuation updated successfully.",
      data: propertyValuation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// DELETE a property valuation by ID
const deletePropertyValuation = async (req, res) => {
  try {
    const propertyValuation = await PropertyValuation.findByIdAndDelete(
      req.params.id
    );
    if (!propertyValuation) {
      return res.status(404).json({
        success: false,
        message: "Property valuation request not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Property valuation deleted successfully.",
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
  createPropertyValuation,
  getPropertyValuations,
  getPropertyValuationById,
  updatePropertyValuation,
  deletePropertyValuation,
};
