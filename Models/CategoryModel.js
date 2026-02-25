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

    // ✅ UPDATED: designations now store objects with showRera flag
    designations: [
      {
        name: {
          type: String,
          trim: true,
          lowercase: true,
          required: true,
        },
        showRera: {
          type: Boolean,
          default: true,
        },
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
  { timestamps: true },
);

designationCategorySchema.index({ categoryName: 1 });
designationCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model(
  "DesignationCategory",
  designationCategorySchema,
);
