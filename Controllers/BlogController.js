const Blog = require("../Models/BlogsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
// Helper function to generate transformed image URL

const generateTransformedBlogImageUrl = (imagePath, version) => {
  return `https://res.cloudinary.com/dviizglsy/image/upload/w_1000,h_1000,c_limit,q_auto,f_auto/v${version}/blogs/${imagePath}`;
};

const generateTransformedAgentImageUrl = (imagePath, version) => {

  return `https://res.cloudinary.com/dviizglsy/image/upload/w_1000,h_1000,c_limit,q_auto,f_auto/v${version}/agent-images/${imagePath}`;

};




const stripHtmlTags = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};


function ensureFilename(img) {
  if (!img) return img;
  if (img.filename) return img;
  // try best-effort fallback
  const fromPublicId = img.publicId || img.public_id;
  if (fromPublicId) return { ...img, filename: fromPublicId };
  // last resort: derive from URL (public_id without extension)
  if (img.url) {
    const base = img.url.split("/").pop() || "";
    const noQuery = base.split("?")[0];
    const noExt = noQuery.replace(/\.[a-z0-9]+$/i, "");
    return { ...img, filename: noExt || "unknown" };
  }
  return { ...img, filename: "unknown" };
}
// ---------- Cloudinary Multer Storage (multi-field) ----------
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const fileFilter = (_req, file, cb) => {
  const ok = (file.mimetype || "").startsWith("image/");
  if (!ok) return cb(new Error("Only image files are allowed!"), false);
  cb(null, true);
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Put all blog images under this folder
    const folder = "blogs";
    // Create descriptive public_id: blogs/<ts>-<random>-<slugged-original>
    const base =
      (file.originalname || "image")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^\w]+/g, "-")
        .slice(0, 50) || "image";
    const public_id = `${Date.now()}-${Math.round(
      Math.random() * 1e6
    )}-${base}`;
    return {
      folder,
      public_id,
      allowed_formats: ALLOWED_EXT,
      resource_type: "image",
    };
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    fieldSize: 25 * 1024 * 1024,
    fields: 20,
    parts: 30
  },
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "bodyImage1", maxCount: 1 },
  { name: "bodyImage2", maxCount: 1 },
  { name: "bodyImage3", maxCount: 1 },
  { name: "bodyImage4", maxCount: 1 },
  { name: "bodyImage5", maxCount: 1 },
  { name: "bodyImage6", maxCount: 1 },
  { name: "bodyImage7", maxCount: 1 },
]);

// ---------- Helpers ----------
const createImageData = (file) => {
  if (!file) return null;
  return {
    url: file.path,
    publicId: file.filename,
    filename: file.filename,
    format: file.format,
    bytes: file.size,
    width: file.width,
    height: file.height,
    folder: file.folder,
    originalName: file.originalname,
    mimetype: file.mimetype,
  };
};

const destroyPublicId = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (e) {
    console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
  }
};


