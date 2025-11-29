const Blog = require("../Models/BlogsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
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
      transformation: [{ quality: "auto:good", fetch_format: "auto" }],
      overwrite: false,
    };
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB each
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "bodyImage1", maxCount: 1 },
  { name: "bodyImage2", maxCount: 1 },
]);

// ---------- Helpers ----------
const createImageData = (file) => {
  if (!file) return null;
  return {
    url: file.path,
    publicId: file.filename, // existing
    filename: file.filename, // <-- add this line (required by Agent schema)
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
    // console.log(`🗑️ Cloudinary destroyed: ${publicId}`);
  } catch (e) {
    console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
  }
};

// ---------- CREATE ----------
// ---------- CREATE ----------
const createBlog = async (req, res) => {
  try {
    const { parsedData, agentId } = req.body;

    if (!parsedData) {
      return res
        .status(400)
        .json({ success: false, message: "parsedData is required" });
    }
    if (!agentId) {
      return res
        .status(400)
        .json({ success: false, message: "agentId is required" });
    }

    // Parse parsedData (JSON or plain text → Blog.parseTextToBlogStructure)
    let blogData;
    try {
      if (typeof parsedData === "string") {
        if (parsedData.trim().startsWith("{")) {
          blogData = JSON.parse(parsedData);
        } else {
          blogData = Blog.parseTextToBlogStructure(parsedData);
        }
      } else if (typeof parsedData === "object" && parsedData !== null) {
        blogData = parsedData;
      } else {
        throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Failed to parse blog data",
        error: e.message,
      });
    }

    // Validate content/title
    if (!blogData?.content?.title) {
      return res.status(400).json({
        success: false,
        message: "Blog content and title are required",
      });
    }
    if (!Array.isArray(blogData.content.sections)) {
      return res.status(400).json({
        success: false,
        message: "Blog content sections are required and must be an array",
      });
    }

    // Validate agent
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return res
        .status(404)
        .json({ success: false, message: "Agent not found" });
    }
    if (!agent.isActive) {
      return res
        .status(400)
        .json({ success: false, message: "Agent is not active" });
    }

    // Handle images (Cloudinary URLs now)
    const coverImageData = req.files?.coverImage?.[0]
      ? createImageData(req.files.coverImage[0])
      : null;
    const bodyImage1Data = req.files?.bodyImage1?.[0]
      ? createImageData(req.files.bodyImage1[0])
      : null;
    const bodyImage2Data = req.files?.bodyImage2?.[0]
      ? createImageData(req.files.bodyImage2[0])
      : null;

    // ---- STATUS LOGIC HERE ----
    // Only two valid statuses:
    // - "draft" (hidden from site)
    // - "published" (visible on site)
    //
    // Default: published (unless explicitly "draft")
    const isDraft = blogData.status === "draft";

    // Create blog doc
    const newBlog = new Blog({
      originalId:
        blogData.id ||
        `blog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: {
        title: blogData.metadata?.title || blogData.content.title,
        description:
          blogData.metadata?.description || blogData.seo?.metaDescription || "",
        author: blogData.metadata?.author || agent.agentName,
        tags: blogData.metadata?.tags || [],
        category: blogData.metadata?.category || "",
        slug: blogData.metadata?.slug || null,
      },
      content: {
        title: blogData.content.title,
        sections: blogData.content.sections || [],
        wordCount: blogData.content.wordCount || 0,
        readingTime: blogData.content.readingTime || 0,
      },
      seo: {
        metaTitle: blogData.seo?.metaTitle || "",
        metaDescription: blogData.seo?.metaDescription || "",
        keywords: blogData.seo?.keywords || [],
      },
      author: {
        agentId: agent.agentId,
        agentName: agent.agentName,
        agentEmail: agent.email,
        agentImage: agent.imageUrl,
      },
      image: coverImageData, // cover
      bodyImages: {
        image1: bodyImage1Data,
        image2: bodyImage2Data,
      },

      // STATUS + VISIBILITY
      status: isDraft ? "draft" : "published",
      isPublished: !isDraft,
      publishedAt: !isDraft ? new Date() : null,
    });

    const savedBlog = await newBlog.save();

    // Link to agent.blogs (if helper exists)
    try {
      if (typeof agent.addOrUpdateBlog === "function") {
        agent.addOrUpdateBlog({
          blogId: savedBlog._id,
          title: savedBlog.content.title,
          slug: savedBlog.metadata.slug,
          imageUrl: savedBlog.image,
          isPublished: savedBlog.isPublished,
          publishedAt: savedBlog.publishedAt,
          createdAt: savedBlog.createdAt,
          updatedAt: savedBlog.updatedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent blogs link warning:", e.message);
    }

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: {
        blog: savedBlog,
        stats: savedBlog.getContentStats?.(),
        linkedAgent: {
          agentId: agent.agentId,
          agentName: agent.agentName,
          email: agent.email,
          imageUrl: agent.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("BLOG CREATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// ---------- UPDATE ----------
const updateBlog = async (req, res) => {
  try {
    const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } =
      req.body;
    if (!blogId) {
      return res
        .status(400)
        .json({ success: false, message: "blogId is required" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    // Agent reassignment
    const oldAgentId = blog.author.agentId;
    let agentChanged = false;
    if (agentId && agentId !== oldAgentId) {
      const newAgent = await Agent.findOne({ agentId });
      if (!newAgent) {
        return res
          .status(404)
          .json({ success: false, message: "New agent not found" });
      }
      if (!newAgent.isActive) {
        return res
          .status(400)
          .json({ success: false, message: "New agent is not active" });
      }
      blog.author.agentId = newAgent.agentId;
      blog.author.agentName = newAgent.agentName;
      blog.author.agentEmail = newAgent.email;
      blog.author.agentImage = newAgent.imageUrl;
      agentChanged = true;
    }

    // Parse update content if provided
    if (parsedData) {
      let updateData;
      try {
        if (typeof parsedData === "string") {
          updateData = parsedData.trim().startsWith("{")
            ? JSON.parse(parsedData)
            : Blog.parseTextToBlogStructure(parsedData);
        } else if (typeof parsedData === "object") {
          updateData = parsedData;
        } else {
          throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Failed to parse blog data",
          error: e.message,
        });
      }

      // metadata
      if (updateData.metadata) {
        const m = updateData.metadata;
        if (m.title !== undefined) blog.metadata.title = m.title;
        if (m.description !== undefined)
          blog.metadata.description = m.description;
        if (m.author !== undefined) blog.metadata.author = m.author;
        if (m.tags !== undefined)
          blog.metadata.tags = Array.isArray(m.tags) ? m.tags : [];
        if (m.category !== undefined) blog.metadata.category = m.category;
        if (m.slug !== undefined) blog.metadata.slug = m.slug;
      }
      // content
      if (updateData.content) {
        const c = updateData.content;
        if (c.title !== undefined) blog.content.title = c.title;
        if (Array.isArray(c.sections)) blog.content.sections = c.sections;
        if (c.wordCount !== undefined) blog.content.wordCount = c.wordCount;
        if (c.readingTime !== undefined)
          blog.content.readingTime = c.readingTime;
      }
      // seo
      if (updateData.seo) {
        const s = updateData.seo;
        if (s.metaTitle !== undefined) blog.seo.metaTitle = s.metaTitle;
        if (s.metaDescription !== undefined)
          blog.seo.metaDescription = s.metaDescription;
        if (s.keywords !== undefined)
          blog.seo.keywords = Array.isArray(s.keywords) ? s.keywords : [];
      }
      // status
      // status
      if (updateData.status === "published" || updateData.status === "draft") {
        blog.status = updateData.status;

        if (updateData.status === "published") {
          blog.isPublished = true;
          if (!blog.publishedAt) blog.publishedAt = new Date();
        } else {
          // draft
          blog.isPublished = false;
          blog.publishedAt = null;
        }
      }
    }

    // Images (replace + destroy old on Cloudinary)
    if (req.files?.coverImage?.[0]) {
      if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
      blog.image = createImageData(req.files.coverImage[0]);
    }

    if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
      if (blog.bodyImages?.image1?.publicId)
        await destroyPublicId(blog.bodyImages.image1.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image1 = null;
    } else if (req.files?.bodyImage1?.[0]) {
      if (blog.bodyImages?.image1?.publicId)
        await destroyPublicId(blog.bodyImages.image1.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
    }

    if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
      if (blog.bodyImages?.image2?.publicId)
        await destroyPublicId(blog.bodyImages.image2.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image2 = null;
    } else if (req.files?.bodyImage2?.[0]) {
      if (blog.bodyImages?.image2?.publicId)
        await destroyPublicId(blog.bodyImages.image2.publicId);
      if (!blog.bodyImages) blog.bodyImages = {};
      blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
    }

    await blog.save();

    // Update agent link arrays
    const blogForAgent = {
      blogId: blog._id,
      title: blog.content?.title || blog.metadata?.title || "Untitled",
      slug: blog.metadata?.slug || "",
      // imageUrl: pickImageUrl(blog.image),
      imageUrl: blog.image,
      isPublished: blog.isPublished || false,
      publishedAt: blog.publishedAt || null,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
    if (agentChanged) {
      try {
        const oldAgent = await Agent.findOne({ agentId: oldAgentId });
        if (oldAgent) {
          oldAgent.blogs = (oldAgent.blogs || []).filter(
            (b) => String(b.blogId) !== String(blog._id)
          );
          await oldAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Old agent unlink warning:", e.message);
      }
      try {
        const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
        if (newAgent?.addOrUpdateBlog) {
          newAgent.addOrUpdateBlog(blogForAgent);
          await newAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("New agent link warning:", e.message);
      }
    } else {
      try {
        const currentAgent = await Agent.findOne({
          agentId: blog.author.agentId,
        });
        if (currentAgent?.addOrUpdateBlog) {
          currentAgent.addOrUpdateBlog(blogForAgent);
          await currentAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Agent blog update warning:", e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: agentChanged ? "Blog updated & reassigned" : "Blog updated",
      data: {
        blog,
        stats: blog.getContentStats?.(),
        linkedAgent: {
          agentId: blog.author.agentId,
          agentName: blog.author.agentName,
          email: blog.author.agentEmail,
        },
        agentChanged,
      },
    });
  } catch (error) {
    console.error("BLOG UPDATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// ---------- READS ----------
const GetAllBlogs = async (req, res) => {
  try {
    const { showAll } = req.query;

    let filter = {};

    // 🔹 If showAll=true → return ALL blogs
    if (showAll === "True") {
      filter = {}; // no filter
    } else {
      filter = { status: "published", isPublished: true };
    }

    const blogs = await Blog.find(filter)
      // .populate("author.agentId", "agentName email imageUrl designation")
      // .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      totalBlogs: blogs.length,
      data: blogs,
    });
  } catch (error) {
    console.error("GetAllBlogs error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

const getSingleBlog = async (req, res) => {
  try {
    const blogId = req.query.id;
    if (!blogId) {
      return res
        .status(400)
        .json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId).populate(
      "author.agentId",
      "agentName email imageUrl designation specialistAreas phone whatsapp description"
    );

    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

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

const getBlogsByTags = async (req, res) => {
  try {
    const { tags, limit = 6, excludeId } = req.query;
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

    const query = { "metadata.tags": { $in: tagsArray } };
    if (excludeId) query._id = { $ne: excludeId };

    const blogs = await Blog.find(query)
      .populate("author.agentId", "agentName email imageUrl designation")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const blogsWithScore = blogs
      .map((b) => {
        const matchingTags = (b.metadata.tags || []).filter((t) =>
          tagsArray.includes(String(t).toLowerCase())
        );
        return {
          ...b.toObject(),
          matchScore: matchingTags.length,
          matchingTags,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      message: "Blogs with matching tags fetched successfully",
      count: blogsWithScore.length,
      searchedTags: tagsArray,
      data: blogsWithScore,
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

// ---------- DELETE ----------
const deleteBlog = async (req, res) => {
  try {
    const blogId = req.query.id || req.body.id;
    if (!blogId) {
      return res
        .status(400)
        .json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    // Remove from agent.blogs
    try {
      const agent = await Agent.findOne({ agentId: blog.author.agentId });
      if (agent?.removeBlog) {
        agent.removeBlog(blog._id);
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent unlink warning:", e.message);
    }

    // Destroy Cloudinary images
    if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
    if (blog.bodyImages?.image1?.publicId)
      await destroyPublicId(blog.bodyImages.image1.publicId);
    if (blog.bodyImages?.image2?.publicId)
      await destroyPublicId(blog.bodyImages.image2.publicId);

    await Blog.findByIdAndDelete(blogId);

    res.status(200).json({
      success: true,
      message: "Blog and associated images deleted successfully",
    });
  } catch (error) {
    console.error("deleteBlog error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

// ---------- LIST BY AGENT ----------
const getBlogsByAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { published, page = 1, limit = 10 } = req.query;

    if (!agentId)
      return res
        .status(400)
        .json({ success: false, message: "Agent ID is required" });

    const filter = { "author.agentId": agentId };
    if (published !== undefined) filter.isPublished = published === "true";

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find(filter)
        .populate("author.agentId", "agentName email imageUrl designation")
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
const getAgentsWithBlogs = async (req, res) => {
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
};

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
};
