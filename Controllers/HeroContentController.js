// // const HeroContent = require('../Models/HeroContent');
// // const multer = require('multer');
// // const path = require('path');
// // const fs = require('fs');

// // // Ensure upload directory exists
// // const uploadDir = path.join(__dirname, '../uploads/hero/');
// // if (!fs.existsSync(uploadDir)) {
// //   fs.mkdirSync(uploadDir, { recursive: true });
// //   console.log('✅ Created uploads/hero directory:', uploadDir);
// // }

// // // Configure multer for file uploads
// // const storage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     const uploadPath = path.join(__dirname, '../uploads/hero/');

// //     // Double-check directory exists
// //     if (!fs.existsSync(uploadPath)) {
// //       fs.mkdirSync(uploadPath, { recursive: true });
// //       console.log('✅ Created directory during upload:', uploadPath);
// //     }

// //     cb(null, uploadPath);
// //   },
// //   filename: (req, file, cb) => {
// //     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
// //     const filename = 'hero-' + uniqueSuffix + path.extname(file.originalname);
// //     console.log('📁 Saving file as:', filename);
// //     cb(null, filename);
// //   }
// // });

// // const fileFilter = (req, file, cb) => {
// //   const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
// //   const allowedVideoTypes = /mp4|webm|ogg/;
// //   const extname = path.extname(file.originalname).toLowerCase().replace('.', '');

// //   if (allowedImageTypes.test(extname) || allowedVideoTypes.test(extname)) {
// //     cb(null, true);
// //   } else {
// //     cb(new Error('Invalid file type. Only images (JPEG, JPG, PNG, GIF, WebP) and videos (MP4, WebM, OGG) are allowed.'));
// //   }
// // };

// // const upload = multer({
// //   storage: storage,
// //   fileFilter: fileFilter,
// //   limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
// // });

// // // Helper function to delete old media file
// // const deleteOldMedia = (mediaUrl) => {
// //   try {
// //     if (mediaUrl) {
// //       const cleanUrl = mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl;
// //       const filePath = path.join(__dirname, '..', cleanUrl);

// //       if (fs.existsSync(filePath)) {
// //         fs.unlinkSync(filePath);
// //         console.log('🗑️  Deleted old media:', filePath);
// //       } else {
// //         console.log('⚠️  Old media file not found:', filePath);
// //       }
// //     }
// //   } catch (error) {
// //     console.error('❌ Error deleting old media:', error);
// //   }
// // };

// // // Get current hero content
// // const getHero = async (req, res) => {
// //   try {
// //     console.log('📥 GET /get-hero - Fetching hero content...');
// //     const hero = await HeroContent.findOne();

// //     if (!hero) {
// //       console.log('⚠️  No hero content found');
// //       return res.status(404).json({
// //         success: false,
// //         message: 'No hero content found'
// //       });
// //     }

// //     console.log('✅ Hero content found:', hero.mediaType);
// //     res.status(200).json({ success: true, data: hero });
// //   } catch (error) {
// //     console.error('❌ Error fetching hero:', error);
// //     res.status(500).json({ success: false, message: error.message });
// //   }
// // };

// // // Add or Replace hero content
// // const addOrReplaceHero = async (req, res) => {
// //   try {
// //     console.log('📤 POST /add-replace - Starting upload...');
// //     console.log('📎 File received:', req.file ? req.file.filename : 'No file');
// //     console.log('📝 Body:', req.body);

// //     if (!req.file) {
// //       console.log('❌ No file uploaded');
// //       return res.status(400).json({
// //         success: false,
// //         message: 'No file uploaded'
// //       });
// //     }

// //     const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
// //     const mediaUrl = `/uploads/hero/${req.file.filename}`;

// //     console.log('📊 Media type:', mediaType);
// //     console.log('🔗 Media URL:', mediaUrl);
// //     console.log('💾 File saved to:', req.file.path);

// //     // Check if hero already exists
// //     const existingHero = await HeroContent.findOne();

// //     if (existingHero) {
// //       console.log('🔄 Replacing existing hero...');
// //       console.log('🗑️  Old hero type:', existingHero.mediaType);

// //       // Delete old media file
// //       deleteOldMedia(existingHero.mediaUrl);

// //       // Update existing hero
// //       existingHero.mediaUrl = mediaUrl;
// //       existingHero.mediaType = mediaType;
// //       existingHero.altText = req.body.altText || 'Hero media';
// //       await existingHero.save();

// //       console.log('✅ Hero replaced successfully');
// //       return res.status(200).json({
// //         success: true,
// //         message: `Hero content replaced to ${mediaType}`,
// //         data: existingHero
// //       });
// //     } else {
// //       console.log('➕ Creating new hero...');

