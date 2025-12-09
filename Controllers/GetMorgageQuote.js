const MortgageQuote = require("../Models/MortgageQuoteModel");

const createMortgageQuote = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      requestMessage,
      propertyTitle,
      propertyLink,
      purchasePrice,
      downpaymentPercentage,
      downPayment,
      loanAmount,
      interestRate,
      loanDuration,
      monthlyPayment,
      amountRequiredUpfront,
      currency,
      landDeptFee,
      agencyFeeBase,
      agencyFee,
      trusteeFee,
      mortgageRegFee,
      bankArrangementFee,
      valuationFee,
      conveyancerFee,
      mortgagePurchaseCosts,
      source
    } = req.body;

    // Log incoming data for debugging
    console.log("Received mortgage quote request:", req.body);

    // Validate required fields
    const missingFields = [];
    
    if (!fullName) missingFields.push("fullName");
    if (!email) missingFields.push("email");
    if (!phone) missingFields.push("phone");
    if (!requestMessage) missingFields.push("requestMessage");
    if (!propertyTitle) missingFields.push("propertyTitle");
    if (!propertyLink) missingFields.push("propertyLink");
    if (purchasePrice === undefined || purchasePrice === null) missingFields.push("purchasePrice");
    if (downpaymentPercentage === undefined || downpaymentPercentage === null) missingFields.push("downpaymentPercentage");
    if (downPayment === undefined || downPayment === null) missingFields.push("downPayment");
    if (loanAmount === undefined || loanAmount === null) missingFields.push("loanAmount");
    if (interestRate === undefined || interestRate === null) missingFields.push("interestRate");
    if (loanDuration === undefined || loanDuration === null) missingFields.push("loanDuration");
    if (monthlyPayment === undefined || monthlyPayment === null) missingFields.push("monthlyPayment");
    if (amountRequiredUpfront === undefined || amountRequiredUpfront === null) missingFields.push("amountRequiredUpfront");
    if (!currency) missingFields.push("currency");
    if (landDeptFee === undefined || landDeptFee === null) missingFields.push("landDeptFee");
    if (agencyFeeBase === undefined || agencyFeeBase === null) missingFields.push("agencyFeeBase");
    if (agencyFee === undefined || agencyFee === null) missingFields.push("agencyFee");
    if (trusteeFee === undefined || trusteeFee === null) missingFields.push("trusteeFee");
    if (mortgageRegFee === undefined || mortgageRegFee === null) missingFields.push("mortgageRegFee");
    if (bankArrangementFee === undefined || bankArrangementFee === null) missingFields.push("bankArrangementFee");
    if (valuationFee === undefined || valuationFee === null) missingFields.push("valuationFee");
    if (mortgagePurchaseCosts === undefined || mortgagePurchaseCosts === null) missingFields.push("mortgagePurchaseCosts");

    if (missingFields.length > 0) {
      console.log("Missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields
      });
    }

    const quote = new MortgageQuote({
      fullName,
      email,
      phone,
      requestMessage,
      propertyTitle,
      propertyLink,
      purchasePrice: Number(purchasePrice),
      downpaymentPercentage: Number(downpaymentPercentage),
      downPayment: Number(downPayment),
      loanAmount: Number(loanAmount),
      interestRate: Number(interestRate),
      loanDuration: Number(loanDuration),
      monthlyPayment: Number(monthlyPayment),
      amountRequiredUpfront: Number(amountRequiredUpfront),
      currency,
      landDeptFee: Number(landDeptFee),
      agencyFeeBase: Number(agencyFeeBase),
      agencyFee: Number(agencyFee),
      trusteeFee: Number(trusteeFee),
      mortgageRegFee: Number(mortgageRegFee),
      bankArrangementFee: Number(bankArrangementFee),
      valuationFee: Number(valuationFee),
      conveyancerFee: conveyancerFee !== undefined && conveyancerFee !== null ? Number(conveyancerFee) : undefined,
      mortgagePurchaseCosts: Number(mortgagePurchaseCosts),
      source
    });

    await quote.save();

    console.log("Quote saved successfully:", quote._id);

    res.status(201).json({
      success: true,
      message: "Mortgage quote request submitted successfully!",
      data: quote,
    });
  } catch (error) {
    console.error("Error creating mortgage quote:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating mortgage quote.",
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

// GET all mortgage quote requests
const getMortgageQuotes = async (req, res) => {
  try {
    const quotes = await MortgageQuote.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: quotes,
    });

  } catch (error) {
    console.error("Error fetching mortgage quotes:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching mortgage quotes.",
      error: error.message,
    });
  }
};

// DELETE mortgage quote request by ID
const deleteMortgageQuote = async (req, res) => {
  try {
    const quote = await MortgageQuote.findByIdAndDelete(req.params.id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Mortgage quote not found.",
      });
    }

    console.log("Quote deleted successfully:", req.params.id);

    res.status(200).json({
      success: true,
      message: "Mortgage quote deleted successfully.",
    });

  } catch (error) {
    console.error("Error deleting mortgage quote:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting mortgage quote.",
      error: error.message,
    });
  }
};

module.exports = {
  createMortgageQuote,
  getMortgageQuotes,
  deleteMortgageQuote
};