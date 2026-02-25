const mongoose = require("mongoose");
const DesignationCategory = require("/Arabian Estate Backend 2/Models/CategoryModel.js");
 // adjust path

const normalizeDesignations = (designations) => {
  if (!Array.isArray(designations)) return [];

  return designations
    .map((d) => {
      if (d == null) return null;

      // ✅ old string
      if (typeof d === "string") {
        const name = d.trim().toLowerCase();
        if (!name) return null;
        return { name, showRera: true };
      }

      // ✅ new correct object
      if (d && typeof d === "object" && typeof d.name === "string") {
        const name = d.name.trim().toLowerCase();
        if (!name) return null;
        return { name, showRera: d.showRera !== undefined ? !!d.showRera : true };
      }

      // ✅ corrupted object: { "0":"m","1":"a", ... , showRera:true }
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

(async () => {
  try {
    await mongoose.connect('mongodb+srv://sqb:sqb@vyrl-db.i9ez5.mongodb.net/');

    const categories = await DesignationCategory.find({});
    let updatedCount = 0;

    for (const cat of categories) {
      const normalized = normalizeDesignations(cat.designations);

      // only write if changed structure
      const needsUpdate =
        cat.designations.some((d) => typeof d === "string") ||
        cat.designations.some((d) => d && typeof d === "object" && !d.name);

      if (needsUpdate) {
        cat.designations = normalized;
        await cat.save();
        updatedCount++;
      }
    }

    console.log(`✅ Migration done. Updated categories: ${updatedCount}`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  }
})();