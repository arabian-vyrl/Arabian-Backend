// controllers/NewsController.js
const News = require("../Models/NewsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* ---------- Cloudinary Multer Storage (multi-field, same as Blog) ---------- */
function ensureFilename(img) {
  if (!img) return img;
  if (img.filename) return img;
  const fromPublicId = img.publicId || img.public_id;
  if (fromPublicId) return { ...img, filename: fromPublicId };
  if (img.url) {
    const base = img.url.split("/").pop() || "";
    const noQuery = base.split("?")[0];
    const noExt = noQuery.replace(/\.[a-z0-9]+$/i, "");
    return { ...img, filename: noExt || "unknown" };
  }
  return { ...img, filename: "unknown" };
}

const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const fileFilter = (_req, file, cb) => {
  const ok = (file.mimetype || "").startsWith("image/");
  if (!ok) return cb(new Error("Only image files are allowed!"), false);
  cb(null, true);
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = "news"; // separate folder from blogs
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

/* ---------- Helpers ---------- */
const createImageData = (file) => {
  if (!file) return null;
  return {
    url: file.path,
    publicId: file.filename,
    filename: file.filename,
    format: file.format,
    size: file.size,
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
    console.warn("⚠️ Cloudinary destroy failed (news):", publicId, e.message);
  }
};

/* ---------- CREATE ---------- */
const createNews = async (req, res) => {
  try {
    const { parsedData, agentId } = req.body;

    if (!parsedData) {
      return res.status(400).json({
        success: false,
        message: "parsedData is required",
      });
    }
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "agentId is required",
      });
    }

    // Parse parsedData (JSON or plain text → News.parseTextToNewsStructure)
    let newsData;
    try {
      if (typeof parsedData === "string") {
        if (parsedData.trim().startsWith("{")) {
          newsData = JSON.parse(parsedData);
        } else {
          newsData = News.parseTextToNewsStructure(parsedData);
        }
      } else if (typeof parsedData === "object" && parsedData !== null) {
        newsData = parsedData;
      } else {
        throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Failed to parse news data",
        error: e.message,
      });
    }

    // Validate content/title
    if (!newsData?.content?.title) {
      return res.status(400).json({
        success: false,
        message: "News content and title are required",
      });
    }
    if (!Array.isArray(newsData.content.sections)) {
      return res.status(400).json({
        success: false,
        message: "News content sections are required and must be an array",
      });
    }

    // Validate agent (by custom string agentId, same as Blog)
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

    // Handle images (Cloudinary URLs like Blog)
    const coverImageData = req.files?.coverImage?.[0]
      ? createImageData(req.files.coverImage[0])
      : null;
    const bodyImage1Data = req.files?.bodyImage1?.[0]
      ? createImageData(req.files.bodyImage1[0])
      : null;
    const bodyImage2Data = req.files?.bodyImage2?.[0]
      ? createImageData(req.files.bodyImage2[0])
      : null;

    // STATUS: same as Blog
    const isDraft = newsData.status === "draft";

    // Create news doc
    const newNews = new News({
      originalId:
        newsData.id ||
        `news_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: {
        title: newsData.metadata?.title || newsData.content.title,
        description:
          newsData.metadata?.description || newsData.seo?.metaDescription || "",
        author: newsData.metadata?.author || agent.agentName,
        tags: newsData.metadata?.tags || [],
        category: newsData.metadata?.category || "",
        slug: newsData.metadata?.slug || null,
      },
      content: {
        title: newsData.content.title,
        sections: newsData.content.sections || [],
        wordCount: newsData.content.wordCount || 0,
        readingTime: newsData.content.readingTime || 0,
      },
      seo: {
        metaTitle: newsData.seo?.metaTitle || "",
        metaDescription: newsData.seo?.metaDescription || "",
        keywords: newsData.seo?.keywords || [],
      },
      author: {
        agentId: agent.agentId,
        agentName: agent.agentName,
        agentEmail: agent.email,
        agentImage: agent.imageUrl,
      },
      image: coverImageData,
      bodyImages: {
        image1: bodyImage1Data,
        image2: bodyImage2Data,
      },
      status: isDraft ? "draft" : "published",
      isPublished: !isDraft,
      publishedAt: !isDraft ? new Date() : null,
    });

    const savedNews = await newNews.save();

    // Optional: link to agent.news array (if helper exists)
    try {
      if (typeof agent.addOrUpdateNews === "function") {
        agent.addOrUpdateNews({
          newsId: savedNews._id,
          title: savedNews.content.title,
          slug: savedNews.metadata.slug,
          image: ensureFilename(savedNews.image),
          isPublished: savedNews.isPublished,
          publishedAt: savedNews.publishedAt,
          createdAt: savedNews.createdAt,
          updatedAt: savedNews.updatedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent news link warning:", e.message);
    }

    res.status(201).json({
      success: true,
      message: "News created successfully",
      data: {
        news: savedNews,
        stats: savedNews.getContentStats?.(),
        linkedAgent: {
          agentId: agent.agentId,
          agentName: agent.agentName,
          email: agent.email,
          imageUrl: agent.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error("NEWS CREATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create news",
      error: error.message,
    });
  }
};

/* ---------- UPDATE ---------- */
const updateNews = async (req, res) => {
  try {
    const {
      newsId,
      parsedData,
      agentId,
      removeBodyImage1,
      removeBodyImage2,
    } = req.body;

    if (!newsId) {
      return res
        .status(400)
        .json({ success: false, message: "newsId is required" });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    // Agent reassignment (same pattern as Blog)
    const oldAgentId = news.author.agentId;
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
      news.author.agentId = newAgent.agentId;
      news.author.agentName = newAgent.agentName;
      news.author.agentEmail = newAgent.email;
      news.author.agentImage = newAgent.imageUrl;
      agentChanged = true;
    }

    // Parse update content if provided
    if (parsedData) {
      let updateData;
      try {
        if (typeof parsedData === "string") {
          updateData = parsedData.trim().startsWith("{")
            ? JSON.parse(parsedData)
            : News.parseTextToNewsStructure(parsedData);
        } else if (typeof parsedData === "object") {
          updateData = parsedData;
        } else {
          throw new Error(`Invalid parsedData type: ${typeof parsedData}`);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Failed to parse news data",
          error: e.message,
        });
      }

      // metadata
      if (updateData.metadata) {
        const m = updateData.metadata;
        if (m.title !== undefined) news.metadata.title = m.title;
        if (m.description !== undefined)
          news.metadata.description = m.description;
        if (m.author !== undefined) news.metadata.author = m.author;
        if (m.tags !== undefined)
          news.metadata.tags = Array.isArray(m.tags) ? m.tags : [];
        if (m.category !== undefined) news.metadata.category = m.category;
        if (m.slug !== undefined) news.metadata.slug = m.slug;
      }

      // content
      if (updateData.content) {
        const c = updateData.content;
        if (c.title !== undefined) news.content.title = c.title;
        if (Array.isArray(c.sections)) news.content.sections = c.sections;
        if (c.wordCount !== undefined) news.content.wordCount = c.wordCount;
        if (c.readingTime !== undefined)
          news.content.readingTime = c.readingTime;
      }

      // seo
      if (updateData.seo) {
        const s = updateData.seo;
        if (s.metaTitle !== undefined) news.seo.metaTitle = s.metaTitle;
        if (s.metaDescription !== undefined)
          news.seo.metaDescription = s.metaDescription;
        if (s.keywords !== undefined)
          news.seo.keywords = Array.isArray(s.keywords) ? s.keywords : [];
      }

      // status
      if (updateData.status === "published" || updateData.status === "draft") {
        news.status = updateData.status;
        if (updateData.status === "published") {
          news.isPublished = true;
          if (!news.publishedAt) news.publishedAt = new Date();
        } else {
          news.isPublished = false;
          news.publishedAt = null;
        }
      }
    }

    // Images (replace + destroy old on Cloudinary)
    if (req.files?.coverImage?.[0]) {
      if (news.image?.publicId) await destroyPublicId(news.image.publicId);
      news.image = createImageData(req.files.coverImage[0]);
    }

    if (removeBodyImage1 === "true" || removeBodyImage1 === true) {
      if (news.bodyImages?.image1?.publicId)
        await destroyPublicId(news.bodyImages.image1.publicId);
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image1 = null;
    } else if (req.files?.bodyImage1?.[0]) {
      if (news.bodyImages?.image1?.publicId)
        await destroyPublicId(news.bodyImages.image1.publicId);
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image1 = createImageData(req.files.bodyImage1[0]);
    }

    if (removeBodyImage2 === "true" || removeBodyImage2 === true) {
      if (news.bodyImages?.image2?.publicId)
        await destroyPublicId(news.bodyImages.image2.publicId);
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image2 = null;
    } else if (req.files?.bodyImage2?.[0]) {
      if (news.bodyImages?.image2?.publicId)
        await destroyPublicId(news.bodyImages.image2.publicId);
      if (!news.bodyImages) news.bodyImages = {};
      news.bodyImages.image2 = createImageData(req.files.bodyImage2[0]);
    }

    await news.save();

    // Update agent link arrays
    const newsForAgent = {
      newsId: news._id,
      title: news.content?.title || news.metadata?.title || "Untitled",
      slug: news.metadata?.slug || "",
      image: ensureFilename(news.image),
      isPublished: news.isPublished || false,
      publishedAt: news.publishedAt || null,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
    };

    if (agentChanged) {
      try {
        // old agent
        const oldAgent = await Agent.findOne({ agentId: oldAgentId });
        if (oldAgent) {
          if (Array.isArray(oldAgent.news)) {
            oldAgent.news = oldAgent.news.filter(
              (n) => String(n.newsId) !== String(news._id)
            );
          } else if (typeof oldAgent.removeNews === "function") {
            oldAgent.removeNews(news._id);
          }
          await oldAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Old agent unlink warning (news):", e.message);
      }
      try {
        const newAgent = await Agent.findOne({ agentId: news.author.agentId });
        if (newAgent?.addOrUpdateNews) {
          newAgent.addOrUpdateNews(newsForAgent);
          await newAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("New agent link warning (news):", e.message);
      }
    } else {
      try {
        const currentAgent = await Agent.findOne({
          agentId: news.author.agentId,
        });
        if (currentAgent?.addOrUpdateNews) {
          currentAgent.addOrUpdateNews(newsForAgent);
          await currentAgent.save({ validateBeforeSave: false });
        }
      } catch (e) {
        console.warn("Agent news update warning:", e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: agentChanged ? "News updated & reassigned" : "News updated",
      data: {
        news,
        stats: news.getContentStats?.(),
        linkedAgent: {
          agentId: news.author.agentId,
          agentName: news.author.agentName,
          email: news.author.agentEmail,
        },
        agentChanged,
      },
    });
  } catch (error) {
    console.error("NEWS UPDATE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update news",
      error: error.message,
    });
  }
};

/* ---------- READS ---------- */
const GetAllNews = async (req, res) => {
  try {
    const { showAll } = req.query;

    let filter = {};
    if (showAll === "True") {
      filter = {};
    } else {
      filter = { status: "published", isPublished: true };
    }

    const newsItems = await News.find(filter)
      .populate({
        path: "agentDetails",
        select: "agentId agentName email imageUrl designation",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "News fetched successfully",
      totalNews: newsItems.length,
      data: newsItems,
    });
  } catch (error) {
    console.error("GetAllNews error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news",
      error: error.message,
    });
  }
};

const getSingleNews = async (req, res) => {
  try {
    const newsId = req.query.id;
    if (!newsId) {
      return res
        .status(400)
        .json({ success: false, message: "News ID is required" });
    }

    const news = await News.findById(newsId).populate({
      path: "agentDetails",
      select:
        "agentId agentName email imageUrl designation specialistAreas phone whatsapp description",
    });

    if (!news)
      return res
        .status(404)
        .json({ success: false, message: "News not found" });

    res.status(200).json({
      success: true,
      message: "News fetched successfully",
      data: news,
    });
  } catch (error) {
    console.error("getSingleNews error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news",
      error: error.message,
    });
  }
};

const getNewsByTags = async (req, res) => {
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

    const items = await News.find(query)
      .populate({
        path: "agentDetails",
        select: "agentId agentName email imageUrl designation",
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const withScore = items
      .map((n) => {
        const matchingTags = (n.metadata.tags || []).filter((t) =>
          tagsArray.includes(String(t).toLowerCase())
        );
        return {
          ...n.toObject(),
          matchScore: matchingTags.length,
          matchingTags,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      message: "News with matching tags fetched successfully",
      count: withScore.length,
      searchedTags: tagsArray,
      data: withScore,
    });
  } catch (error) {
    console.error("getNewsByTags error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news by tags",
      error: error.message,
    });
  }
};

/* ---------- DELETE ---------- */
const deleteNews = async (req, res) => {
  try {
    const newsId = req.query.id || req.body.id;
    if (!newsId) {
      return res
        .status(400)
        .json({ success: false, message: "News ID is required" });
    }

    const news = await News.findById(newsId);
    if (!news)
      return res
        .status(404)
        .json({ success: false, message: "News not found" });

    // Remove from agent.news
    try {
      const agent = await Agent.findOne({ agentId: news.author.agentId });
      if (agent) {
        if (typeof agent.removeNews === "function") {
          agent.removeNews(news._id);
        } else if (Array.isArray(agent.news)) {
          agent.news = agent.news.filter(
            (n) => String(n.newsId) !== String(news._id)
          );
        }
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent unlink warning (news):", e.message);
    }

    // Destroy Cloudinary images
    if (news.image?.publicId) await destroyPublicId(news.image.publicId);
    if (news.bodyImages?.image1?.publicId)
      await destroyPublicId(news.bodyImages.image1.publicId);
    if (news.bodyImages?.image2?.publicId)
      await destroyPublicId(news.bodyImages.image2.publicId);

    await News.findByIdAndDelete(newsId);

    res.status(200).json({
      success: true,
      message: "News and associated images deleted successfully",
    });
  } catch (error) {
    console.error("deleteNews error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete news",
      error: error.message,
    });
  }
};

/* ---------- LIST BY AGENT ---------- */
const getNewsByAgent = async (req, res) => {
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

    const [items, totalNews] = await Promise.all([
      News.find(filter)
        .populate({
          path: "agentDetails",
          select: "agentId agentName email imageUrl designation",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      News.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Agent news fetched successfully",
      data: {
        news: items,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalNews / parseInt(limit, 10)),
          totalNews,
          hasNext: parseInt(page, 10) * parseInt(limit, 10) < totalNews,
          hasPrev: parseInt(page, 10) > 1,
        },
      },
    });
  } catch (error) {
    console.error("getNewsByAgent error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent news",
      error: error.message,
    });
  }
};

/* ---------- AGENTS WITH NEWS ---------- */
const getAgentsWithNews = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    if (typeof Agent.findAgentsWithNews === "function") {
      const agentsWithNews = await Agent.findAgentsWithNews(
        parseInt(limit, 10)
      );
      return res.status(200).json({
        success: true,
        message: "Agents with news fetched successfully",
        data: agentsWithNews,
      });
    }

    const agentIds = await News.distinct("author.agentId");
    const agents = await Agent.find({ agentId: { $in: agentIds } })
      .limit(parseInt(limit, 10))
      .select("agentId agentName email imageUrl designation");

    res.status(200).json({
      success: true,
      message: "Agents with news fetched successfully",
      data: agents,
    });
  } catch (error) {
    console.error("getAgentsWithNews error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents with news",
      error: error.message,
    });
  }
};

/* ---------- PUBLISH TOGGLE ---------- */
const toggleNewsPublishStatus = async (req, res) => {
  try {
    const { newsId } = req.params;
    const { publish } = req.body;
    if (!newsId)
      return res
        .status(400)
        .json({ success: false, message: "News ID is required" });

    const news = await News.findById(newsId);
    if (!news)
      return res
        .status(404)
        .json({ success: false, message: "News not found" });

    const result =
      publish === true || publish === "true"
        ? await news.publish()
        : await news.unpublish();

    try {
      const agent = await Agent.findOne({ agentId: news.author.agentId });
      if (agent?.addOrUpdateNews) {
        agent.addOrUpdateNews({
          newsId: news._id,
          title: news.content?.title || news.metadata?.title || "",
          slug: news.metadata?.slug || "",
          isPublished: news.isPublished,
          publishedAt: news.publishedAt,
        });
        await agent.save({ validateBeforeSave: false });
      }
    } catch (e) {
      console.warn("Agent publish toggle link warning (news):", e.message);
    }

    res.status(200).json({
      success: true,
      message: `News ${publish ? "published" : "unpublished"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("toggleNewsPublishStatus error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle news publish status",
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  GetAllNews,
  getSingleNews,
  getNewsByTags,
  createNews,
  updateNews,
  deleteNews,
  getNewsByAgent,
  getAgentsWithNews,
  toggleNewsPublishStatus,
};
