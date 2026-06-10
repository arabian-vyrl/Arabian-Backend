const PropertyListModel = require("../Models/PropertyListModel");
const salesforceService = require("../services/SalesforceService");

const createPropertyListForm = async (req, res) => {
  console.log(req.body);
  try {
    const {
      firstName,
      lastName,
      telephone,
      email,
      // preferredDate,
      // preferredTime,
      address,
    } = req.body;

    if (!firstName || !lastName || !telephone || !email) {
      return res.status(400).json({
        success: false,
        message: "First Name, Last Name, Phone, and email are required.",
      });
    }
    const propertyList = new PropertyListModel({
      firstName,
      lastName,
      telephone,
      email,
      // preferredDate,
      // preferredTime,
      address,
    });

    console.log("This is the propertyList", propertyList);
    await propertyList.save();

    res.status(201).json({
      success: true,
      message: "Property list request submitted successfully!",
      data: propertyList,
    });

    const salesforceData = {
      first_name: propertyList.firstName,
      last_name: propertyList.lastName,
      phone: propertyList.telephone,
      email: propertyList.email,
      address: propertyList.address,
      
      record_type: "Seller Enquiry",
      record_type_api_name: "Residential_Seller",
      lead_source: "Website",
      lead_channel: "Form",
      lead_source_contact: "Request to List",
      leads_default_owner: "info@arabianestates.ae",
     
    };
    salesforceService.syncWithRetry(PropertyListModel, propertyList._id, salesforceData);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const getPropertyListsForm = async (req, res) => {
  try {
    const propertyLists = await PropertyListModel.find().sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: propertyLists });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const getPropertyListFormById = async (req, res) => {
  try {
    const propertyList = await PropertyListModel.findById(req.params.id);
    if (!propertyList) {
      return res.status(404).json({
        success: false,
        message: "Property list request not found.",
      });
    }
    res.status(200).json({ success: true, data: propertyList });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const deletePropertyListForm = async (req, res) => {
  try {
    const propertyList = await PropertyListModel.findByIdAndDelete(
      req.params.id
    );
    if (!propertyList) {
      return res.status(404).json({
        success: false,
        message: "Property list request not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Property list deleted successfully.",
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
  createPropertyListForm,
  getPropertyListsForm,
  getPropertyListFormById,
  deletePropertyListForm,
};