const createBlog = async (req, res) => {
  try {
    const {
      agentEmail,
      title,
      Description,
      metaTitle,
      metaDescription,
      tags,
      htmlContent,
      status,
    } = req.body;

    if (!agentEmail) return res.status(400).json({ success: false, message: "Agent Email is required" });
    if (!title || title.trim() === "") return res.status(400).json({ success: false, message: "Blog title is required" });
    if (!htmlContent || htmlContent.trim() === "") return res.status(400).json({ success: false, message: "Blog content is required" });


    const agent = await Agent.findOne({ email: agentEmail.toLowerCase() });
    if (!agent) return res.status(404).json({ success: false, message: "Agent not found with the provided email" });

    let tagsArray = [];
    if (tags) {
      if (typeof tags === "string") {
        try {
          tagsArray = JSON.parse(tags);
        } catch {
          tagsArray = tags.split(",").map(tag => tag.trim()).filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    const coverImageData = req.files?.coverImage?.[0] ? createImageData(req.files.coverImage[0]) : null;

    const bodyImages = [];
    for (let i = 1; i <= 7; i++) {
      const fieldName = `bodyImage${i}`;
      if (req.files?.[fieldName]?.[0]) {
        bodyImages.push(createImageData(req.files[fieldName][0]));
      }
    }
    const blogStatus = status === "published" ? "published" : "draft";
    const isPublished = blogStatus === "published";

    const newBlog = new Blog({
      author: {
        agentEmail: agent.email,
        agentName: agent.agentName,
        agentImage: {
          url: agent?.imageUrl || "",
        },
        agentSocialMedia: {
          instagram: agent?.instagram || "",
          linkedin: agent?.linkedin || "",
        },
      },
      title: title.trim(),
      description: Description.trim(),
      metaInfo: {
        metaTitle: metaTitle?.trim() || title.trim(),
        metaDescription: metaDescription?.trim() || "",
        tags: tagsArray,
      },
      coverImage: coverImageData,
      bodyImages,
      content: {
        htmlContent,
        plainText: stripHtmlTags(htmlContent),
      },
      status: blogStatus,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    });

    const savedBlog = await newBlog.save();

    await Agent.findByIdAndUpdate(
      agent._id,
      {
        $push: {
          blogs: {
            blogId: savedBlog._id,
            title: savedBlog.title,
            slug: savedBlog.slug || "",
            description: savedBlog.metaInfo?.metaDescription || savedBlog.Description || "",
            imageUrl: savedBlog.coverImage.url || null,
            isPublished: savedBlog.isPublished,
            publishedAt: savedBlog.publishedAt,
            createdAt: savedBlog.createdAt,
            updatedAt: savedBlog.updatedAt,
          },
        },
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: `Blog ${isPublished ? "published" : "saved as draft"} successfully`,
      savedBlog,
    });
  } catch (error) {
    console.error("BLOG CREATE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to create blog", error: error.message });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    // console.log("UPDATE REQUEST - ID:", id);
    // console.log("UPDATE REQUEST - BODY:", req.body);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required in URL parameters",
      });
    }

    const {
      agentEmail,
      title,
      Description,
      metaTitle,
      metaDescription,
      tags,
      htmlContent,
      status,
      publishedAt,
    } = req.body;

    // Find the blog
    const blog = await Blog.findById(id);
    if (!blog) {
      // console.log("BLOG NOT FOUND - ID:", id);
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // console.log("BLOG FOUND - Current title:", blog.title);

    let agentChanged = false;
    let oldAgentEmail = null;
    let newAgent = null;

    // Handle agent email change
    if (agentEmail) {
      const newAgentEmail = agentEmail.toLowerCase().trim();
      const currentAgentEmail = blog.author?.agentEmail?.toLowerCase();

      // Check if agent email is different
      if (currentAgentEmail !== newAgentEmail) {
        // console.log("AGENT EMAIL CHANGE DETECTED - from:", currentAgentEmail, "to:", newAgentEmail);

        // Find the new agent
        newAgent = await Agent.findOne({ email: newAgentEmail });
        if (!newAgent) {
          return res.status(404).json({
            success: false,
            message: "New agent not found with the provided email",
          });
        }

        // Store old agent email for cleanup
        oldAgentEmail = currentAgentEmail;
        agentChanged = true;

        // Update blog author information
        blog.author = {
          agentEmail: newAgent.email,
          agentName: newAgent.agentName,
          agentImage: {
            url: newAgent?.imageUrl || "",
          },
          agentSocialMedia: {
            instagram: newAgent?.instagram || "",
            linkedin: newAgent?.linkedin || "",
          },
        };
        blog.markModified("author");
        console.log("Updated blog author to new agent:", newAgentEmail);
      } else {
        // Same agent - still update social media links in case they changed
        const currentAgent = await Agent.findOne({ email: blog.author.agentEmail });
        if (currentAgent) {
          blog.author.agentSocialMedia = {
            instagram: currentAgent?.instagram || "",
            linkedin: currentAgent?.linkedin || "",
          };
          blog.author.agentImage = {
            url: currentAgent?.imageUrl || "",
          };
          blog.author.agentName = currentAgent.agentName;
          blog.markModified("author");
          console.log("Updated author social media links for same agent");
        }
      }
    }

    // Update basic fields
    if (title) {
      console.log("UPDATING title from:", blog.title, "to:", title.trim());
      blog.title = title.trim();
    }

    if (Description !== undefined) {
      blog.description = Description.trim();
    }

    if (metaTitle) {
      console.log("UPDATING metaTitle from:", blog.metaInfo?.metaTitle, "to:", metaTitle.trim());
      if (!blog.metaInfo) blog.metaInfo = {};
      blog.metaInfo.metaTitle = metaTitle.trim();
      blog.markModified("metaInfo");
    }

    if (metaDescription !== undefined) {
      console.log("UPDATING metaDescription");
      if (!blog.metaInfo) blog.metaInfo = {};
      blog.metaInfo.metaDescription = metaDescription.trim();
      blog.markModified("metaInfo");
    }

    // Update tags
    if (tags !== undefined) {
      let tagsArray = [];
      if (typeof tags === "string") {
        try {
          tagsArray = JSON.parse(tags);
        } catch (e) {
          tagsArray = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
      if (!blog.metaInfo) blog.metaInfo = {};
      blog.metaInfo.tags = tagsArray;
      blog.markModified("metaInfo");
    }

    // Update content
    if (htmlContent) {
      console.log("UPDATING htmlContent, length:", htmlContent.length);
      const plainText = stripHtmlTags(htmlContent);

      if (!blog.content) blog.content = {};
      blog.content.htmlContent = htmlContent;
      blog.content.plainText = plainText;
      blog.markModified("content");
      console.log("Content updated");
    }

    // Update cover image if new one is uploaded
    if (req.files?.coverImage?.[0]) {
      console.log("NEW COVER IMAGE UPLOADED");
      // Delete old image from Cloudinary if exists
      if (blog.coverImage?.publicId) {
        try {
          await destroyPublicId(blog.coverImage.publicId);
          console.log("Old cover image deleted from Cloudinary");
        } catch (err) {
          console.error("Error deleting old cover image:", err);
        }
      }
      blog.coverImage = createImageData(req.files.coverImage[0]);
    }

    // Update body images if new ones are uploaded
    for (let i = 1; i <= 7; i++) {
      const fieldName = `bodyImage${i}`;
      if (req.files?.[fieldName]?.[0]) {
        console.log(`NEW BODY IMAGE ${i} UPLOADED`);
        if (blog.bodyImages?.[i - 1]?.publicId) {
          try {
            await destroyPublicId(blog.bodyImages[i - 1].publicId);
            console.log(`Old body image ${i} deleted from Cloudinary`);
          } catch (err) {
            console.error(`Error deleting old body image ${i}:`, err);
          }
        }
        if (!blog.bodyImages) blog.bodyImages = [];
        blog.bodyImages[i - 1] = createImageData(req.files[fieldName][0]);
      }
    }

    if (status) {
      const blogStatus = status === "published" ? "published" : "draft";
      const wasPublished = blog.isPublished;

      blog.status = blogStatus;
      blog.isPublished = blogStatus === "published";

      // Handle publish date
      if (publishedAt) {
        blog.publishedAt = new Date(publishedAt);
      } else if (blogStatus === "published" && !wasPublished) {
        blog.publishedAt = new Date();
        console.log("First time publishing - setting publishedAt to now");
      } else if (blogStatus === "draft") {
        blog.publishedAt = null;
        console.log("Changed to draft - clearing publishedAt");
      }
      console.log(`Status updated: ${blogStatus}, isPublished: ${blog.isPublished}`);
    } else if (publishedAt) {
      blog.publishedAt = new Date(publishedAt);
      console.log("Updated publishedAt without status change:", blog.publishedAt);
    }

    const updatedBlog = await blog.save();
    console.log("BLOG SAVED SUCCESSFULLY");


    if (agentChanged && oldAgentEmail) {
      try {
        await Agent.findOneAndUpdate(
          { email: oldAgentEmail },
          { $pull: { blogs: { blogId: updatedBlog._id } } }
        );
        console.log("Removed blog from old agent:", oldAgentEmail);

        // Add blog to new agent's blogs array
        if (newAgent) {
          await Agent.findByIdAndUpdate(newAgent._id, {
            $push: {
              blogs: {
                blogId: updatedBlog._id,
                title: updatedBlog.title,
                slug: updatedBlog.slug || "",
                description: updatedBlog.metaInfo?.metaDescription || updatedBlog.description || "",
                imageUrl: updatedBlog.coverImage?.url || null,
                isPublished: updatedBlog.isPublished,
                publishedAt: updatedBlog.publishedAt,
                createdAt: updatedBlog.createdAt,
                updatedAt: updatedBlog.updatedAt,
              },
            },
          });
          console.log("Added blog to new agent:", newAgent.email);
        }
      } catch (err) {
        console.error("Error updating agent blogs array:", err);
      }
    } else if (agentEmail && blog.author?.agentEmail) {
      // If same agent, update the blog info in agent's blogs array
      try {
        await Agent.findOneAndUpdate(
          { email: blog.author.agentEmail, "blogs.blogId": updatedBlog._id },
          {
            $set: {
              "blogs.$.title": updatedBlog.title,
              "blogs.$.slug": updatedBlog.slug || "",
              "blogs.$.description": updatedBlog.metaInfo?.metaDescription || updatedBlog.description || "",
              "blogs.$.imageUrl": updatedBlog.coverImage?.url || null,
              "blogs.$.isPublished": updatedBlog.isPublished,
              "blogs.$.publishedAt": updatedBlog.publishedAt,
              "blogs.$.updatedAt": updatedBlog.updatedAt,
            },
          }
        );
        console.log("Updated blog info in agent's blogs array");
      } catch (err) {
        console.error("Error updating blog in agent's array:", err);
      }
    }
    console.log("BLOG UPDATED SUCCESSFULLY - New title:", updatedBlog.title);
    res.status(200).json({
      success: true,
      message: agentChanged
        ? "Blog updated and reassigned to new agent successfully"
        : "Blog updated successfully",
      data: {
        blog: updatedBlog,
        agentChanged,
      },
    });
  } catch (error) {
    console.error("UPDATE BLOG ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// const GetAllBlogs = async (req, res) => {
//   try {
//     const { isPublished, isViewing } = req.query;

//     const filter = {};
//     if (isPublished !== undefined) {
//       filter.isPublished = isPublished === "true";
//     }

//     let selectFields =
//       "_id title slug description coverImage metaInfo isPublished publishedAt author createdAt";
//     if (isViewing === "true") {
//       selectFields += " content";
//     }

//     const blogs = await Blog.find(filter)
//       .select(selectFields)
//       .populate(
//         "author",
//         "agentName email imageUrl designation"
//       )
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       totalBlogs: blogs.length,
//       data: blogs,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blogs",
//       error: error.message,
//     });
//   }
// };

const GetAllBlogs = async (req, res) => {
  try {
    const { isPublished, isViewing } = req.query;

    const filter = {};
    if (isPublished !== undefined) {
      filter.isPublished = isPublished === "true";
    }

    let selectFields =
      "_id title slug description coverImage metaInfo isPublished publishedAt author createdAt";
    if (isViewing === "true") {
      selectFields += " content";
    }

    const blogs = await Blog.find(filter)
      .select(selectFields)
      .populate("author", "agentName email imageUrl designation")
      .sort({ createdAt: -1 });

    // For each blog, apply transformation to the cover image
    const transformedBlogs = blogs.map(blog => {
      // Transform the cover image
      const coverImageUrl = blog.coverImage.url;

      if (coverImageUrl) {
        const versionRegex = /\/v(\d+)\//;
        const match = coverImageUrl.match(versionRegex);

        if (match && match[1]) {
          const versionNumber = match[1];
          const imagePath = coverImageUrl.split('/').slice(-1)[0];

          // Generate the transformed image URL for the cover image
          const transformedCoverImageUrl = generateTransformedBlogImageUrl(imagePath, versionNumber);
          blog.coverImage.url = transformedCoverImageUrl;  // Update the cover image URL
        }
      }

      // Transform the author image (agent image)
      const agentImageUrl = blog.author.agentImage.url;

      if (agentImageUrl) {
        const versionRegex = /\/v(\d+)\//;
        const match = agentImageUrl.match(versionRegex);

        if (match && match[1]) {
          const versionNumber = match[1];
          const imagePath = agentImageUrl.split('/').slice(-1)[0];

          // Generate the transformed image URL for the agent image
          const transformedAgentImageUrl = generateTransformedAgentImageUrl(imagePath, versionNumber);
          blog.author.agentImage.url = transformedAgentImageUrl;  // Update the agent image URL
        }
      }

      return blog;
    });

    res.status(200).json({
      success: true,
      totalBlogs: transformedBlogs.length,
      data: transformedBlogs,  // Return the blogs with transformed image URLs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};


// This is not being used
const getSingleBlog = async (req, res) => {
  try {
    // console.log("WORKING")
    const blogId = req.query.id;
    if (!blogId) {
      return res.status(400).json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId).populate(
      "author",
      "agentName email imageUrl designation specialistAreas phone whatsapp description"
    );

    if (!blog)
      return res.status(404).json({ success: false, message: "Blog not found" });

    // Transform the cover image URL
    const coverImageUrl = blog.coverImage.url;
    if (coverImageUrl) {
      const versionRegex = /\/v(\d+)\//;
      const match = coverImageUrl.match(versionRegex);
      if (match && match[1]) {
        const versionNumber = match[1];
        const imagePath = coverImageUrl.split('/').slice(-1)[0];
        const transformedCoverImageUrl = generateTransformedBlogImageUrl(imagePath, versionNumber);
        blog.coverImage.url = transformedCoverImageUrl;
      }
    }

    // Transform the agent image URL (author's image)
    const agentImageUrl = blog.author.agentImage.url;

    if (agentImageUrl) {
      const versionRegex = /\/v(\d+)\//;
      const match = agentImageUrl.match(versionRegex);

      if (match && match[1]) {
        const versionNumber = match[1];
        const imagePath = agentImageUrl.split('/').slice(-1)[0];

        // Generate the transformed image URL for the agent image
        const transformedAgentImageUrl = generateTransformedAgentImageUrl(imagePath, versionNumber);
        blog.author.agentImage.url = transformedAgentImageUrl;  // Update the agent image URL
      }
    }

    res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: blog,
    });
  } catch (error) {
    console.error("getSingleBlog error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Blog slug is required",
      });
    }

    const blog = await Blog.findOne({ slug })
      .populate("author", "agentName email imageUrl designation specialistAreas phone whatsapp description");

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Transform the cover image
    const coverImageUrl = blog.coverImage.url;
    if (coverImageUrl) {
      const versionRegex = /\/v(\d+)\//;
      const match = coverImageUrl.match(versionRegex);
      if (match && match[1]) {
        const versionNumber = match[1];
        const imagePath = coverImageUrl.split('/').slice(-1)[0];
        const transformedCoverImageUrl = generateTransformedBlogImageUrl(imagePath, versionNumber);
        blog.coverImage.url = transformedCoverImageUrl;
      }
    }

    // Transform the author image (agent image)
    const agentImageUrl = blog.author.agentImage.url;

    if (agentImageUrl) {
      const versionRegex = /\/v(\d+)\//;
      const match = agentImageUrl.match(versionRegex);

      if (match && match[1]) {
        const versionNumber = match[1];
        const imagePath = agentImageUrl.split('/').slice(-1)[0];

        // Generate the transformed image URL for the agent image
        const transformedAgentImageUrl = generateTransformedAgentImageUrl(imagePath, versionNumber);
        blog.author.agentImage.url = transformedAgentImageUrl;  // Update the agent image URL
      }
    }

    res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: blog,
    });
  } catch (error) {
    console.error("getBlogBySlug error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// This is also not being used
const getBlogsByTags = async (req, res) => {
  try {
    const { tags, limit = 6, excludeId, isPublished } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags are required. Pass tags as comma-separated values.",
      });
    }

    const tagsArray = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const query = {
      "metaInfo.tags": { $in: tagsArray },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    if (isPublished !== undefined) {
      query.isPublished = isPublished === "true";
    }

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    // For each blog, apply transformation to the cover image and author image
    const transformedBlogs = blogs.map(blog => {
      // Transform the cover image
      const coverImageUrl = blog.coverImage.url;

      if (coverImageUrl) {
        const versionRegex = /\/v(\d+)\//;
        const match = coverImageUrl.match(versionRegex);

        if (match && match[1]) {
          const versionNumber = match[1];
          const imagePath = coverImageUrl.split('/').slice(-1)[0];

          // Generate the transformed image URL for the cover image
          const transformedCoverImageUrl = generateTransformedBlogImageUrl(imagePath, versionNumber);
          blog.coverImage.url = transformedCoverImageUrl;  // Update the cover image URL
        }
      }

      // Transform the author image (agent image)
      const agentImageUrl = blog.author.agentImage.url;

      if (agentImageUrl) {
        const versionRegex = /\/v(\d+)\//;
        const match = agentImageUrl.match(versionRegex);

        if (match && match[1]) {
          const versionNumber = match[1];
          const imagePath = agentImageUrl.split('/').slice(-1)[0];

          // Generate the transformed image URL for the agent image
          const transformedAgentImageUrl = generateTransformedAgentImageUrl(imagePath, versionNumber);
          blog.author.agentImage.url = transformedAgentImageUrl;  // Update the agent image URL
        }
      }

      return blog;
    });

    res.status(200).json({
      success: true,
      message: "Blogs with matching tags fetched successfully",
      count: transformedBlogs.length,  // Return the number of transformed blogs
      data: transformedBlogs,  // Return the transformed blogs
    });
  } catch (error) {
    console.error("getBlogsByTags error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs by tags",
      error: error.message,
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blogId = req.query.id;
    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }
    const agent = await Agent.findOne({
      email: blog.author.agentEmail,
    });

    if (agent) {
      agent.blogs = agent.blogs.filter(
        (b) => b.blogId.toString() !== blogId
      );
      await agent.save({ validateBeforeSave: false });
    }
    if (blog.image?.publicId) {
      await destroyPublicId(blog.image.publicId);
    }

    if (blog.bodyImages) {
      for (const key in blog.bodyImages) {
        if (blog.bodyImages[key]?.publicId) {
          await destroyPublicId(blog.bodyImages[key].publicId);
        }
      }
    }
    await Blog.findByIdAndDelete(blogId);

    return res.status(200).json({
      success: true,
      message: "Blog and associated images deleted successfully",
    });
  } catch (error) {
    console.error("deleteBlog error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

// ---------- LIST BY AGENT ----------
// This is also not being used
const getBlogsByAgent = async (req, res) => {
  try {
    const { agentEmail } = req.params;
    const { published, page = 1, limit = 10 } = req.query;

    if (!agentEmail)
      return res
        .status(400)
        .json({ success: false, message: "Agent Email is required" });

    const filter = { "author.agentEmail": agentEmail };
    if (published !== undefined) filter.isPublished = published === "true";

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find(filter)
        .populate("author.agentEmail", "agentName email imageUrl designation")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Blog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Agent blogs fetched successfully",
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalBlogs / parseInt(limit, 10)),
          totalBlogs,
          hasNext: parseInt(page, 10) * parseInt(limit, 10) < totalBlogs,
          hasPrev: parseInt(page, 10) > 1,
        },
      },
    });
  } catch (error) {
    console.error("getBlogsByAgent error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent blogs",
      error: error.message,
    });
  }
};

// ---------- AGENTS WITH BLOGS ----------
// This is also not being used
async function getAgentsWithBlogs(req, res) {
  try {
    const { limit = 20 } = req.query;
    const agentsWithBlogs = await Agent.findAgentsWithBlogs(
      parseInt(limit, 10)
    );
    res.status(200).json({
      success: true,
      message: "Agents with blogs fetched successfully",
      data: agentsWithBlogs,
    });
  } catch (error) {
    console.error("getAgentsWithBlogs error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents with blogs",
      error: error.message,
    });
  }
}

