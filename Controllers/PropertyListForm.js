const PropertyListModel = require("../Models/PropertyListModel");

const createPropertyListForm = async (req, res) => {

  console.log(req.body)
  try {
    const {
      firstName,
      lastName,
      phone,
      telephone,
      preferredDate,
      preferredTime,
      address,
    } = req.body;

    if (!firstName || !lastName || !phone || !telephone) {
      return res.status(400).json({
        success: false,
        message: "First Name, Last Name, Phone, and Telephone are required."
      });
    }
    const propertyList = new PropertyListModel({
      firstName,
      lastName,
      phone,
      telephone,
      preferredDate,
      preferredTime,
      address
    });

    console.log("This is the propertyList", propertyList)
    await propertyList.save();

    res.status(201).json({
      success: true,
      message: "Property list request submitted successfully!",
      data: propertyList
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message
    });
  }
};

const getPropertyListsForm = async (req, res) => {
  try {
    const propertyLists = await PropertyListModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: propertyLists });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
};

const getPropertyListFormById = async (req, res) => {
  try {
    const propertyList = await PropertyListModel.findById(req.params.id);
    if (!propertyList) {
      return res.status(404).json({ 
        success: false, 
        message: "Property list request not found." 
      });
    }
    res.status(200).json({ success: true, data: propertyList });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
};

const deletePropertyListForm = async (req, res) => {
  try {
    const propertyList = await PropertyListModel.findByIdAndDelete(req.params.id);
    if (!propertyList) {
      return res.status(404).json({ 
        success: false, 
        message: "Property list request not found." 
      });
    }
    res.status(200).json({ 
      success: true, 
      message: "Property list deleted successfully." 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
};

module.exports = {
  createPropertyListForm,
  getPropertyListsForm,
  getPropertyListFormById,
  deletePropertyListForm,
};