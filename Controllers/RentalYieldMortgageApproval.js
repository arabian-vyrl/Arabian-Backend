const RentalYieldApproval = require("../Models/RentalYieldApprovalModel");

const createRentalYieldApproval = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const {
      fullName,
      email,
      phone,
      propertyPrice,
      annualRentalIncome,
      serviceCharges,
      additionalAnnualCosts,
      netAnnualRent,
      grossYield,
      netROI,
      currency,
      source,
    } = req.body;


    if (
      !fullName ||
      !email ||
      !phone ||
      !propertyPrice ||
      !annualRentalIncome ||
      !serviceCharges ||
      !additionalAnnualCosts ||
      !netAnnualRent ||
      !grossYield ||
      !netROI
    ) {
      console.error("Validation failed: missing required fields");
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const approval = new RentalYieldApproval({
      fullName,
      email,
      phone,
      propertyPrice,
      annualRentalIncome,
      serviceCharges,
      additionalAnnualCosts,
      netAnnualRent,
      grossYield,
      netROI,
      currency,
      source
    });

    await approval.save();

    res.status(201).json({
      success: true,
      message: "Rental yield approval request submitted successfully!",
      data: approval,
    });
  } catch (error) {
    console.error("Error saving rental yield approval:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

const getRentalYieldApprovals = async (req, res) => {
  try {
    const approvals = await RentalYieldApproval.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// DELETE rental yield approval by ID
const deleteRentalYieldApproval = async (req, res) => {
  try {
    const approval = await RentalYieldApproval.findByIdAndDelete(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Rental yield approval request not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Rental yield approval request deleted successfully.",
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
  createRentalYieldApproval,
  getRentalYieldApprovals,
  deleteRentalYieldApproval,
};
