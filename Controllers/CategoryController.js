// Controllers/DesignationCategoryController.js
const DesignationCategory = require("../Models/CategoryModel");

const normalizeDesignations = (designations) => {
  if (!Array.isArray(designations)) return [];

  return designations
    .map((d) => {
      // if already correct
      if (d && typeof d === "object" && "name" in d) {
        const name = String(d.name || "").trim().toLowerCase();
        if (!name) return null;
        return { name, showRera: d.showRera !== undefined ? !!d.showRera : true };
      }

      // old string format
      if (typeof d === "string") {
        const name = d.trim().toLowerCase();
        if (!name) return null;
        return { name, showRera: true };
      }

      // corrupted format like { "0":"m","1":"a",...,"showRera":true }
      if (d && typeof d === "object" && !("name" in d)) {
        const maybeName = Object.keys(d)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => d[k])
          .join("");

        const name = String(maybeName || "").trim().toLowerCase();
        if (!name) return null;

        return { name, showRera: d.showRera !== undefined ? !!d.showRera : true };
      }

      return null;
    })
    .filter(Boolean);
};
// Get all categories
const getCategories = async (req, res) => {
  try {
    const { activeOnly = "true" } = req.query;
    const query = activeOnly === "true" ? { isActive: true } : {};

    const categories = await DesignationCategory.find(query).sort({
      displayOrder: 1,
      categoryName: 1,
    });

    // ✅ Always return object format
    const normalized = categories.map((c) => {
      const obj = c.toObject();
      return {
        ...obj,
        designations: normalizeDesignations(obj.designations),
      };
    });

    return res.status(200).json({
      success: true,
      data: normalized,
      total: normalized.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { categoryName, designations = [], displayOrder } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({
        success: false,
        error: "Category name is required",
      });
    }

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
      designations: normalizeDesignations(designations), // ✅ updated
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
      updateFields.designations = normalizeDesignations(designations); // ✅ updated
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