// //       // Create new hero
// //       const newHero = await HeroContent.create({
// //         mediaUrl,
// //         mediaType,
// //         altText: req.body.altText || 'Hero media'
// //       });

// //       console.log('✅ Hero created successfully');
// //       return res.status(201).json({
// //         success: true,
// //         message: 'Hero content added successfully',
// //         data: newHero
// //       });
// //     }
// //   } catch (error) {
// //     console.error('❌ Error in addOrReplaceHero:', error);
// //     console.error('Stack:', error.stack);
// //     res.status(500).json({ success: false, message: error.message });
// //   }
// // };

// // // Update hero content (only altText or replace media)
// // const updateHero = async (req, res) => {
// //   try {
// //     console.log('🔄 PUT /update - Updating hero...');
// //     console.log('📎 File received:', req.file ? req.file.filename : 'No file');
// //     console.log('📝 Body:', req.body);

// //     const hero = await HeroContent.findOne();

// //     if (!hero) {
// //       console.log('❌ No hero content found to update');
// //       return res.status(404).json({
// //         success: false,
// //         message: 'No hero content found to update'
// //       });
// //     }

// //     if (req.file) {
// //       console.log('🔄 Replacing media file...');

// //       // Delete old media file
// //       deleteOldMedia(hero.mediaUrl);

// //       const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
// //       hero.mediaUrl = `/uploads/hero/${req.file.filename}`;
// //       hero.mediaType = mediaType;
// //       console.log('💾 New file saved to:', req.file.path);
// //     }

// //     // Update altText if provided
// //     if (req.body.altText) {
// //       console.log('📝 Updating alt text...');
// //       hero.altText = req.body.altText;
// //     }

// //     await hero.save();

// //     console.log('✅ Hero updated successfully');
// //     res.status(200).json({
// //       success: true,
// //       message: 'Hero content updated successfully',
// //       data: hero
// //     });
// //   } catch (error) {
// //     console.error('❌ Error in updateHero:', error);
// //     console.error('Stack:', error.stack);
// //     res.status(500).json({ success: false, message: error.message });
// //   }
// // };

// // module.exports = {
// //   getHero,
// //   addOrReplaceHero,
// //   updateHero,
// //   upload
// // };

// // controllers/HeroController.js
// // controllers/HeroController.js
// const HeroContent = require("../Models/HeroContent");
// const multer = require("multer");
// const cloudinary = require("cloudinary").v2;
// const { CloudinaryStorage } = require("multer-storage-cloudinary");

// // For cloudinary
// const extractVideoPath = (url) => {
//   const regex = /video\/upload\/(v\d+\/hero\/[a-zA-Z0-9\-]+\.mp4)/;
//   const match = url.match(regex);

//   // If match found, return the extracted path, else return null
//   return match ? match[1] : null;
// };

// // Helper function to generate transformed video URL
// const generateTransformedVideoUrl = (videoPath, version) => {
//   return `https://res.cloudinary.com/dviizglsy/video/upload/f_auto,q_auto,h_1080/${videoPath}`;
// };

// // Helper function to generate transformed image URL
// const generateTransformedImageUrl = (imagePath, version) => {
//   return `https://res.cloudinary.com/dviizglsy/image/upload/w_1000,h_1000,c_limit,q_auto,f_auto/v${version}/hero/${imagePath}`;
// };

// // ---------- Cloudinary Multer Storage for hero (image + video) ----------

// const HERO_ALLOWED_EXT = [
//   "jpg",
//   "jpeg",
//   "png",
//   "webp",
//   "gif",
//   "mp4",
//   "webm",
//   "ogg",
//   "mov",
// ];

// const heroFileFilter = (_req, file, cb) => {
//   const mimetype = file.mimetype || "";
//   if (mimetype.startsWith("image/") || mimetype.startsWith("video/")) {
//     return cb(null, true);
//   }
//   cb(
//     new Error(
//       "Invalid file type. Only images (JPEG, JPG, PNG, GIF, WebP) and videos (MP4, WebM, OGG, MOV) are allowed."
//     ),
//     false
//   );
// };

// // const heroStorage = new CloudinaryStorage({
// //   cloudinary,
// //   params: async (req, file) => {
// //     const folder = "hero";
// //     const isVideo = (file.mimetype || "").startsWith("video/");

// //     const base =
// //       (file.originalname || "hero-media")
// //         .toLowerCase()
// //         .replace(/\.[a-z0-9]+$/, "")
// //         .replace(/[^\w]+/g, "-")
// //         .slice(0, 50) || "hero-media";

// //     const public_id = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}`;

// //     const common = {
// //       folder,
// //       public_id,
// //       allowed_formats: HERO_ALLOWED_EXT,
// //       overwrite: false,
// //       resource_type: isVideo ? "video" : "image",
// //     };

