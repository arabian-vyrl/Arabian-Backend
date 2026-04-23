// // Near the top with other requires
// require("./Config/redis.js"); // Initialize Redis connection
// require("dotenv").config();
// const { setupCronJobs } = require("./Controllers/LeaderboardController.js");
// const { schedulePropertySync } = require("./Controllers/XmlParser.js");
// const {
//   scheduleNewOffPlanSync,
// } = require("./Controllers/NewOffplanController.js");
// const express = require("express");
// const app = express();
// const cors = require("cors");
// const path = require("path");
// const fs = require("fs"); // ← ADD THIS MISSING IMPORT
// const ConnectDb = require("./Database/Db");
// const multer = require("multer");
// const router = require("./Router/Routes");
// const cloudinary = require("cloudinary").v2;
// const { CloudinaryStorage } = require("multer-storage-cloudinary");
// const cookieParser = require("cookie-parser");

// // Set up middlewares
// app.set("trust proxy", 1);
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "http://localhost:5175",
//       "https://arabiann.netlify.app",
//     ],
//     credentials: true,
//   }),
// );

// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Serve uploaded files statically
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });
// // const agentStorage = new CloudinaryStorage({
// //   cloudinary,
// //   params: async (req, file) => ({
// //     folder: "agent-images",
// //     resource_type: "image",

// //     // ✅ keep original format & bytes (NO compression on upload)
// //     // do NOT add: transformation, quality, fetch_format, format

// //     // optional:
// //     // use_filename: true,
// //     // unique_filename: true,
// //     // overwrite: false,
// //   }),
// // });
// const agentStorage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => ({
//     folder: "agent-images",
//     resource_type: "image",
//     transformation: [
//       { quality: "auto", fetch_format: "auto" },  // Auto quality and format (JPEG, WebP, etc.)
//       { width: 4000, height: 3800, crop: "limit" }  // Limit the image to 800px width/height (adjust as needed)
//     ],
//   }),
// });

// // ---- Multer setup ----

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const uploadPath = path.join(__dirname, "uploads");

//     // Create directory if it doesn't exist
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }

//     cb(null, uploadPath);
//   },
//   filename: function (req, file, cb) {
//     const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, unique + "-" + file.originalname);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   ddd;
//   if (file.mimetype.startsWith("image/")) cb(null, true);
//   else cb(new Error("Only image files are allowed!"), false);
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 15 * 1024 * 1024 },
// });

// // Agents with salesforce sync cron job (CRON JOBS)
// // setupCronJobs();
// // schedulePropertySync();
// // scheduleNewOffPlanSync();

// // Then mount your API routes
// app.use("/", router);

// // Start DB and server
// ConnectDb()
//   .then(() => {
//     const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
//     app.listen(PORT, () => {
//       console.log(`Server is running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.log("DB connection failed:", err);
//   });

// // Export upload middleware for use in routes
// module.exports.upload = upload;
// // module.exports.agentUpload = agentUpload;

// module.exports.cloudinary = cloudinary;

require("dotenv").config();
// Near the top with other requires
require("./Utils/Logger"); // Capture console logs in file
require("./Config/redis.js"); // Initialize Redis connection
const { setupCronJobs } = require("./Controllers/LeaderboardController.js");
const { schedulePropertySync } = require("./Controllers/XmlParser.js");
const {
  scheduleNewOffPlanSync,
} = require("./Controllers/NewOffplanController.js");
const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const fs = require("fs"); // ← ADD THIS MISSING IMPORT
const ConnectDb = require("./Database/Db");
const multer = require("multer");
const router = require("./Router/Routes");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cookieParser = require("cookie-parser");
const axios=require('axios')
const mongoose = require("mongoose");

// Set up middlewares
app.set("trust proxy", true);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://arabiann.netlify.app",
      "https://arabianestates.ae", 
      "https://arabian-com.netlify.app"
    ],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// CloudinaryStorage setup for uploads (no change needed for upload)
const agentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "agent-images",
    resource_type: "image",
    transformation: [
      { quality: "auto", fetch_format: "auto" }, // Auto quality and format (JPEG, WebP, etc.)
      { width: 4000, height: 3800, crop: "limit" }, // Limit the image to 800px width/height (adjust as needed)
    ],
  }),
});

// ---- Multer setup ----
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed!"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Agents with salesforce sync cron job (CRON JOBS)

setupCronJobs();
schedulePropertySync();
scheduleNewOffPlanSync();


// Then mount your API routes

app.use("/", router);

// Google Reviews 
app.get("/get-google-reviews", async (req, res) => {
  const PLACE_ID=process.env.GOOGLE_PLACE_ID
  const GOOGLE_API_KEY=process.env.GOOGLE_MAP_API
  try {
    // console.log(PLACE_ID, GOOGLE_API_KEY);
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?placeid=${PLACE_ID}&fields=review&key=${GOOGLE_API_KEY}`;
    // console.log(url);
    const response = await axios.get(url);
    const reviews = response.data.result?.reviews || [];
    res.json(reviews);
  } catch (err) {
    console.error("Error fetching Google reviews:", err);
    res.status(500).json({ error: "Error fetching reviews" });
  }
});

// Start DB and server
ConnectDb()
  .then(() => {
    const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("DB connection failed:", err);
  });

// Export upload middleware for use in routes
module.exports.upload = upload;
module.exports.cloudinary = cloudinary;

// --------------------
// On-the-fly Image Transformation Logic
// --------------------

// app.get("/image/:imageName", (req, res) => {
//   const { imageName } = req.params;
//   console.log(imageName, "Image name");

//   // Here we expect the `imageName` to be the Cloudinary image public ID, not the full URL.
//   // If it's the full URL, extract just the Cloudinary public ID/path
//   const imageUrlPath = imageName.split('/').slice(-1)[0]; // Get only the image name (public ID)

//   // Regex to match the version number
//   const regex = /\/v(\d+)\//;

//   // Extract version number using regex
//   const match = imageName.match(regex);
//   console.log(match, "match");

//   if (match && match[1]) {
//     const versionNumber = match[1];
//     // Log extracted version number
//     console.log("Extracted version number:", versionNumber); // Output: 1769144286

//     // Generate the transformed Cloudinary URL with the extracted version number and image path

//     // AgentImage Url
//     const transformedUrl = `https://res.cloudinary.com/dviizglsy/image/upload/w_1200,h_1200,c_limit,q_auto,f_auto/v${versionNumber}/agent-images/${imageUrlPath}`;

//     // Send the transformed URL as a response
//     res.json({ imageUrl: transformedUrl });
//   } else {
//     console.log("Version number not found");
//     res.status(400).json({ error: "Version number not found in the image URL" });
//   }
// });
