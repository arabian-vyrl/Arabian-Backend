// // const Blog = require("../Models/BlogsModel");
// // const Agent = require("../Models/AgentModel");
// // const path = require("path");
// // const cloudinary = require("cloudinary").v2;
// // const multer = require("multer");
// // const { CloudinaryStorage } = require("multer-storage-cloudinary");

// // function ensureFilename(img) {
// //   if (!img) return img;
// //   if (img.filename) return img;
// //   // try best-effort fallback
// //   const fromPublicId = img.publicId || img.public_id;
// //   if (fromPublicId) return { ...img, filename: fromPublicId };
// //   // last resort: derive from URL (public_id without extension)
// //   if (img.url) {
// //     const base = img.url.split("/").pop() || "";
// //     const noQuery = base.split("?")[0];
// //     const noExt = noQuery.replace(/\.[a-z0-9]+$/i, "");
// //     return { ...img, filename: noExt || "unknown" };
// //   }
// //   return { ...img, filename: "unknown" };
// // }
// // // ---------- Cloudinary Multer Storage (multi-field) ----------
// // const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
// // const fileFilter = (_req, file, cb) => {
// //   const ok = (file.mimetype || "").startsWith("image/");
// //   if (!ok) return cb(new Error("Only image files are allowed!"), false);
// //   cb(null, true);
// // };

// // const storage = new CloudinaryStorage({
// //   cloudinary,
// //   params: async (req, file) => {
// //     // Put all blog images under this folder
// //     const folder = "blogs";
// //     // Create descriptive public_id: blogs/<ts>-<random>-<slugged-original>
// //     const base =
// //       (file.originalname || "image")
// //         .toLowerCase()
// //         .replace(/\.[a-z0-9]+$/, "")
// //         .replace(/[^\w]+/g, "-")
// //         .slice(0, 50) || "image";
// //     const public_id = `${Date.now()}-${Math.round(
// //       Math.random() * 1e6
// //     )}-${base}`;
// //     return {
// //       folder,
// //       public_id,
// //       allowed_formats: ALLOWED_EXT,
// //       resource_type: "image",
// //       transformation: [{ quality: "auto:good", fetch_format: "auto" }],
// //       overwrite: false,
// //     };
// //   },
// // });

// // const upload = multer({
// //   storage,
// //   fileFilter,
// //   limits: { fileSize: 10 * 1024 * 1024 }, 
// // }).fields([
// //   { name: "coverImage", maxCount: 1 },
// //   { name: "bodyImage1", maxCount: 1 },
// //   { name: "bodyImage2", maxCount: 1 },
// // ]);

// // // ---------- Helpers ----------
// // const createImageData = (file) => {
// //   if (!file) return null;
// //   return {
// //     url: file.path,
// //     publicId: file.filename, // existing
// //     filename: file.filename, // <-- add this line (required by Agent schema)
// //     format: file.format,
// //     bytes: file.size,
// //     width: file.width,
// //     height: file.height,
// //     folder: file.folder,
// //     originalName: file.originalname,
// //     mimetype: file.mimetype,
// //   };
// // };

// // const destroyPublicId = async (publicId) => {
// //   if (!publicId) return;
// //   try {
// //     await cloudinary.uploader.destroy(publicId, { invalidate: true });
// //     // console.log(`🗑️ Cloudinary destroyed: ${publicId}`);
// //   } catch (e) {
// //     console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
// //   }
// // };

// // // ---------- CREATE ----------
// // // ---------- CREATE ----------
// // const createBlog = async (req, res) => {
// //   try {
// //     const { parsedData, agentId } = req.body;

// //     if (!parsedData) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "parsedData is required" });
// //     }
// //     if (!agentId) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "agentId is required" });
// //     }

// //     // Parse parsedData (JSON or plain text → Blog.parseTextToBlogStructure)
// //     let blogData;
// //     try {
// //       if (typeof parsedData === "string") {
// //         if (parsedData.trim().startsWith("{")) {
// //           blogData = JSON.parse(parsedData);
// //         } else {
// //           blogData = Blog.parseTextToBlogStructure(parsedData);
// //         }
// //       } else if (typeof parsedData === "object" && parsedData !== null) {
// //         blogData = parsedData;
// //       } else {
// //         throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
// //       }
// //     } catch (e) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Failed to parse blog data",
// //         error: e.message,
// //       });
// //     }

// //     // Validate content/title
// //     if (!blogData?.content?.title) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Blog content and title are required",
// //       });
// //     }
// //     if (!Array.isArray(blogData.content.sections)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Blog content sections are required and must be an array",
// //       });
// //     }

// //     // Validate agent
// //     const agent = await Agent.findOne({ agentId });
// //     if (!agent) {
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Agent not found" });
// //     }
// //     if (!agent.isActive) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Agent is not active" });
// //     }

// //     // Handle images (Cloudinary URLs now)
// //     const coverImageData = req.files?.coverImage?.[0]
// //       ? createImageData(req.files.coverImage[0])
// //       : null;
// //     const bodyImage1Data = req.files?.bodyImage1?.[0]
// //       ? createImageData(req.files.bodyImage1[0])
// //       : null;
// //     const bodyImage2Data = req.files?.bodyImage2?.[0]
// //       ? createImageData(req.files.bodyImage2[0])
// //       : null;

// //     // ---- STATUS LOGIC HERE ----
// //     // Only two valid statuses:
// //     // - "draft" (hidden from site)
// //     // - "published" (visible on site)
// //     //
// //     // Default: published (unless explicitly "draft")
// //     const isDraft = blogData.status === "draft";

// //     // Create blog doc
// //     const newBlog = new Blog({
// //       originalId:
// //         blogData.id ||
// //         `blog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
// //       metadata: {
// //         title: blogData.metadata?.title || blogData.content.title,
// //         description:
// //           blogData.metadata?.description || blogData.seo?.metaDescription || "",
// //         author: blogData.metadata?.author || agent.agentName,
// //         tags: blogData.metadata?.tags || [],
// //         category: blogData.metadata?.category || "",
// //         slug: blogData.metadata?.slug || null,
// //       },
// //       content: {
// //         title: blogData.content.title,
// //         sections: blogData.content.sections || [],
// //         wordCount: blogData.content.wordCount || 0,
// //         readingTime: blogData.content.readingTime || 0,
// //       },
// //       seo: {
// //         metaTitle: blogData.seo?.metaTitle || "",
// //         metaDescription: blogData.seo?.metaDescription || "",
// //         keywords: blogData.seo?.keywords || [],
// //       },
// //       author: {
// //         agentId: agent.agentId,
// //         agentName: agent.agentName,
// //         agentEmail: agent.email,
// //         agentImage: agent.imageUrl,
// //         agentInstagramURL: agent.instagram, 
// //         agentLinkedinURL: agent.linkedin
// //       },
// //       image: coverImageData, // cover
// //       bodyImages: {
// //         image1: bodyImage1Data,
// //         image2: bodyImage2Data,
// //       },

