const mongoose = require("mongoose");

const MortgageApprovalSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    propertyPrice: { type: Number, required: true },
    downPayment: { type: Number, required: true },
    downPaymentPercent: { type: Number, required: true },
    loanAmount: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    loanTermYears: { type: Number, required: true },
    monthlyRepayment: { type: Number, required: true },
    currency: { type: String, default: "AED" }, 
    agreedToContact: { type: Boolean, default: true },
    source: {
        type: String, 
        required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MortgageApproval", MortgageApprovalSchema);