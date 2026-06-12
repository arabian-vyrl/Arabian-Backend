const MortgageQuote = require("../Models/MortgageQuoteModel");
const salesforceService = require("../services/SalesforceService");

const createMortgageQuote = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
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
      source,
    } = req.body;

    const missingFields = [];

    if (!firstName) missingFields.push("firstName");
    if (!lastName) missingFields.push("lastName");
    if (!email) missingFields.push("email");
    if (!phone) missingFields.push("phone");
    if (!requestMessage) missingFields.push("requestMessage");
    if (!propertyTitle) missingFields.push("propertyTitle");
    if (!propertyLink) missingFields.push("propertyLink");
    if (purchasePrice === undefined || purchasePrice === null)
      missingFields.push("purchasePrice");
    if (downpaymentPercentage === undefined || downpaymentPercentage === null)
      missingFields.push("downpaymentPercentage");
    if (downPayment === undefined || downPayment === null)
      missingFields.push("downPayment");
    if (loanAmount === undefined || loanAmount === null)
      missingFields.push("loanAmount");
    if (interestRate === undefined || interestRate === null)
      missingFields.push("interestRate");
    if (loanDuration === undefined || loanDuration === null)
      missingFields.push("loanDuration");
    if (monthlyPayment === undefined || monthlyPayment === null)
      missingFields.push("monthlyPayment");
    if (amountRequiredUpfront === undefined || amountRequiredUpfront === null)
      missingFields.push("amountRequiredUpfront");
    if (!currency) missingFields.push("currency");
    if (landDeptFee === undefined || landDeptFee === null)
      missingFields.push("landDeptFee");
    if (agencyFeeBase === undefined || agencyFeeBase === null)
      missingFields.push("agencyFeeBase");
    if (agencyFee === undefined || agencyFee === null)
      missingFields.push("agencyFee");
    if (trusteeFee === undefined || trusteeFee === null)
      missingFields.push("trusteeFee");
    if (mortgageRegFee === undefined || mortgageRegFee === null)
      missingFields.push("mortgageRegFee");
    if (bankArrangementFee === undefined || bankArrangementFee === null)
      missingFields.push("bankArrangementFee");
    if (valuationFee === undefined || valuationFee === null)
      missingFields.push("valuationFee");
    if (mortgagePurchaseCosts === undefined || mortgagePurchaseCosts === null)
      missingFields.push("mortgagePurchaseCosts");

    if (missingFields.length > 0) {
      // console.log("Missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields,
      });
    }
    const quote = new MortgageQuote({
      firstName,
      lastName,
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
      conveyancerFee:
        conveyancerFee !== undefined && conveyancerFee !== null
          ? Number(conveyancerFee)
          : undefined,
      mortgagePurchaseCosts: Number(mortgagePurchaseCosts),
      source,
    });

    await quote.save();
    res.status(201).json({
      success: true,
      message: "Mortgage quote request submitted successfully!",
      data: quote,
    });

    const salesforceData = {
      first_name: quote.firstName,
      last_name: quote.lastName,
      email: quote.email,
      tele_phone: quote.phone,


      // requestMessage: quote.requestMessage,
      // propertyTitle: quote.propertyTitle,
      // propertyLink: quote.propertyLink,
      // purchasePrice: quote.purchasePrice,
      // downpaymentPercentage: quote.downpaymentPercentage,
      // downPayment: quote.downPayment,
      // loanAmount: quote.loanAmount,
      // interestRate: quote.interestRate,
      // loanDuration: quote.loanDuration,
      // monthlyPayment: quote.monthlyPayment,
      // amountRequiredUpfront: quote.amountRequiredUpfront,
      // currency: quote.currency,
      // landDeptFee: quote.landDeptFee,
      // agencyFeeBase: quote.agencyFeeBase,
      // agencyFee: quote.agencyFee,
      // trusteeFee: quote.trusteeFee,
      // mortgageRegFee: quote.mortgageRegFee,
      // bankArrangementFee: quote.bankArrangementFee,
      // valuationFee: quote.valuationFee,
      // conveyancerFee: quote.conveyancerFee,
      // mortgagePurchaseCosts: quote.mortgagePurchaseCosts,

      comments: `
      Request Message: ${quote.requestMessage}
      Property Title: ${quote.propertyTitle}
      Property Link: ${quote.propertyLink}
      Purchase Price: ${quote.purchasePrice}
      Down Payment Percentage: ${quote.downpaymentPercentage}
      Down Payment: ${quote.downPayment}
      Loan Amount: ${quote.loanAmount}
      Interest Rate: ${quote.interestRate}
      Loan Duration: ${quote.loanDuration}
      Monthly Payment: ${quote.monthlyPayment}
      Amount Required Upfront: ${quote.amountRequiredUpfront}
      Currency: ${quote.currency}
      Land Department Fee: ${quote.landDeptFee}
      Agency Fee Base: ${quote.agencyFeeBase}
      Agency Fee: ${quote.agencyFee}
      Trustee Fee: ${quote.trusteeFee}
      Mortgage Registration Fee: ${quote.mortgageRegFee}
      Bank Arrangement Fee: ${quote.bankArrangementFee}
      Valuation Fee: ${quote.valuationFee}
      Conveyancer Fee: ${quote.conveyancerFee}
      Mortgage Purchase Costs: ${quote.mortgagePurchaseCosts}
      `,



      // source: quote.source,
      record_type: "Buyer Enquiry",
      record_type_api_name: "Residential_Buyer",
      lead_source: "Website",
      lead_channel: "Form",
      lead_source_contact: "Mortgage enquiry",
      leads_default_owner: "info@arabianestates.ae",

    };


    // console.log("Mortagege", salesforceData) 
    //     Payload
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

    salesforceService.syncWithRetry(MortgageQuote, quote._id, salesforceData);

  } catch (error) {
    console.error("Error creating mortgage quote:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating mortgage quote.",
      error: error.message,
      details: error.errors
        ? Object.keys(error.errors).map((key) => ({
          field: key,
          message: error.errors[key].message,
        }))
        : null,
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

    // console.log("Quote deleted successfully:", req.params.id);

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
  deleteMortgageQuote,
};
