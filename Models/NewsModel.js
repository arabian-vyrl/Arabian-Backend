// Models/NewsModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/* ---------- Content Item / Subsection / Section (same as Blog) ---------- */
const contentItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["paragraph", "bullet_point", "numbered_item"],
      required: true,
    },
    content: { type: String, required: true, trim: true },
    formatting: {
      type: String,
      enum: ["paragraph", "bullet", "numbered"],
      required: true,
    },
  },
  { _id: false }
);

const subsectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "subsection" },
    heading: { type: String, required: true, trim: true },
    level: { type: Number, default: 3 },
    content: [contentItemSchema],
  },
  { _id: false }
);

const sectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "section" },
    heading: { type: String, required: true, trim: true },
    level: { type: Number, enum: [2, 3], required: true },
    content: [contentItemSchema],
    subsections: [subsectionSchema],
  },
  { _id: false }
);

/* ---------- Cloudinary-friendly Image Schema (same as Blog) ---------- */
const imageSchema = new Schema(
  {
    // Core identifiers
    publicId: { type: String, trim: true }, // Cloudinary public_id
    url: { type: String, trim: true }, // secure URL
    path: { type: String, trim: true }, // alias for url (kept for compatibility)
    filename: { type: String, trim: true }, // legacy / alias for public_id

    // Extras (Cloudinary metadata)
    format: { type: String, trim: true },
    size: { type: Number }, // bytes
    width: { type: Number },
    height: { type: Number },
    folder: { type: String, trim: true },

    // Original upload info
    originalName: { type: String, trim: true },
    mimetype: { type: String, trim: true },
  },
  { _id: false }
);

// Require at least one of: publicId, url (path/filename kept if you want later)
imageSchema.pre("validate", function (next) {
  if (!this) return next();
  const hasId =
    (this.publicId && this.publicId.length) ||
    (this.url && this.url.length);
    // (this.path && this.path.length) ||
    // (this.filename && this.filename.length);

  if (!hasId) {
    return next(
      new mongoose.Error.ValidatorError({
        path: "image",
        message:
          "Image must include at least one of publicId, filename, url, or path.",
      })
    );
  }
  next();
});

