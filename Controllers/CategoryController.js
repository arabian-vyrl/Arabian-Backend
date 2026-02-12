// Controllers/DesignationCategoryController.js
const DesignationCategory = require("../Models/CategoryModel");

// Get all categories
const getCategories = async (req, res) => {
  try {
    const { activeOnly = "true" } = req.query;
    const query = activeOnly === "true" ? { isActive: true } : {};

    const categories = await DesignationCategory.find(query).sort({
      displayOrder: 1,
      categoryName: 1,
    });

    return res.status(200).json({
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Create new category
const createCategory = async (req, res) => {
  try {
    const { categoryName, designations = [], displayOrder } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({
        success: false,
        error: "Category name is required",
      });
    }

    // Check if category already exists
    const existingCategory = await DesignationCategory.findOne({
      categoryName: categoryName.trim(),
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: "Category name already exists",
      });
    }

    const category = await DesignationCategory.create({
      categoryName: categoryName.trim(),
      designations: designations.map((d) => d.toLowerCase().trim()),
      displayOrder: displayOrder || 0,
    });

    return res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("Create category error:", err);

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const { categoryName, designations, displayOrder, isActive } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: "Category ID is required",
      });
    }

    const updateFields = {};

    if (categoryName !== undefined) {
      updateFields.categoryName = categoryName.trim();
    }

    if (designations !== undefined) {
      updateFields.designations = designations.map((d) =>
        d.toLowerCase().trim(),
      );
    }

    if (displayOrder !== undefined) {
      updateFields.displayOrder = displayOrder;
    }

    if (isActive !== undefined) {
      updateFields.isActive = isActive;
    }

    const category = await DesignationCategory.findOneAndUpdate(
      { categoryId },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    console.error("Update category error:", err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: "Category ID is required",
      });
    }

    const category = await DesignationCategory.findOneAndDelete({ categoryId });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
