const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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

// Require at least one of: publicId, filename, url, path
imageSchema.pre("validate", function (next) {
  if (!this) return next();
  const hasId =
    (this.publicId && this.publicId.length) ||
    (this.url && this.url.length)
    // (this.path && this.path.length);

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



const podcastSchema = new mongoose.Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
    },
     metaDescription: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Podcast title is required"],
      trim: true,
      // maxlength: [200, "Podcast title cannot exceed 200 characters"],
    },
    shortDescription: {
      type: String,
      // required: [true, "Short description is required"],
      trim: true,
      // maxlength: [300, "Short description cannot exceed 300 characters"],
    },
    detailedDescription: {
      type: String,
      // required: [true, "Detailed description is required"],
      trim: true,
      // maxlength: [5000, "Detailed description cannot exceed 5000 characters"],
    },
    // Legacy description field (keeping for backward compatibility)
    description: {
      type: String,
      trim: true,
      // maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    // coverPhoto: {
    //   type: String,
    //   required: [true, "Cover photo URL is required"],
    //   trim: true,
    // },

    coverPhoto: {
    type: imageSchema,
     required: [true, "Cover photo is required"],
    },

    youtubeUrl: {
      type: String,
      required: [true, "YouTube URL is required"],
      trim: true,
    },
    category: {
      type: String,
      // required: [true, "Category is required"],
      trim: true,
      default: "General",
    },
    tags: {
      type: [String],
    },
    orderNumber: {
      type: Number,
      required: [true, "Order number is required"],
      min: [1, "Order number must be at least 1"],
      unique: true,
      index: true,
    },
    createdDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    whatsInside: {
      type: [String],
      // required: [true, "At least one point for what's inside is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
podcastSchema.index({
  title: "text",
  shortDescription: "text",
  detailedDescription: "text",
  tags: "text",
});
podcastSchema.index({ category: 1 });
podcastSchema.index({ createdDate: -1 });

// Middleware
podcastSchema.pre("save", function (next) {
  this.lastUpdated = new Date();

  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.map((tag) => tag.trim().toLowerCase()))];
  }

  // Clean up whatsInside points
  if (this.whatsInside && this.whatsInside.length > 0) {
    this.whatsInside = this.whatsInside
      .map((point) => point.trim())
      .filter((point) => point.length > 0);
  }

  // Set legacy description to shortDescription if not provided
  if (!this.description && this.shortDescription) {
    this.description = this.shortDescription;
  }

  next();
});

podcastSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

module.exports = mongoose.model("Podcast", podcastSchema);