/* ---------- Main News Schema (mirrors Blog) ---------- */
const newsSchema = new Schema(
  {
    originalId: { type: String },

    metadata: {
      title: {
        type: String,
        required: [true, "News title is required"],
        trim: true,
      },
      description: { type: String, trim: true },
      author: { type: String, trim: true },
      tags: [{ type: String, trim: true, lowercase: true }],
      category: { type: String, trim: true },
      slug: { type: String, sparse: true, lowercase: true, index: true },
    },

    content: {
      title: {
        type: String,
        required: [true, "Content title is required"],
        trim: true,
      },
      sections: [sectionSchema],
      wordCount: { type: Number, default: 0, min: 0 },
      readingTime: { type: Number, default: 0, min: 0 },
    },

    seo: {
      metaTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true },
      keywords: [{ type: String, trim: true, lowercase: true }],
    },

    author: {
      agentId: { type: String, required: [true, "Agent ID is required"] },
      agentName: {
        type: String,
        required: [true, "Agent name is required"],
        trim: true,
      },
      agentEmail: {
        type: String,
        required: [true, "Agent email is required"],
        trim: true,
        lowercase: true,
      },
      agentImage: { type: String, default: null, trim: true },
    },

    // Cover Image
    image: { type: imageSchema, default: null },

    // Body Images (optional, same shape as Blog)
    bodyImages: {
      image1: { type: imageSchema, default: null },
      image2: { type: imageSchema, default: null },
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ---------- Indexes ---------- */
newsSchema.index({ "author.agentId": 1 });
newsSchema.index({ status: 1 });

/* ---------- Virtual (same pattern as Blog: agentId string → Agent.agentId) ---------- */
newsSchema.virtual("agentDetails", {
  ref: "Agent",
  localField: "author.agentId", // string
  foreignField: "agentId", // ensure Agent model has agentId:String indexed
  justOne: true,
});

/* ---------- Unique Slug Helper (news- prefix) ---------- */
async function generateUniqueSlug(title, NewsModel, excludeId = null) {
  if (!title) {
    return `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { "metadata.slug": slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await NewsModel.findOne(query).lean();
    if (!exists) break;
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
}

/* ---------- Slug + Title Sync (same logic as Blog) ---------- */
newsSchema.pre("save", async function (next) {
  try {
    if (
      this.isNew ||
      !this.metadata.slug ||
      this.isModified("content.title") ||
      this.isModified("metadata.title")
    ) {
      const title = this.content.title || this.metadata.title || "news";
      this.metadata.slug = await generateUniqueSlug(
        title,
        this.constructor,
        this._id
      );
    }

    // Keep metadata.title and content.title in sync
    if (this.isModified("content.title") && this.content.title) {
      this.metadata.title = this.content.title;
    } else if (this.isModified("metadata.title") && this.metadata.title) {
      this.content.title = this.metadata.title;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* ---------- Statics / Methods (mirrors Blog) ---------- */
newsSchema.statics.findByAgent = function (agentId) {
  return this.find({ "author.agentId": agentId }).sort({ createdAt: -1 });
};

newsSchema.statics.findPublishedByAgent = function (agentId) {
  return this.find({ "author.agentId": agentId, isPublished: true }).sort({
    createdAt: -1,
  });
};

newsSchema.methods.publish = function () {
  this.isPublished = true;
  this.status = "published";
  if (!this.publishedAt) this.publishedAt = new Date();
  return this.save();
};

newsSchema.methods.unpublish = function () {
  this.isPublished = false;
  this.status = "draft";
  this.publishedAt = null;
  return this.save();
};

newsSchema.methods.getContentStats = function () {
  let bulletPoints = 0,
    paragraphs = 0,
    headings = 0;
  (this.content.sections || []).forEach((section) => {
    headings++;
    (section.content || []).forEach((it) => {
      if (it.type === "bullet_point") bulletPoints++;
      if (it.type === "paragraph") paragraphs++;
    });
    (section.subsections || []).forEach((ss) => {
      headings++;
      (ss.content || []).forEach((it) => {
        if (it.type === "bullet_point") bulletPoints++;
        if (it.type === "paragraph") paragraphs++;
      });
    });
  });
  return {
    wordCount: this.content.wordCount,
    readingTime: this.content.readingTime,
    headings,
    paragraphs,
    bulletPoints,
    sections: (this.content.sections || []).length,
  };
};

newsSchema.methods.updateSlug = async function (newTitle) {
  this.metadata.slug = await generateUniqueSlug(
    newTitle,
    this.constructor,
    this._id
  );
  return this.save();
};

/* ---------- Text Parser (same architecture as Blog parser) ---------- */
newsSchema.statics.parseTextToNewsStructure = function (textContent) {
  const lines = (textContent || "").split("\n").filter((line) => line.trim());

  let title = "";
  let metaTitle = "";
  let metaDescription = "";
  let author = "";
  let tags = [];
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("Meta title:")) {
      metaTitle = line.replace("Meta title:", "").trim();
      continue;
    }

    if (line.startsWith("Meta description:")) {
      metaDescription = line.replace("Meta description:", "").trim();
      continue;
    }

    if (line.startsWith("Tags:")) {
      const tagsString = line.replace("Tags:", "").trim();
      tags = tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => tag.toLowerCase());
      continue;
    }

    if (line.startsWith("[Author:")) {
      author = line.replace("[Author:", "").replace("]", "").trim();
      continue;
    }

    if (line.includes("(H1)")) {
      title = line.replace("(H1)", "").trim();
      continue;
    }

    if (line.includes("(H2)")) {
      if (currentSubsection && currentSection) {
        currentSection.subsections.push(currentSubsection);
        currentSubsection = null;
      }
      if (currentSection) sections.push(currentSection);
      const heading = line.replace("(H2)", "").trim();
      currentSection = {
        id: `id_${Math.random().toString(36).substr(2, 9)}`,
        type: "section",
        heading,
        level: 2,
        content: [],
        subsections: [],
      };
      continue;
    }

    if (line.includes("(H3)")) {
      if (currentSubsection && currentSection) {
        currentSection.subsections.push(currentSubsection);
        currentSubsection = null;
      }
      if (currentSection) sections.push(currentSection);
      const heading = line.replace("(H3)", "").trim();
      currentSection = {
        id: `id_${Math.random().toString(36).substr(2, 9)}`,
        type: "section",
        heading,
        level: 2,
        content: [],
        subsections: [],
      };
      continue;
    }

    // Bullets
    if (line.startsWith("●") || line.startsWith("•") || line.startsWith("-")) {
      const content = line
        .replace(/^[●•-]\s*/, "")
        .replace("(Bullet)", "")
        .trim();
      if (content) {
        const contentItem = {
          type: "bullet_point",
          content,
          formatting: "bullet",
        };
        if (currentSubsection) currentSubsection.content.push(contentItem);
        else if (currentSection) currentSection.content.push(contentItem);
      }
      continue;
    }

    // Paragraphs
    if (line.includes("(P)") || line.includes("(p)")) {
      const content = line.replace(/\(P\)/g, "").replace(/\(p\)/g, "").trim();
      if (content) {
        const contentItem = {
          type: "paragraph",
          content,
          formatting: "paragraph",
        };
        if (currentSubsection) currentSubsection.content.push(contentItem);
        else if (currentSection) currentSection.content.push(contentItem);
      }
      continue;
    }

    // Plain line under a current section
    if (line && !line.includes("(") && currentSection) {
      const contentItem = {
        type: "paragraph",
        content: line,
        formatting: "paragraph",
      };
      if (currentSubsection) currentSubsection.content.push(contentItem);
      else currentSection.content.push(contentItem);
    }
  }

  if (currentSubsection && currentSection)
    currentSection.subsections.push(currentSubsection);
  if (currentSection) sections.push(currentSection);

  let wordCount = 0;
  sections.forEach((section) => {
    (section.content || []).forEach(
      (item) => (wordCount += (item.content || "").split(" ").length)
    );
    (section.subsections || []).forEach((subsection) => {
      (subsection.content || []).forEach(
        (item) => (wordCount += (item.content || "").split(" ").length)
      );
    });
  });

  const slugBase = (title || metaTitle || "news")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    id: `id_${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      title: title || metaTitle,
      description: metaDescription,
      author,
      tags,
      category: "",
      slug: `${slugBase}-${Date.now()}`,
    },
    content: {
      title: title || metaTitle,
      sections,
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
    },
    seo: { metaTitle, metaDescription, keywords: tags.slice(0, 5) },
    status: "draft",
  };
};

module.exports = mongoose.models.News || mongoose.model("News", newsSchema);