// //     // Apply transformations only for images
// //     if (!isVideo) {
// //       return {
// //         ...common,
// //         transformation: [{ quality: "auto:good", fetch_format: "auto" }],
// //       };
// //     }

// //     return common;
// //   },
// // });

// const heroStorage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     const folder = "hero";
//     const isVideo = (file.mimetype || "").startsWith("video/");

//     const base =
//       (file.originalname || "hero-media")
//         .toLowerCase()
//         .replace(/\.[a-z0-9]+$/, "")
//         .replace(/[^\w]+/g, "-")
//         .slice(0, 50) || "hero-media";

//     const public_id = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}`;

//     const common = {
//       folder,
//       public_id,
//       allowed_formats: HERO_ALLOWED_EXT,
//       overwrite: false,
//       resource_type: isVideo ? "video" : "image",
//     };

//     // Apply transformations only for images
//     if (!isVideo) {
//       return {
//         ...common,
//         transformation: [{ quality: "auto:good", fetch_format: "auto" }],
//       };
//     }

//     return common;
//   },
// });

// // 👉 This is what your router will use: HeroController.upload.single("media")
// const upload = multer({
//   storage: heroStorage,
//   fileFilter: heroFileFilter,
//   limits: { fileSize: 100 * 1024 * 1024 }, // 50MB
// });

// // ---------- Helpers ----------

// // const createHeroMediaData = (file) => {
// //   if (!file) return null;
// //   const isVideo = (file.mimetype || "").startsWith("video/");

// //   return {
// //     url: file.path, // Cloudinary secure_url
// //     mediaType: isVideo ? "video" : "image",
// //     publicId: file.filename, // Cloudinary public_id
// //     resourceType: file.resource_type || (isVideo ? "video" : "image"),
// //   };
// // };
// // Helper function to create media data
// const createHeroMediaData = (file) => {
//   if (!file) return null;
//   const isVideo = (file.mimetype || "").startsWith("video/");

//   return {
//     url: file.path, // Cloudinary secure_url
//     mediaType: isVideo ? "video" : "image",
//     publicId: file.filename, // Cloudinary public_id
//     resourceType: file.resource_type || (isVideo ? "video" : "image"),
//   };
// };

// // const destroyHeroMedia = async (publicId, resourceType = "image") => {
// //   if (!publicId) return;
// //   try {
// //     await cloudinary.uploader.destroy(publicId, {
// //       resource_type: resourceType,
// //       invalidate: true,
// //     });
// //     console.log(`🗑️ Cloudinary hero destroyed: ${publicId}`);
// //   } catch (e) {
// //     console.warn("⚠️ Cloudinary hero destroy failed:", publicId, e.message);
// //   }
// // };

// // ---------- CONTROLLERS ----------

// // Get current hero content
// // Helper function to delete old media from Cloudinary
// const destroyHeroMedia = async (publicId, resourceType = "image") => {
//   if (!publicId) return;
//   try {
//     await cloudinary.uploader.destroy(publicId, {
//       resource_type: resourceType,
//       invalidate: true,
//     });
//     console.log(`🗑️ Cloudinary hero destroyed: ${publicId}`);
//   } catch (e) {
//     console.warn("⚠️ Cloudinary hero destroy failed:", publicId, e.message);
//   }
// };

// // const getHero = async (_req, res) => {
// //   try {
// //     console.log("📥 GET /get-hero - Fetching hero content...");
// //     const hero = await HeroContent.findOne();

// //     if (!hero) {
// //       console.log("⚠️ No hero content found");
// //       return res.status(404).json({
// //         success: false,
// //         message: "No hero content found",
// //       });
// //     }

// //     res.status(200).json({
// //       success: true,
// //       data: hero,
// //     });
// //   } catch (error) {
// //     console.error("❌ Error fetching hero:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: error.message,
// //     });
// //   }
// // };

// const getHero = async (_req, res) => {
//   try {
//     console.log("📥 GET /get-hero - Fetching hero content...");
//     const hero = await HeroContent.findOne();

//     if (!hero) {
//       console.log("⚠️ No hero content found");
//       return res.status(404).json({
//         success: false,
//         message: "No hero content found",
//       });
//     }

//     // If it's a video, extract the path and transform the URL
//     if (hero.mediaType === "video") {
//       const videoPath = extractVideoPath(hero.mediaUrl); // Extracted part
//       if (videoPath) {
//         const version = videoPath.split('/')[0].replace('v', ''); // Extract version from videoPath
//         hero.mediaUrl = generateTransformedVideoUrl(videoPath, version);
//       }
//     } else if (hero.mediaType === "image") {
//       // For images, generate the transformed image URL
//       hero.mediaUrl = generateTransformedImageUrl(hero.publicId, hero.version);
//     }

