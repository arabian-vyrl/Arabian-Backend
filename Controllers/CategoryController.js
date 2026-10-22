// Controllers/DesignationCategoryController.js
const DesignationCategory = require("../Models/CategoryModel");
const Agent = require("../Models/AgentModel");

const normalizeDesignations = (designations) => {
  if (!Array.isArray(designations)) return [];

  return designations
    .map((d) => {
      // if already correct
      if (d && typeof d === "object" && "name" in d) {
        const name = String(d.name || "").trim();
        if (!name) return null;
        return { name, showRera: d.showRera !== undefined ? !!d.showRera : true };
      }

      // old string format
      if (typeof d === "string") {
        const name = d.trim();
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

        const name = String(maybeName || "").trim();
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

    let newDesignations;
    if (designations !== undefined) {
      newDesignations = normalizeDesignations(designations); // ✅ updated
      updateFields.designations = newDesignations;
    }

    if (displayOrder !== undefined) {
      updateFields.displayOrder = displayOrder;
    }

    if (isActive !== undefined) {
      updateFields.isActive = isActive;
    }

    // Capture old designation names (by position) before overwriting,
    // so renames can be propagated to agents currently using them.
    let renames = [];
    if (newDesignations !== undefined) {
      const existingCategory = await DesignationCategory.findOne({ categoryId });
      if (existingCategory) {
        const oldDesignations = existingCategory.designations || [];
        renames = oldDesignations
          .map((oldD, i) => {
            const newD = newDesignations[i];
            if (!newD) return null;
            if (!oldD.name || oldD.name === newD.name) return null;
            return { oldName: oldD.name, newName: newD.name };
          })
          .filter(Boolean);
      }
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

    // Propagate renamed designations to agents currently assigned to them
    // (case-insensitive match against the old name), so agent profiles stay in sync.
    if (renames.length > 0) {
      await Promise.all(
        renames.map(({ oldName, newName }) =>
          Agent.updateMany(
            { designation: new RegExp(`^${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
            { $set: { designation: newName } },
          ),
        ),
      );
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
