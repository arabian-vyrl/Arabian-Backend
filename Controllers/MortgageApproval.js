const MortgageApproval = require("../Models/MortgageApprovalModel");
const salesforceService = require("../services/SalesforceService");
// CREATE mortgage approval request
const createMortgageApproval = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
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
      !firstName ||  
      !lastName ||
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
      firstName,
      lastName,
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

  const salesforceData = {
  first_name: approval.firstName,
  last_name: approval.lastName,
  email: approval.email,
  tele_phone: approval.phone,
  propertyPrice: approval.propertyPrice,
  downPayment: approval.downPayment,
  downPaymentPercent: approval.downPaymentPercent,
  loanAmount: approval.loanAmount,
  interestRate: approval.interestRate,
  loanTermYears: approval.loanTermYears,
  monthlyRepayment: approval.monthlyRepayment,
  agreedToContact: approval.agreedToContact,
  source: approval.source,
  record_type: "Buyer Enquiry",
  lead_source: "Website",
  lead_channel: "Form",
  lead_source_contact: "Mortgage enquiry",
  default_owner: "info@arabianestates.ae",
};
    salesforceService.syncWithRetry(MortgageApproval, approval._id, salesforceData);
  
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

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