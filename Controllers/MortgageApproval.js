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
      source,
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
      source,
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

      // property_price: approval.propertyPrice,
      // downpayment: approval.downPayment,
      // downpayment_percent: approval.downPaymentPercent,
      // loan_amount: approval.loanAmount,
      // interest_rate: approval.interestRate,
      // loan_term_years: approval.loanTermYears,
      // monthly_repayment: approval.monthlyRepayment,
      // agreed_to_contact: approval.agreedToContact,

      comments: `
      Property Price: ${approval.propertyPrice}, 
      Down Payment: ${approval.downPayment}, 
      Down Payment Percent: ${approval.downPaymentPercent}, 
      Loan Amount: ${approval.loanAmount}, 
      Interest Rate: ${approval.interestRate}, 
      Loan Term (Years): ${approval.loanTermYears}, 
      Monthly Repayment: ${approval.monthlyRepayment}, 
      Agreed To Contact: ${approval.agreedToContact}`,

      record_type: "Buyer Enquiry",
      record_type_api_name: " Residential_Buyer",
      lead_source: "Website",
      lead_channel: "Form",
      lead_source_contact: "Mortgage enquiry",
      leads_default_owner: "info@arabianestates.ae",
    };



    console.log("Mortgage Approval", salesforceData)

    // Payload
// {
//   "first_name": "sathyatest123",
//   "last_name": "sathyatest123",
//   "email": "dotts12june@gmail.com",
//   "tele_phone": "67545516890",
//   "listing_id": "",
//   "property_address": "dubai",
//   "preferred_date": "12/06/2026",
//   "preferred_time": "12.06.2026",
//   "comments": "sathyatestlead without listing",
//   "Tracking_code": "  ",
//   "recordtypeId": " ",
//   "lead_source_contact": " ",
//   "record_type": "General",
//    "lead_source": "Website",
//    "lead_channel": "Call",
//    "message": " "
// }




    salesforceService.syncWithRetry(MortgageApproval, approval._id, salesforceData,);
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
