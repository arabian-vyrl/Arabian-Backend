const sharp = require("sharp");
const axios = require("axios");

/**
 * Fetches image from URL and compresses it into multiple sizes
 * Returns base64 strings stored directly in MongoDB
 */
const compressImageFromUrl = async (imageUrl) => {
  try {
    // Fetch image from Cloudinary (only once!)
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
    });

    const inputBuffer = Buffer.from(response.data);

    const thumbnail = await sharp(inputBuffer)
      .resize(140, 140, {
        fit: "cover",
        position: "attention", 
      })
      .webp({ quality: 90, smartSubsample: true, })
      .toBuffer();

    // console.log(`✅ Compressed sizes — thumbnail: ${thumbnail.length / 1024}KB`);

    return {
      thumbnail: `data:image/webp;base64,${thumbnail.toString("base64")}`,
      compressedAt: new Date(),
    };
  } catch (error) {
    console.error("❌ Image compression failed:", error.message);
    return null;
  }
};

module.exports = { compressImageFromUrl };