// //       // STATUS + VISIBILITY
// //       status: isDraft ? "draft" : "published",
// //       isPublished: !isDraft,
// //       publishedAt: !isDraft ? new Date() : null,
// //     });

// //     const savedBlog = await newBlog.save();

// //     // Link to agent.blogs (if helper exists)
// //     try {
// //       if (typeof agent.addOrUpdateBlog === "function") {
// //         agent.addOrUpdateBlog({
// //           blogId: savedBlog._id,
// //           title: savedBlog.content.title,
// //           description: savedBlog.metadata.description,
// //           slug: savedBlog.metadata.slug,
// //           imageUrl: savedBlog.image,
// //           isPublished: savedBlog.isPublished,
// //           publishedAt: savedBlog.publishedAt,
// //           createdAt: savedBlog.createdAt,
// //           updatedAt: savedBlog.updatedAt,
// //         });
// //         await agent.save({ validateBeforeSave: false });
// //       }
// //     } catch (e) {
// //       console.warn("Agent blogs link warning:", e.message);
// //     }

// //     res.status(201).json({
// //       success: true,
// //       message: "Blog created successfully",
// //       data: {
// //         blog: savedBlog,
// //         stats: savedBlog.getContentStats?.(),
// //         linkedAgent: {
// //           agentId: agent.agentId,
// //           agentName: agent.agentName,
// //           email: agent.email,
// //           imageUrl: agent.imageUrl,
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     console.error("BLOG CREATE ERROR:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to create blog",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- UPDATE ----------
// // const updateBlog = async (req, res) => {
// //   try {
// //     const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } =
// //       req.body;
// //     if (!blogId) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "blogId is required" });
// //     }

// //     const blog = await Blog.findById(blogId);
// //     if (!blog) {
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Blog not found" });
// //     }

// //     // Agent reassignment
// //     const oldAgentId = blog.author.agentId;
// //     let agentChanged = false;
// //     if (agentId && agentId !== oldAgentId) {
// //       const newAgent = await Agent.findOne({ agentId });
// //       if (!newAgent) {
// //         return res
// //           .status(404)
// //           .json({ success: false, message: "New agent not found" });
// //       }
// //       if (!newAgent.isActive) {
// //         return res
// //           .status(400)
// //           .json({ success: false, message: "New agent is not active" });
// //       }
// //       blog.author.agentId = newAgent.agentId;
// //       blog.author.agentName = newAgent.agentName;
// //       blog.author.agentEmail = newAgent.email;
// //       blog.author.agentImage = newAgent.imageUrl;
// //       agentChanged = true;
// //     }

// //     // Parse update content if provided
// //     if (parsedData) {
// //       let updateData;
// //       try {
// //         if (typeof parsedData === "string") {
// //           updateData = parsedData.trim().startsWith("{")
// //             ? JSON.parse(parsedData)
// //             : Blog.parseTextToBlogStructure(parsedData);
// //         } else if (typeof parsedData === "object") {
// //           updateData = parsedData;
// //         } else {
// //           throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
// //         }
// //       } catch (e) {
// //         return res.status(400).json({
// //           success: false,
// //           message: "Failed to parse blog data",
// //           error: e.message,
// //         });
// //       }

// //       // metadata
// //       if (updateData.metadata) {
// //         const m = updateData.metadata;
// //         if (m.title !== undefined) blog.metadata.title = m.title;
// //         if (m.description !== undefined)
// //           blog.metadata.description = m.description;
// //         if (m.author !== undefined) blog.metadata.author = m.author;
// //         if (m.tags !== undefined)
// //           blog.metadata.tags = Array.isArray(m.tags) ? m.tags : [];
// //         if (m.category !== undefined) blog.metadata.category = m.category;
// //         if (m.slug !== undefined) blog.metadata.slug = m.slug;
// //       }
// //       // content
// //       if (updateData.content) {
// //         const c = updateData.content;
// //         if (c.title !== undefined) blog.content.title = c.title;
// //         if (Array.isArray(c.sections)) blog.content.sections = c.sections;
// //         if (c.wordCount !== undefined) blog.content.wordCount = c.wordCount;
// //         if (c.readingTime !== undefined)
// //           blog.content.readingTime = c.readingTime;
// //       }
// //       // seo
// //       if (updateData.seo) {
// //         const s = updateData.seo;
// //         if (s.metaTitle !== undefined) blog.seo.metaTitle = s.metaTitle;
// //         if (s.metaDescription !== undefined)
// //           blog.seo.metaDescription = s.metaDescription;
// //         if (s.keywords !== undefined)
// //           blog.seo.keywords = Array.isArray(s.keywords) ? s.keywords : [];
// //       }
// //       // status
// //       // status
// //       if (updateData.status === "published" || updateData.status === "draft") {
// //         blog.status = updateData.status;

// //         if (updateData.status === "published") {
// //           blog.isPublished = true;
// //           if (!blog.publishedAt) blog.publishedAt = new Date();
// //         } else {
// //           // draft
// //           blog.isPublished = false;
// //           blog.publishedAt = null;
// //         }
// //       }
// //     }

// //     // Images (replace + destroy old on Cloudinary)
// //     if (req.files?.coverImage?.[0]) {
// //       if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
// //       blog.image = createImageData(req.files.coverImage[0]);
// //     }

// //     if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
// //       if (blog.bodyImages?.image1?.publicId)
// //         await destroyPublicId(blog.bodyImages.image1.publicId);
// //       if (!blog.bodyImages) blog.bodyImages = {};
// //       blog.bodyImages.image1 = null;
// //     } else if (req.files?.bodyImage1?.[0]) {
// //       if (blog.bodyImages?.image1?.publicId)
// //         await destroyPublicId(blog.bodyImages.image1.publicId);
// //       if (!blog.bodyImages) blog.bodyImages = {};
// //       blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
// //     }

// //     if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
// //       if (blog.bodyImages?.image2?.publicId)
// //         await destroyPublicId(blog.bodyImages.image2.publicId);
// //       if (!blog.bodyImages) blog.bodyImages = {};
// //       blog.bodyImages.image2 = null;
// //     } else if (req.files?.bodyImage2?.[0]) {
// //       if (blog.bodyImages?.image2?.publicId)
// //         await destroyPublicId(blog.bodyImages.image2.publicId);
// //       if (!blog.bodyImages) blog.bodyImages = {};
// //       blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
// //     }

// //     await blog.save();

// //     // Update agent link arrays
// //     const blogForAgent = {
// //       blogId: blog._id,
// //       title: blog.content?.title || blog.metadata?.title || "Untitled",
// //       description: blog.metadata?.description || blog.content?.title || "Untitled",
// //       slug: blog.metadata?.slug || "",
// //       // imageUrl: pickImageUrl(blog.image),
// //       imageUrl: blog.image,
// //       isPublished: blog.isPublished || false,
// //       publishedAt: blog.publishedAt || null,
// //       createdAt: blog.createdAt,
// //       updatedAt: blog.updatedAt,
// //     };
// //     if (agentChanged) {
// //       try {
// //         const oldAgent = await Agent.findOne({ agentId: oldAgentId });
// //         if (oldAgent) {
// //           oldAgent.blogs = (oldAgent.blogs || []).filter(
// //             (b) => String(b.blogId) !== String(blog._id)
// //           );
// //           await oldAgent.save({ validateBeforeSave: false });
// //         }
// //       } catch (e) {
// //         console.warn("Old agent unlink warning:", e.message);
// //       }
// //       try {
// //         const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
// //         if (newAgent?.addOrUpdateBlog) {
// //           newAgent.addOrUpdateBlog(blogForAgent);
// //           await newAgent.save({ validateBeforeSave: false });
// //         }
// //       } catch (e) {
// //         console.warn("New agent link warning:", e.message);
// //       }
// //     } else {
// //       try {
// //         const currentAgent = await Agent.findOne({
// //           agentId: blog.author.agentId,
// //         });
// //         if (currentAgent?.addOrUpdateBlog) {
// //           currentAgent.addOrUpdateBlog(blogForAgent);
// //           await currentAgent.save({ validateBeforeSave: false });
// //         }
// //       } catch (e) {
// //         console.warn("Agent blog update warning:", e.message);
// //       }
// //     }

// //     res.status(200).json({
// //       success: true,
// //       message: agentChanged ? "Blog updated & reassigned" : "Blog updated",
// //       data: {
// //         blog,
// //         stats: blog.getContentStats?.(),
// //         linkedAgent: {
// //           agentId: blog.author.agentId,
// //           agentName: blog.author.agentName,
// //           email: blog.author.agentEmail,
// //         },
// //         agentChanged,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("BLOG UPDATE ERROR:", error);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to update blog",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- READS ----------
// // const GetAllBlogs = async (req, res) => {
// //   try {
// //     const { showAll } = req.query;

// //     let filter = {};

// //     // 🔹 If showAll=true → return ALL blogs
// //     if (showAll === "True") {
// //       filter = {}; // no filter
// //     } else {
// //       filter = { status: "published", isPublished: true };
// //     }

// //     const blogs = await Blog.find(filter)
// //       // .populate("author.agentId", "agentName email imageUrl designation")
// //       // .sort({ createdAt: -1 });

// //     res.status(200).json({
// //       success: true,
// //       message: "Blogs fetched successfully",
// //       totalBlogs: blogs.length,
// //       data: blogs,
// //     });
// //   } catch (error) {
// //     console.error("GetAllBlogs error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch blogs",
// //       error: error.message,
// //     });
// //   }
// // };

// // const getSingleBlog = async (req, res) => {
// //   try {
// //     const blogId = req.query.id;
// //     if (!blogId) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Blog ID is required" });
// //     }

// //     const blog = await Blog.findById(blogId).populate(
// //       "author.agentId",
// //       "agentName email imageUrl designation specialistAreas phone whatsapp description"
// //     );

// //     if (!blog)
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Blog not found" });

// //     res.status(200).json({
// //       success: true,
// //       message: "Blog fetched successfully",
// //       data: blog,
// //     });
// //   } catch (error) {
// //     console.error("getSingleBlog error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch blog",
// //       error: error.message,
// //     });
// //   }
// // };

// // const getBlogsByTags = async (req, res) => {
// //   try {
// //     const { tags, limit = 6, excludeId } = req.query;

// //     console.log("This is the tags", tags)
// //     if (!tags) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Tags are required. Pass tags as comma-separated values.",
// //       });
// //     }
// //     const tagsArray = tags
// //       .split(",")
// //       .map((t) => t.trim().toLowerCase())
// //       .filter(Boolean);

// //     const query = { "metadata.tags": { $in: tagsArray } };
// //     if (excludeId) query._id = { $ne: excludeId };

// //     const blogs = await Blog.find(query)
// //       .populate("author.agentId", "agentName email imageUrl designation")
// //       .sort({ createdAt: -1 })
// //       .limit(parseInt(limit, 10));

// //     const blogsWithScore = blogs
// //       .map((b) => {
// //         const matchingTags = (b.metadata.tags || []).filter((t) =>
// //           tagsArray.includes(String(t).toLowerCase())
// //         );
// //         return {
// //           ...b.toObject(),
// //           matchScore: matchingTags.length,
// //           matchingTags,
// //         };
// //       })
// //       .sort((a, b) => b.matchScore - a.matchScore);

// //     res.status(200).json({
// //       success: true,
// //       message: "Blogs with matching tags fetched successfully",
// //       count: blogsWithScore.length,
// //       searchedTags: tagsArray,
// //       data: blogsWithScore,
// //     });
// //   } catch (error) {
// //     console.error("getBlogsByTags error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch blogs by tags",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- DELETE ----------
// // const deleteBlog = async (req, res) => {
// //   try {
// //     const blogId = req.query.id || req.body.id;
// //     if (!blogId) {
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Blog ID is required" });
// //     }

// //     const blog = await Blog.findById(blogId);
// //     if (!blog)
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Blog not found" });

// //     // Remove from agent.blogs
// //     try {
// //       const agent = await Agent.findOne({ agentId: blog.author.agentId });
// //       if (agent?.removeBlog) {
// //         agent.removeBlog(blog._id);
// //         await agent.save({ validateBeforeSave: false });
// //       }
// //     } catch (e) {
// //       console.warn("Agent unlink warning:", e.message);
// //     }

// //     // Destroy Cloudinary images
// //     if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
// //     if (blog.bodyImages?.image1?.publicId)
// //       await destroyPublicId(blog.bodyImages.image1.publicId);
// //     if (blog.bodyImages?.image2?.publicId)
// //       await destroyPublicId(blog.bodyImages.image2.publicId);

// //     await Blog.findByIdAndDelete(blogId);

// //     res.status(200).json({
// //       success: true,
// //       message: "Blog and associated images deleted successfully",
// //     });
// //   } catch (error) {
// //     console.error("deleteBlog error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to delete blog",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- LIST BY AGENT ----------
// // const getBlogsByAgent = async (req, res) => {
// //   try {
// //     const { agentId } = req.params;
// //     const { published, page = 1, limit = 10 } = req.query;

// //     if (!agentId)
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Agent ID is required" });

// //     const filter = { "author.agentId": agentId };
// //     if (published !== undefined) filter.isPublished = published === "true";

// //     const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

// //     const [blogs, totalBlogs] = await Promise.all([
// //       Blog.find(filter)
// //         .populate("author.agentId", "agentName email imageUrl designation")
// //         .sort({ createdAt: -1 })
// //         .skip(skip)
// //         .limit(parseInt(limit, 10)),
// //       Blog.countDocuments(filter),
// //     ]);

// //     res.status(200).json({
// //       success: true,
// //       message: "Agent blogs fetched successfully",
// //       data: {
// //         blogs,
// //         pagination: {
// //           currentPage: parseInt(page, 10),
// //           totalPages: Math.ceil(totalBlogs / parseInt(limit, 10)),
// //           totalBlogs,
// //           hasNext: parseInt(page, 10) * parseInt(limit, 10) < totalBlogs,
// //           hasPrev: parseInt(page, 10) > 1,
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     console.error("getBlogsByAgent error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch agent blogs",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- AGENTS WITH BLOGS ----------
// // const getAgentsWithBlogs = async (req, res) => {
// //   try {
// //     const { limit = 20 } = req.query;
// //     const agentsWithBlogs = await Agent.findAgentsWithBlogs(
// //       parseInt(limit, 10)
// //     );
// //     res.status(200).json({
// //       success: true,
// //       message: "Agents with blogs fetched successfully",
// //       data: agentsWithBlogs,
// //     });
// //   } catch (error) {
// //     console.error("getAgentsWithBlogs error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch agents with blogs",
// //       error: error.message,
// //     });
// //   }
// // };

// // // ---------- PUBLISH TOGGLE ----------
// // const toggleBlogPublishStatus = async (req, res) => {
// //   try {
// //     const { blogId } = req.params;
// //     const { publish } = req.body;
// //     if (!blogId)
// //       return res
// //         .status(400)
// //         .json({ success: false, message: "Blog ID is required" });

// //     const blog = await Blog.findById(blogId);
// //     if (!blog)
// //       return res
// //         .status(404)
// //         .json({ success: false, message: "Blog not found" });

// //     const result =
// //       publish === true || publish === "true"
// //         ? await blog.publish()
// //         : await blog.unpublish();

// //     try {
// //       const agent = await Agent.findOne({ agentId: blog.author.agentId });
// //       if (agent?.addOrUpdateBlog) {
// //         agent.addOrUpdateBlog({
// //           blogId: blog._id,
// //           title: blog.content?.title || blog.metadata?.title || "",
// //           description: blog.metadata?.description,
// //           slug: blog.metadata?.slug || "",
// //           isPublished: blog.isPublished,
// //           publishedAt: blog.publishedAt,
// //         });
// //         await agent.save({ validateBeforeSave: false });
// //       }
// //     } catch (e) {
// //       console.warn("Agent publish toggle link warning:", e.message);
// //     }

// //     res.status(200).json({
// //       success: true,
// //       message: `Blog ${publish ? "published" : "unpublished"} successfully`,
// //       data: result,
// //     });
// //   } catch (error) {
// //     console.error("toggleBlogPublishStatus error:", error.message);
// //     res.status(500).json({
// //       success: false,
// //       message: "Failed to toggle blog publish status",
// //       error: error.message,
// //     });
// //   }
// // };

// // module.exports = {
// //   // upload middleware first (multi-field)
// //   upload,
// //   // CRUD
// //   GetAllBlogs,
// //   getSingleBlog,
// //   getBlogsByTags,
// //   createBlog,
// //   updateBlog,
// //   deleteBlog,
// //   getBlogsByAgent,
// //   getAgentsWithBlogs,
// //   toggleBlogPublishStatus,
// // };




// const Blog = require("../Models/BlogsModel");
// const Agent = require("../Models/AgentModel");
// const path = require("path");
// const cloudinary = require("cloudinary").v2;
// const multer = require("multer");
// const { CloudinaryStorage } = require("multer-storage-cloudinary");

// function ensureFilename(img) {
//   if (!img) return img;
//   if (img.filename) return img;
//   // try best-effort fallback
//   const fromPublicId = img.publicId || img.public_id;
//   if (fromPublicId) return { ...img, filename: fromPublicId };
//   // last resort: derive from URL (public_id without extension)
//   if (img.url) {
//     const base = img.url.split("/").pop() || "";
//     const noQuery = base.split("?")[0];
//     const noExt = noQuery.replace(/\.[a-z0-9]+$/i, "");
//     return { ...img, filename: noExt || "unknown" };
//   }
//   return { ...img, filename: "unknown" };
// }
// // ---------- Cloudinary Multer Storage (multi-field) ----------
// const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
// const fileFilter = (_req, file, cb) => {
//   const ok = (file.mimetype || "").startsWith("image/");
//   if (!ok) return cb(new Error("Only image files are allowed!"), false);
//   cb(null, true);
// };

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     // Put all blog images under this folder
//     const folder = "blogs";
//     // Create descriptive public_id: blogs/<ts>-<random>-<slugged-original>
//     const base =
//       (file.originalname || "image")
//         .toLowerCase()
//         .replace(/\.[a-z0-9]+$/, "")
//         .replace(/[^\w]+/g, "-")
//         .slice(0, 50) || "image";
//     const public_id = `${Date.now()}-${Math.round(
//       Math.random() * 1e6
//     )}-${base}`;
//     return {
//       folder,
//       public_id,
//       allowed_formats: ALLOWED_EXT,
//       resource_type: "image",
//       transformation: [{ quality: "auto:good", fetch_format: "auto" }],
//       overwrite: false,
//     };
//   },
// });

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 10 * 1024 * 1024 },
// }).fields([
//   { name: "coverImage", maxCount: 1 },
//   { name: "bodyImage1", maxCount: 1 },
//   { name: "bodyImage2", maxCount: 1 },
// ]);

// // ---------- Helpers ----------
// const createImageData = (file) => {
//   if (!file) return null;
//   return {
//     url: file.path,
//     publicId: file.filename, // existing
//     filename: file.filename, // <-- add this line (required by Agent schema)
//     format: file.format,
//     bytes: file.size,
//     width: file.width,
//     height: file.height,
//     folder: file.folder,
//     originalName: file.originalname,
//     mimetype: file.mimetype,
//   };
// };

// const destroyPublicId = async (publicId) => {
//   if (!publicId) return;
//   try {
//     await cloudinary.uploader.destroy(publicId, { invalidate: true });
//     // console.log(`🗑️ Cloudinary destroyed: ${publicId}`);
//   } catch (e) {
//     console.warn("⚠️ Cloudinary destroy failed:", publicId, e.message);
//   }
// };

// // ---------- CREATE ----------
// // ---------- CREATE ----------
// const createBlog = async (req, res) => {
//   try {
//     const { parsedData, agentId } = req.body;

//     if (!parsedData) {
//       return res
//         .status(400)
//         .json({ success: false, message: "parsedData is required" });
//     }
//     if (!agentId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "agentId is required" });
//     }

//     // Parse parsedData (JSON or plain text → Blog.parseTextToBlogStructure)
//     let blogData;
//     try {
//       if (typeof parsedData === "string") {
//         if (parsedData.trim().startsWith("{")) {
//           blogData = JSON.parse(parsedData);
//         } else {
//           blogData = Blog.parseTextToBlogStructure(parsedData);
//         }
//       } else if (typeof parsedData === "object" && parsedData !== null) {
//         blogData = parsedData;
//       } else {
//         throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
//       }
//     } catch (e) {
//       return res.status(400).json({
//         success: false,
//         message: "Failed to parse blog data",
//         error: e.message,
//       });
//     }

//     // Validate content/title
//     if (!blogData?.content?.title) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog content and title are required",
//       });
//     }
//     if (!Array.isArray(blogData.content.sections)) {
//       return res.status(400).json({
//         success: false,
//         message: "Blog content sections are required and must be an array",
//       });
//     }

//     // Validate agent
//     const agent = await Agent.findOne({ agentId });
//     if (!agent) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Agent not found" });
//     }
//     if (!agent.isActive) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Agent is not active" });
//     }

//     // Handle images (Cloudinary URLs now)
//     const coverImageData = req.files?.coverImage?.[0]
//       ? createImageData(req.files.coverImage[0])
//       : null;
//     const bodyImage1Data = req.files?.bodyImage1?.[0]
//       ? createImageData(req.files.bodyImage1[0])
//       : null;
//     const bodyImage2Data = req.files?.bodyImage2?.[0]
//       ? createImageData(req.files.bodyImage2[0])
//       : null;

//     // ---- STATUS LOGIC HERE ----
//     // Only two valid statuses:
//     // - "draft" (hidden from site)
//     // - "published" (visible on site)
//     //
//     // Default: published (unless explicitly "draft")
//     const isDraft = blogData.status === "draft";

//     // Create blog doc
//     const newBlog = new Blog({
//       originalId:
//         blogData.id ||
//         `blog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
//       metadata: {
//         title: blogData.metadata?.title || blogData.content.title,
//         description:
//           blogData.metadata?.description || blogData.seo?.metaDescription || "",
//         author: blogData.metadata?.author || agent.agentName,
//         tags: blogData.metadata?.tags || [],
//         category: blogData.metadata?.category || "",
//         slug: blogData.metadata?.slug || null,
//       },
//       content: {
//         title: blogData.content.title,
//         sections: blogData.content.sections || [],
//         wordCount: blogData.content.wordCount || 0,
//         readingTime: blogData.content.readingTime || 0,
//       },
//       seo: {
//         metaTitle: blogData.seo?.metaTitle || "",
//         metaDescription: blogData.seo?.metaDescription || "",
//         keywords: blogData.seo?.keywords || [],
//       },
//       author: {
//         agentId: agent.agentId,
//         agentName: agent.agentName,
//         agentEmail: agent.email,
//         agentImage: agent.imageUrl,
//         agentInstagramURL: agent.instagram,
//         agentLinkedinURL: agent.linkedin,
//       },
//       image: coverImageData, // cover
//       bodyImages: {
//         image1: bodyImage1Data,
//         image2: bodyImage2Data,
//       },

//       // STATUS + VISIBILITY
//       status: isDraft ? "draft" : "published",
//       isPublished: !isDraft,
//       publishedAt: !isDraft ? new Date() : null,
//     });

//     const savedBlog = await newBlog.save();

//     // Link to agent.blogs (if helper exists)
//     try {
//       if (typeof agent.addOrUpdateBlog === "function") {
//         agent.addOrUpdateBlog({
//           blogId: savedBlog._id,
//           title: savedBlog.content.title,
//           description: savedBlog.metadata.description,
//           slug: savedBlog.metadata.slug,
//           imageUrl: savedBlog.image,
//           isPublished: savedBlog.isPublished,
//           publishedAt: savedBlog.publishedAt,
//           createdAt: savedBlog.createdAt,
//           updatedAt: savedBlog.updatedAt,
//         });
//         await agent.save({ validateBeforeSave: false });
//       }
//     } catch (e) {
//       console.warn("Agent blogs link warning:", e.message);
//     }

//     res.status(201).json({
//       success: true,
//       message: "Blog created successfully",
//       data: {
//         blog: savedBlog,
//         stats: savedBlog.getContentStats?.(),
//         linkedAgent: {
//           agentId: agent.agentId,
//           agentName: agent.agentName,
//           email: agent.email,
//           imageUrl: agent.imageUrl,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("BLOG CREATE ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create blog",
//       error: error.message,
//     });
//   }
// };

// // ---------- UPDATE ----------
// const updateBlog = async (req, res) => {
//   try {
//     const { blogId, parsedData, agentId, removeBodyImage1, removeBodyImage2 } =
//       req.body;
//     if (!blogId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "blogId is required" });
//     }

//     const blog = await Blog.findById(blogId);
//     if (!blog) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Blog not found" });
//     }

//     // Agent reassignment
//     const oldAgentId = blog.author.agentId;
//     let agentChanged = false;
//     if (agentId && agentId !== oldAgentId) {
//       const newAgent = await Agent.findOne({ agentId });
//       if (!newAgent) {
//         return res
//           .status(404)
//           .json({ success: false, message: "New agent not found" });
//       }
//       if (!newAgent.isActive) {
//         return res
//           .status(400)
//           .json({ success: false, message: "New agent is not active" });
//       }
//       blog.author.agentId = newAgent.agentId;
//       blog.author.agentName = newAgent.agentName;
//       blog.author.agentEmail = newAgent.email;
//       blog.author.agentImage = newAgent.imageUrl;
//       agentChanged = true;
//     }

//     // Parse update content if provided
//     if (parsedData) {
//       let updateData;
//       try {
//         if (typeof parsedData === "string") {
//           updateData = parsedData.trim().startsWith("{")
//             ? JSON.parse(parsedData)
//             : Blog.parseTextToBlogStructure(parsedData);
//         } else if (typeof parsedData === "object") {
//           updateData = parsedData;
//         } else {
//           throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
//         }
//       } catch (e) {
//         return res.status(400).json({
//           success: false,
//           message: "Failed to parse blog data",
//           error: e.message,
//         });
//       }

//       // metadata
//       if (updateData.metadata) {
//         const m = updateData.metadata;
//         if (m.title !== undefined) blog.metadata.title = m.title;
//         if (m.description !== undefined)
//           blog.metadata.description = m.description;
//         if (m.author !== undefined) blog.metadata.author = m.author;
//         if (m.tags !== undefined)
//           blog.metadata.tags = Array.isArray(m.tags) ? m.tags : [];
//         if (m.category !== undefined) blog.metadata.category = m.category;
//         if (m.slug !== undefined) blog.metadata.slug = m.slug;
//       }
//       // content
//       if (updateData.content) {
//         const c = updateData.content;
//         if (c.title !== undefined) blog.content.title = c.title;
//         if (Array.isArray(c.sections)) blog.content.sections = c.sections;
//         if (c.wordCount !== undefined) blog.content.wordCount = c.wordCount;
//         if (c.readingTime !== undefined)
//           blog.content.readingTime = c.readingTime;
//       }
//       // seo
//       if (updateData.seo) {
//         const s = updateData.seo;
//         if (s.metaTitle !== undefined) blog.seo.metaTitle = s.metaTitle;
//         if (s.metaDescription !== undefined)
//           blog.seo.metaDescription = s.metaDescription;
//         if (s.keywords !== undefined)
//           blog.seo.keywords = Array.isArray(s.keywords) ? s.keywords : [];
//       }

//       // status
//       if (updateData.status === "published" || updateData.status === "draft") {
//         blog.status = updateData.status;

//         if (updateData.status === "published") {
//           blog.isPublished = true;
//           if (!blog.publishedAt) blog.publishedAt = new Date();
//         } else {
//           // draft
//           blog.isPublished = false;
//           blog.publishedAt = null;
//         }
//       }
//     }


//     if (req.body.publishedDate) {
//         blog.publishedAt = new Date(req.body.publishedDate);
//       } else if (req.body.clearPublishedDate === "true") {
//         blog.publishedAt = null;
//       }

//       // Auto-set publishedAt if changing from draft to published and no date provided
//       if (blog.status === "published" && !blog.publishedAt) {
//         blog.publishedAt = new Date();
//       }

      

//     // Images (replace + destroy old on Cloudinary)
//     if (req.files?.coverImage?.[0]) {
//       if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
//       blog.image = createImageData(req.files.coverImage[0]);
//     }

//     if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
//       if (blog.bodyImages?.image1?.publicId)
//         await destroyPublicId(blog.bodyImages.image1.publicId);
//       if (!blog.bodyImages) blog.bodyImages = {};
//       blog.bodyImages.image1 = null;
//     } else if (req.files?.bodyImage1?.[0]) {
//       if (blog.bodyImages?.image1?.publicId)
//         await destroyPublicId(blog.bodyImages.image1.publicId);
//       if (!blog.bodyImages) blog.bodyImages = {};
//       blog.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
//     }

//     if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
//       if (blog.bodyImages?.image2?.publicId)
//         await destroyPublicId(blog.bodyImages.image2.publicId);
//       if (!blog.bodyImages) blog.bodyImages = {};
//       blog.bodyImages.image2 = null;
//     } else if (req.files?.bodyImage2?.[0]) {
//       if (blog.bodyImages?.image2?.publicId)
//         await destroyPublicId(blog.bodyImages.image2.publicId);
//       if (!blog.bodyImages) blog.bodyImages = {};
//       blog.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
//     }

//     await blog.save();

//     // Update agent link arrays
//     const blogForAgent = {
//       blogId: blog._id,
//       title: blog.content?.title || blog.metadata?.title || "Untitled",
//       description:
//         blog.metadata?.description || blog.content?.title || "Untitled",
//       slug: blog.metadata?.slug || "",
//       // imageUrl: pickImageUrl(blog.image),
//       imageUrl: blog.image,
//       isPublished: blog.isPublished || false,
//       publishedAt: blog.publishedAt || null,
//       createdAt: blog.createdAt,
//       updatedAt: blog.updatedAt,
//     };
//     if (agentChanged) {
//       try {
//         const oldAgent = await Agent.findOne({ agentId: oldAgentId });
//         if (oldAgent) {
//           oldAgent.blogs = (oldAgent.blogs || []).filter(
//             (b) => String(b.blogId) !== String(blog._id)
//           );
//           await oldAgent.save({ validateBeforeSave: false });
//         }
//       } catch (e) {
//         console.warn("Old agent unlink warning:", e.message);
//       }
//       try {
//         const newAgent = await Agent.findOne({ agentId: blog.author.agentId });
//         if (newAgent?.addOrUpdateBlog) {
//           newAgent.addOrUpdateBlog(blogForAgent);
//           await newAgent.save({ validateBeforeSave: false });
//         }
//       } catch (e) {
//         console.warn("New agent link warning:", e.message);
//       }
//     } else {
//       try {
//         const currentAgent = await Agent.findOne({
//           agentId: blog.author.agentId,
//         });
//         if (currentAgent?.addOrUpdateBlog) {
//           currentAgent.addOrUpdateBlog(blogForAgent);
//           await currentAgent.save({ validateBeforeSave: false });
//         }
//       } catch (e) {
//         console.warn("Agent blog update warning:", e.message);
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: agentChanged ? "Blog updated & reassigned" : "Blog updated",
//       data: {
//         blog,
//         stats: blog.getContentStats?.(),
//         linkedAgent: {
//           agentId: blog.author.agentId,
//           agentName: blog.author.agentName,
//           email: blog.author.agentEmail,
//         },
//         agentChanged,
//       },
//     });
//   } catch (error) {
//     console.error("BLOG UPDATE ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update blog",
//       error: error.message,
//     });
//   }
// };

// // ---------- READS ----------
// const GetAllBlogs = async (req, res) => {
//   try {
//     const { showAll } = req.query;

//     let filter = {};

//     // 🔹 If showAll=true → return ALL blogs
//     if (showAll === "True") {
//       filter = {}; // no filter
//     } else {
//       filter = { status: "published", isPublished: true };
//     }

//     const blogs = await Blog.find(filter);
//     // .populate("author.agentId", "agentName email imageUrl designation")
//     // .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       message: "Blogs fetched successfully",
//       totalBlogs: blogs.length,
//       data: blogs,
//     });
//   } catch (error) {
//     console.error("GetAllBlogs error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blogs",
//       error: error.message,
//     });
//   }
// };

// const getSingleBlog = async (req, res) => {
//   try {
//     const blogId = req.query.id;
//     if (!blogId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Blog ID is required" });
//     }

//     const blog = await Blog.findById(blogId).populate(
//       "author.agentId",
//       "agentName email imageUrl designation specialistAreas phone whatsapp description"
//     );

//     if (!blog)
//       return res
//         .status(404)
//         .json({ success: false, message: "Blog not found" });

//     res.status(200).json({
//       success: true,
//       message: "Blog fetched successfully",
//       data: blog,
//     });
//   } catch (error) {
//     console.error("getSingleBlog error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blog",
//       error: error.message,
//     });
//   }
// };

// const getBlogsByTags = async (req, res) => {
//   try {
//     const { tags, limit = 6, excludeId } = req.query;

//     console.log("This is the tags", tags);
//     if (!tags) {
//       return res.status(400).json({
//         success: false,
//         message: "Tags are required. Pass tags as comma-separated values.",
//       });
//     }
//     const tagsArray = tags
//       .split(",")
//       .map((t) => t.trim().toLowerCase())
//       .filter(Boolean);

//     const query = { "metadata.tags": { $in: tagsArray } };
//     if (excludeId) query._id = { $ne: excludeId };

//     const blogs = await Blog.find(query)
//       .populate("author.agentId", "agentName email imageUrl designation")
//       .sort({ createdAt: -1 })
//       .limit(parseInt(limit, 10));

//     const blogsWithScore = blogs
//       .map((b) => {
//         const matchingTags = (b.metadata.tags || []).filter((t) =>
//           tagsArray.includes(String(t).toLowerCase())
//         );
//         return {
//           ...b.toObject(),
//           matchScore: matchingTags.length,
//           matchingTags,
//         };
//       })
//       .sort((a, b) => b.matchScore - a.matchScore);

//     res.status(200).json({
//       success: true,
//       message: "Blogs with matching tags fetched successfully",
//       count: blogsWithScore.length,
//       searchedTags: tagsArray,
//       data: blogsWithScore,
//     });
//   } catch (error) {
//     console.error("getBlogsByTags error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch blogs by tags",
//       error: error.message,
//     });
//   }
// };

// // ---------- DELETE ----------
// const deleteBlog = async (req, res) => {
//   try {
//     const blogId = req.query.id || req.body.id;
//     if (!blogId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Blog ID is required" });
//     }

//     const blog = await Blog.findById(blogId);
//     if (!blog)
//       return res
//         .status(404)
//         .json({ success: false, message: "Blog not found" });

//     // Remove from agent.blogs
//     try {
//       const agent = await Agent.findOne({ agentId: blog.author.agentId });
//       if (agent?.removeBlog) {
//         agent.removeBlog(blog._id);
//         await agent.save({ validateBeforeSave: false });
//       }
//     } catch (e) {
//       console.warn("Agent unlink warning:", e.message);
//     }

//     // Destroy Cloudinary images
//     if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
//     if (blog.bodyImages?.image1?.publicId)
//       await destroyPublicId(blog.bodyImages.image1.publicId);
//     if (blog.bodyImages?.image2?.publicId)
//       await destroyPublicId(blog.bodyImages.image2.publicId);

//     await Blog.findByIdAndDelete(blogId);

//     res.status(200).json({
//       success: true,
//       message: "Blog and associated images deleted successfully",
//     });
//   } catch (error) {
//     console.error("deleteBlog error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete blog",
//       error: error.message,
//     });
//   }
// };

// // ---------- LIST BY AGENT ----------
// const getBlogsByAgent = async (req, res) => {
//   try {
//     const { agentId } = req.params;
//     const { published, page = 1, limit = 10 } = req.query;

//     if (!agentId)
//       return res
//         .status(400)
//         .json({ success: false, message: "Agent ID is required" });

//     const filter = { "author.agentId": agentId };
//     if (published !== undefined) filter.isPublished = published === "true";

//     const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

//     const [blogs, totalBlogs] = await Promise.all([
//       Blog.find(filter)
//         .populate("author.agentId", "agentName email imageUrl designation")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(parseInt(limit, 10)),
//       Blog.countDocuments(filter),
//     ]);

//     res.status(200).json({
//       success: true,
//       message: "Agent blogs fetched successfully",
//       data: {
//         blogs,
//         pagination: {
//           currentPage: parseInt(page, 10),
//           totalPages: Math.ceil(totalBlogs / parseInt(limit, 10)),
//           totalBlogs,
//           hasNext: parseInt(page, 10) * parseInt(limit, 10) < totalBlogs,
//           hasPrev: parseInt(page, 10) > 1,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("getBlogsByAgent error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch agent blogs",
//       error: error.message,
//     });
//   }
// };

// // ---------- AGENTS WITH BLOGS ----------
// const getAgentsWithBlogs = async (req, res) => {
//   try {
//     const { limit = 20 } = req.query;
//     const agentsWithBlogs = await Agent.findAgentsWithBlogs(
//       parseInt(limit, 10)
//     );
//     res.status(200).json({
//       success: true,
//       message: "Agents with blogs fetched successfully",
//       data: agentsWithBlogs,
//     });
//   } catch (error) {
//     console.error("getAgentsWithBlogs error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch agents with blogs",
//       error: error.message,
//     });
//   }
// };

// // ---------- PUBLISH TOGGLE ----------
// const toggleBlogPublishStatus = async (req, res) => {
//   try {
//     const { blogId } = req.params;
//     const { publish } = req.body;
//     if (!blogId)
//       return res
//         .status(400)
//         .json({ success: false, message: "Blog ID is required" });

//     const blog = await Blog.findById(blogId);
//     if (!blog)
//       return res
//         .status(404)
//         .json({ success: false, message: "Blog not found" });

//     const result =
//       publish === true || publish === "true"
//         ? await blog.publish()
//         : await blog.unpublish();

//     try {
//       const agent = await Agent.findOne({ agentId: blog.author.agentId });
//       if (agent?.addOrUpdateBlog) {
//         agent.addOrUpdateBlog({
//           blogId: blog._id,
//           title: blog.content?.title || blog.metadata?.title || "",
//           description: blog.metadata?.description,
//           slug: blog.metadata?.slug || "",
//           isPublished: blog.isPublished,
//           publishedAt: blog.publishedAt,
//         });
//         await agent.save({ validateBeforeSave: false });
//       }
//     } catch (e) {
//       console.warn("Agent publish toggle link warning:", e.message);
//     }

//     res.status(200).json({
//       success: true,
//       message: `Blog ${publish ? "published" : "unpublished"} successfully`,
//       data: result,
//     });
//   } catch (error) {
//     console.error("toggleBlogPublishStatus error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to toggle blog publish status",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   // upload middleware first (multi-field)
//   upload,
//   // CRUD
//   GetAllBlogs,
//   getSingleBlog,
//   getBlogsByTags,
//   createBlog,
//   updateBlog,
//   deleteBlog,
//   getBlogsByAgent,
//   getAgentsWithBlogs,
//   toggleBlogPublishStatus,
// };


const Blog = require("../Models/BlogsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");


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
  // console.log("UPdating")
  // console.log("BODY", req.body)
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
        };
        blog.markModified("author");
        console.log("Updated blog author to new agent:", newAgentEmail);
      }
    }

    // Update basic fields
    if (title) {
      // console.log("UPDATING title from:", blog.title, "to:", title.trim());
    
      blog.title = title.trim();
    }

    if (Description !== undefined) {
      blog.description = Description.trim();
    }

    if (metaTitle) {
      // console.log("UPDATING metaTitle from:", blog.metaInfo?.metaTitle, "to:", metaTitle.trim());
      if (!blog.metaInfo) blog.metaInfo = {};
      blog.metaInfo.metaTitle = metaTitle.trim();
      blog.markModified("metaInfo");
    }

    if (metaDescription !== undefined) {
      // console.log("UPDATING metaDescription");
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
      // console.log("UPDATING htmlContent, length:", htmlContent.length);
      const plainText = stripHtmlTags(htmlContent);

      if (!blog.content) blog.content = {};
      blog.content.htmlContent = htmlContent;
      blog.content.plainText = plainText;
      blog.markModified("content");
      // console.log("Content updated");
    }

    // Update cover image if new one is uploaded
    if (req.files?.coverImage?.[0]) {
      // console.log("NEW COVER IMAGE UPLOADED");
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
        // Delete old body image from Cloudinary if exists
        if (blog.bodyImages?.[i - 1]?.publicId) {
          try {
            await destroyPublicId(blog.bodyImages[i - 1].publicId);
            console.log(`Old body image ${i} deleted from Cloudinary`);
          } catch (err) {
            console.error(`Error deleting old body image ${i}:`, err);
          }
        }
        // Add or update the body image
        if (!blog.bodyImages) blog.bodyImages = [];
        blog.bodyImages[i - 1] = createImageData(req.files[fieldName][0]);
      }
    }

    // Update status and publish date
    if (status) {
      const blogStatus = status === "published" ? "published" : "draft";
      const wasPublished = blog.isPublished;
      
      blog.status = blogStatus;
      blog.isPublished = blogStatus === "published";

      // Handle publish date
      if (publishedAt) {
        // Use provided publish date
        blog.publishedAt = new Date(publishedAt);
        // console.log("Using provided publishedAt:", blog.publishedAt);
      } else if (blogStatus === "published" && !wasPublished) {
        // First time publishing - set to now if no date provided
        blog.publishedAt = new Date();
        // console.log("First time publishing - setting publishedAt to now");
      } else if (blogStatus === "draft") {
        // Changed to draft - clear publish date
        blog.publishedAt = null;
        // console.log("Changed to draft - clearing publishedAt");
      }
      // If staying published and date already exists, keep the existing date

      // console.log(`Status updated: ${blogStatus}, isPublished: ${blog.isPublished}`);
    } else if (publishedAt) {
      // Update publish date even if status wasn't changed
      blog.publishedAt = new Date(publishedAt);
      // console.log("Updated publishedAt without status change:", blog.publishedAt);
    }

    // Save the updated blog
    const updatedBlog = await blog.save();
    // console.log("BLOG SAVED SUCCESSFULLY");

    // Handle agent reassignment in Agent collection
    if (agentChanged && oldAgentEmail) {
      try {
        // Remove blog from old agent's blogs array
        await Agent.findOneAndUpdate(
          { email: oldAgentEmail },
          { $pull: { blogs: { blogId: updatedBlog._id } } }
        );
        // console.log("Removed blog from old agent:", oldAgentEmail);

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
          // console.log("Added blog to new agent:", newAgent.email);
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
        // console.log("Updated blog info in agent's blogs array");
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

const GetAllBlogs = async (req, res) => {
  try {
    const { isPublished } = req.query;

    const filter = {};
    if (isPublished !== undefined) {
      filter.isPublished = isPublished === "true";
    }

    const blogs = await Blog.find(filter)
      .select(
        "_id title description coverImage metaInfo isPublished publishedAt author createdAt"
      )
      .populate(
        "author",
        "agentName email imageUrl designation"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalBlogs: blogs.length,
      data: blogs,
    });
  } catch (error) {
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
      "author.agentEmail",
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

    // ✅ Apply published filter ONLY if param is passed
    if (isPublished !== undefined) {
      query.isPublished = isPublished === "true";
    }

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const data = blogs
      .map((b) => {
        const matchingTags = (b.metaInfo?.tags || []).filter((t) =>
          tagsArray.includes(String(t).toLowerCase())
        );

        return {
          _id: b._id,
          title: b.metaInfo?.metaTitle || b.title,
          isPublished: b.isPublished,
          status: b.status,
          coverImage: b.coverImage,
          metaInfo: b.metaInfo,
          matchScore: matchingTags.length,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      message: "Blogs with matching tags fetched successfully",
      count: data.length,
      data,
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
// const deleteBlog = async (req, res) => {
//   try {
//     const blogId = req.query.id || req.body.id;
//     if (!blogId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Blog ID is required" });
//     }

//     const blog = await Blog.findById(blogId);
//     if (!blog)
//       return res
//         .status(404)
//         .json({ success: false, message: "Blog not found" });

//     // Remove from agent.blogs
//     try {
//       const agent = await Agent.findOne({ agentId: blog.author.agentEmail });
//       if (agent?.removeBlog) {
//         agent.removeBlog(blog._id);
//         await agent.save({ validateBeforeSave: false });
//       }
//     } catch (e) {
//       console.warn("Agent unlink warning:", e.message);
//     }

//     // Destroy Cloudinary images
//     if (blog.image?.publicId) await destroyPublicId(blog.image.publicId);
//     if (blog.bodyImages?.image1?.publicId)
//       await destroyPublicId(blog.bodyImages.image1.publicId);
//     if (blog.bodyImages?.image2?.publicId)
//       await destroyPublicId(blog.bodyImages.image2.publicId);

//     await Blog.findByIdAndDelete(blogId);

//     res.status(200).json({
//       success: true,
//       message: "Blog and associated images deleted successfully",
//     });
//   } catch (error) {
//     console.error("deleteBlog error:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete blog",
//       error: error.message,
//     });
//   }
// };
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
};