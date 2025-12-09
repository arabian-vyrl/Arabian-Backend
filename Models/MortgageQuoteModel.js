const mongoose = require("mongoose");

const MortgageQuoteSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    requestMessage: {
      type: String,
      required: true,
    },
    propertyTitle: {
      type: String,
      required: true,
    },
    propertyLink: {
      type: String,
      required: true,
    },

    // Mortgage details
    purchasePrice: {
      type: Number,
      required: true,
    },
    downpaymentPercentage: {
      type: Number,
      required: true,
    },
    downPayment: {
      type: Number,
      required: true,
    },
    amountRequiredUpfront: {
      type: Number,
      required: true,
    },
    monthlyPayment: {
      type: Number,
      required: true,
    },
    loanAmount: {
      type: Number,
      required: true,
    },
    interestRate: {
      type: Number,
      required: true,
    },
    loanDuration: {
      type: Number, 
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "AED",
    },

    // Additional cost breakdown fields
    landDeptFee: {
      type: Number,
      required: true,
    },
    agencyFeeBase: {
      type: Number,
      required: true,
    },
    agencyFee: {
      type: Number,
      required: true,
    },
    trusteeFee: {
      type: Number,
      required: true,
    },
    mortgageRegFee: {
      type: Number,
      required: true,
    },
    bankArrangementFee: {
      type: Number,
      required: true,
    },
    valuationFee: {
      type: Number,
      required: true,
    },
    conveyancerFee: {
      type: Number,
      required: true,
    },
    mortgagePurchaseCosts: {
      type: Number,
      required: true,
    },
    source: {
        type: String, 
        required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MortgageQuote", MortgageQuoteSchema);