//     res.status(200).json({
//       success: true,
//       data: hero,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching hero:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Add or Replace hero content (image or video)
// const addOrReplaceHero = async (req, res) => {
//   try {
//     console.log("📤 POST /add-replace - Starting upload...");
//     console.log("📎 File received:", req.file ? req.file.originalname : "No file");
//     console.log("📝 Body:", req.body);

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No file uploaded",
//       });
//     }

//     const mediaData = createHeroMediaData(req.file);
//     const altText = req.body.altText || "Hero media";

//     // Check if hero already exists
//     const existingHero = await HeroContent.findOne();

//     if (existingHero) {
//       console.log("🔄 Replacing existing hero...");

//       // Delete old media from Cloudinary
//       await destroyHeroMedia(
//         existingHero.publicId,
//         existingHero.mediaType === "video" ? "video" : "image"
//       );

//       existingHero.mediaUrl = mediaData.url;
//       existingHero.mediaType = mediaData.mediaType;
//       existingHero.publicId = mediaData.publicId;
//       existingHero.resourceType = mediaData.resourceType;
//       existingHero.altText = altText;

//       await existingHero.save();

//       return res.status(200).json({
//         success: true,
//         message: `Hero content replaced with new ${mediaData.mediaType}`,
//         data: existingHero,
//       });
//     }

//     console.log("➕ Creating new hero...");
//     const newHero = await HeroContent.create({
//       mediaUrl: mediaData.url,
//       mediaType: mediaData.mediaType,
//       publicId: mediaData.publicId,
//       resourceType: mediaData.resourceType,
//       altText,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Hero content added successfully",
//       data: newHero,
//     });
//   } catch (error) {
//     console.error("❌ Error in addOrReplaceHero:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Update hero (change media and/or altText)
// const updateHero = async (req, res) => {
//   try {
//     console.log("🔄 PUT /update - Updating hero...");
//     console.log("📎 File received:", req.file ? req.file.originalname : "No file");
//     console.log("📝 Body:", req.body);

//     const hero = await HeroContent.findOne();
//     if (!hero) {
//       return res.status(404).json({
//         success: false,
//         message: "No hero content found to update",
//       });
//     }

//     // If a new file is uploaded, replace Cloudinary asset
//     if (req.file) {
//       console.log("🔄 Replacing hero media on Cloudinary...");

//       await destroyHeroMedia(
//         hero.publicId,
//         hero.mediaType === "video" ? "video" : "image"
//       );

//       const mediaData = createHeroMediaData(req.file);

//       hero.mediaUrl = mediaData.url;
//       hero.mediaType = mediaData.mediaType;
//       hero.publicId = mediaData.publicId;
//       hero.resourceType = mediaData.resourceType;
//     }

//     // Update alt text if provided
//     if (req.body.altText) {
//       hero.altText = req.body.altText;
//     }

//     await hero.save();

//     res.status(200).json({
//       success: true,
//       message: "Hero content updated successfully",
//       data: hero,
//     });
//   } catch (error) {
//     console.error("❌ Error in updateHero:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// module.exports = {
//   upload,          // <-- IMPORTANT: this fixes HeroController.upload.single("media")
//   getHero,
//   addOrReplaceHero,
//   updateHero,
// };

const HeroContent = require("../Models/HeroContent");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Get Transformed Video and Image URL

const extractCloudinaryInfo = (url) => {
  if (!url) return { publicId: null, version: null };

  const versionMatch = url.match(/\/upload\/v(\d+)\//);
  const version = versionMatch ? versionMatch[1] : null;

  const publicIdMatch = url.match(
    /\/upload\/v\d+\/(.+)\.(jpg|png|webp|jpeg|mp4)$/,
  );
  const publicId = publicIdMatch ? publicIdMatch[1] : null;

  return { publicId, version };
};

const generateTransformedVideoUrl = (videoPath, version) => {
  return `https://res.cloudinary.com/dviizglsy/video/upload/f_auto,q_auto,h_1080/${videoPath}`;
};

const generateTransformedImageUrl = (imagePath, version) => {
  return `https://res.cloudinary.com/dviizglsy/image/upload/w_1000,h_1000,c_limit,q_auto,f_auto/v${version}/${imagePath}`;
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
    // Transform URLs

    const { publicId, version } = extractCloudinaryInfo(hero.image.url);

    const transformedHero = {
      ...hero._doc,
      image: hero.image ? generateTransformedImageUrl(publicId, version) : null,
      video: hero.video
        ? generateTransformedVideoUrl(hero.video.publicId)
        : null,
    };

    // console.log(transformedHero);

    res.status(200).json({
      success: true,
      data: transformedHero,
    });
  } catch (error) {
    console.error("❌ getHero:", error);
    res.status(500).json({ success: false, message: error.message });
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
