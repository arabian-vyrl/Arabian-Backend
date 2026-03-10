const HeroContent = require("../Models/HeroContent");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Get Transformed Video and Image URL

const extractCloudinaryInfo = (url) => {
  if (!url) return { publicId: null, version: null, extension: null };

  const versionMatch = url.match(/\/upload\/v(\d+)\//);
  const version = versionMatch ? versionMatch[1] : null;

  const publicIdMatch = url.match(
    /\/upload\/v\d+\/(.+)\.(jpg|png|webp|jpeg|mp4)$/,
  );
  const publicId = publicIdMatch ? publicIdMatch[1] : null;
  const extension = publicIdMatch ? publicIdMatch[2] : null;

  return { publicId, version, extension };
};

const generateTransformedVideoUrl = (videoPath, version) => {
  return `https://res.cloudinary.com/dviizglsy/video/upload/f_auto,q_auto,h_1080/${videoPath}`;
};

const generateTransformedImageUrl = (imagePath, version, extension = "jpg") => {
  return `https://res.cloudinary.com/dviizglsy/image/upload/w_1000,h_1000,c_limit,q_auto,f_auto/v${version}/${imagePath}.${extension}`;
};

// ---------- Cloudinary Multer Storage (handles both image & video) ----------
const HERO_ALLOWED_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "ogg",
  "mov",
];
const heroFileFilter = (_req, file, cb) => {
  const mime = file.mimetype || "";
  if (mime.startsWith("image/") || mime.startsWith("video/"))
    return cb(null, true);
  cb(
    new Error(
      "Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, OGG, MOV) are allowed.",
    ),
    false,
  );
};
const heroStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const isVideo = (file.mimetype || "").startsWith("video/");
    const base =
      (file.originalname || "hero-media")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^\w]+/g, "-")
        .slice(0, 50) || "hero-media";

    const public_id = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}`;

    const common = {
      folder: "hero",
      public_id,
      allowed_formats: HERO_ALLOWED_EXT,
      overwrite: false,
      resource_type: isVideo ? "video" : "image",
    };

    if (!isVideo) {
      return {
        ...common,
        transformation: [{ quality: "auto:good", fetch_format: "auto" }],
      };
    }
    return common;
  },
});
// Single multer instance — fields: "image" and "video"
const upload = multer({
  storage: heroStorage,
  fileFilter: heroFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, //50 MB
});
// ---------- Helpers ----------

const buildMediaData = (file) => {
  if (!file) return null;
  const isVideo = (file.mimetype || "").startsWith("video/");
  return {
    url: file.path, // Cloudinary secure_url
    publicId: file.filename, // Cloudinary public_id
    resourceType: isVideo ? "video" : "image",
  };
};

const destroyMedia = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    // console.log(`🗑️ Cloudinary destroyed: ${publicId}`);
  } catch (e) {
    console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
  }
};

const getOrCreateHero = async () => {
  let hero = await HeroContent.findOne();
  if (!hero) hero = await HeroContent.create({});
  return hero;
};

// ---------- CONTROLLERS ----------

/** GET /hero — fetch current hero content */
const getHero = async (_req, res) => {
  try {
    const hero = await HeroContent.findOne();

    if (!hero) {
      return res.status(200).json({
        success: true,
        data: { image: null, video: null },
      });
    }

    let transformedImage = null;
    let transformedVideo = null;

    if (hero.image?.url) {
      const { publicId, version } = extractCloudinaryInfo(hero.image.url);

      transformedImage = {
        ...hero.image._doc,
        url: generateTransformedImageUrl(publicId, version),
      };
    }
    if (hero.video?.publicId) {
      transformedVideo = {
        ...hero.video._doc,
        url: generateTransformedVideoUrl(hero.video.publicId),
      };
    }
    const transformedHero = {
      ...hero._doc,
      image: transformedImage,
      video: transformedVideo,
    };

    res.status(200).json({
      success: true,
      data: transformedHero,
    });

  } catch (error) {
    console.error("❌ getHero:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * POST /hero/upload
 * Accepts multipart fields: image (file), video (file), altText (string)
 * Both fields are optional — only the fields that are sent get updated.
 */
const uploadHero = async (req, res) => {
  try {
    const imageFile = req.files?.image?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;

    if (!imageFile && !videoFile) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded. Send at least one: 'image' or 'video'.",
      });
    }

    const hero = await getOrCreateHero();
    const altText = req.body.altText || "Hero media";

    // Handle image
    if (imageFile) {
      if (hero.image?.publicId) {
        await destroyMedia(hero.image.publicId, "image");
      }
      const data = buildMediaData(imageFile);
      hero.image = { ...data, altText: req.body.imageAltText || altText };
    }

    // Handle video
    if (videoFile) {
      if (hero.video?.publicId) {
        await destroyMedia(hero.video.publicId, "video");
      }
      const data = buildMediaData(videoFile);
      hero.video = { ...data, altText: req.body.videoAltText || altText };
    }

    await hero.save();

    const uploaded = [imageFile && "image", videoFile && "video"]
      .filter(Boolean)
      .join(" and ");
    res.status(200).json({
      success: true,
      message: `Hero ${uploaded} updated successfully.`,
      data: hero,
    });
  } catch (error) {
    console.error("❌ uploadHero:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /hero/update
 * Same as upload — accepts image, video, altText fields.
 * Also allows updating altText only (no file required).
 */
const updateHero = async (req, res) => {
  try {
    const hero = await HeroContent.findOne();
    if (!hero) {
      return res
        .status(404)
        .json({ success: false, message: "No hero content found to update." });
    }

    const imageFile = req.files?.image?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;

    // Update image if new file provided
    if (imageFile) {
      if (hero.image?.publicId)
        await destroyMedia(hero.image.publicId, "image");
      const data = buildMediaData(imageFile);
      hero.image = {
        ...data,
        altText:
          req.body.imageAltText ||
          req.body.altText ||
          hero.image?.altText ||
          "Hero media",
      };
    } else if (req.body.imageAltText && hero.image) {
      // Only alt text update for image
      hero.image.altText = req.body.imageAltText;
    }

    // Update video if new file provided
    if (videoFile) {
      if (hero.video?.publicId)
        await destroyMedia(hero.video.publicId, "video");
      const data = buildMediaData(videoFile);
      hero.video = {
        ...data,
        altText:
          req.body.videoAltText ||
          req.body.altText ||
          hero.video?.altText ||
          "Hero media",
      };
    } else if (req.body.videoAltText && hero.video) {
      // Only alt text update for video
      hero.video.altText = req.body.videoAltText;
    }

    await hero.save();
    res.status(200).json({
      success: true,
      message: "Hero content updated successfully.",
      data: hero,
    });
  } catch (error) {
    console.error("❌ updateHero:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /hero/image — remove only the hero image */
const deleteHeroImage = async (req, res) => {
  try {
    const hero = await HeroContent.findOne();
    if (!hero?.image) {
      return res
        .status(404)
        .json({ success: false, message: "No hero image to delete." });
    }
    await destroyMedia(hero.image.publicId, "image");
    hero.image = null;
    await hero.save();
    res
      .status(200)
      .json({ success: true, message: "Hero image deleted.", data: hero });
  } catch (error) {
    console.error("❌ deleteHeroImage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /hero/video — remove only the hero video */
const deleteHeroVideo = async (req, res) => {
  try {
    const hero = await HeroContent.findOne();
    if (!hero?.video) {
      return res
        .status(404)
        .json({ success: false, message: "No hero video to delete." });
    }
    await destroyMedia(hero.video.publicId, "video");
    hero.video = null;
    await hero.save();
    res
      .status(200)
      .json({ success: true, message: "Hero video deleted.", data: hero });
  } catch (error) {
    console.error("❌ deleteHeroVideo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  upload,
  getHero,
  uploadHero,
  updateHero,
  deleteHeroImage,
  deleteHeroVideo,
};
