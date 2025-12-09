const mongoose = require("mongoose");

const RentalYieldApproval = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // Property Financial Data
    propertyPrice: { type: Number, required: true },        
    annualRentalIncome: { type: Number, required: true },       
    serviceCharges: { type: Number, required: true },          
    additionalAnnualCosts: { type: Number, required: true },   

    // Calculated Fields
    netAnnualRent: { type: Number, required: true },           
    grossYield: { type: Number, required: true },               
    netROI: { type: Number, required: true },                   

    currency: { type: String, default: "AED" },
    agreedToContact: { type: Boolean, default: true },
    source: {
        type: String, 
        required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RentalYieldApprovalModel", RentalYieldApproval);
