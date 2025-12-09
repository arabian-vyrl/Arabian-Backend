const MortgageApproval = require("../Models/MortgageApprovalModel");

// CREATE mortgage approval request
const createMortgageApproval = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      propertyPrice,
      downPayment,
      downPaymentPercent,
      loanAmount,
      interestRate,
      loanTermYears,
      monthlyRepayment,
      agreedToContact,
      source
    } = req.body;

    // Validation
    if (
      !fullName ||
      !email ||
      !phone ||
      !propertyPrice ||
      !downPayment ||
      !downPaymentPercent ||
      !loanAmount ||
      !interestRate ||
      !loanTermYears ||
      !monthlyRepayment ||
      !source
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const approval = new MortgageApproval({
      fullName,
      email,
      phone,
      propertyPrice,
      downPayment,
      downPaymentPercent,
      loanAmount,
      interestRate,
      loanTermYears,
      monthlyRepayment,
      agreedToContact,
      source
    });

    await approval.save();

    res.status(201).json({
      success: true,
      message: "Mortgage approval request submitted successfully!",
      data: approval,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

// GET all approvals
const getMortgageApprovals = async (req, res) => {
  try {
    const approvals = await MortgageApproval.find().sort({ createdAt: -1 });

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

// DELETE approval by ID
const deleteMortgageApproval = async (req, res) => {
  try {
    const approval = await MortgageApproval.findByIdAndDelete(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Mortgage approval request not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mortgage approval request deleted successfully.",
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
  createMortgageApproval,
  getMortgageApprovals,
  deleteMortgageApproval,
};