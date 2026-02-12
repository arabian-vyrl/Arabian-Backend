// Models/DesignationCategoryModel.js
const mongoose = require("mongoose");

const designationCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      unique: true,
      default: () =>
        `CAT_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      required: true,
    },
    categoryName: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
    },
    designations: [
      {
        type: String,
        trim: true,
        lowercase: true, // Store in lowercase for easier matching
      },
    ],
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
designationCategorySchema.index({ categoryName: 1 });
designationCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model(
  "DesignationCategory",
  designationCategorySchema,
);