// ---------- PUBLISH TOGGLE ----------
const toggleBlogPublishStatus = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { publish } = req.body;
    if (!blogId)
      return res
        .status(400)
        .json({ success: false, message: "Blog ID is required" });

    const blog = await Blog.findById(blogId);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    const result =
      publish === true || publish === "true"
        ? await blog.publish()
        : await blog.unpublish();

    try {
      const agent = await Agent.findOne({ agentId: blog.author.agentId });
      if (agent?.addOrUpdateBlog) {
        agent.addOrUpdateBlog({
          blogId: blog._id,
          title: blog.content?.title || blog.metadata?.title || "",
          description: blog.metadata?.description,
          slug: blog.metadata?.slug || "",
          isPublished: blog.isPublished,
          publishedAt: blog.publishedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent publish toggle link warning:", e.message);
    }

    res.status(200).json({
      success: true,
      message: `Blog ${publish ? "published" : "unpublished"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("toggleBlogPublishStatus error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle blog publish status",
      error: error.message,
    });
  }
};

module.exports = {
  // upload middleware first (multi-field)
  upload,
  // CRUD
  GetAllBlogs,
  getSingleBlog,
  getBlogsByTags,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogsByAgent,
  getAgentsWithBlogs,
  toggleBlogPublishStatus,
  getBlogBySlug
};