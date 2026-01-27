// controllers/NewsController.js
const News = require("../Models/NewsModel");
const Agent = require("../Models/AgentModel");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* ---------- Helper Functions ---------- */
const stripHtmlTags = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* ---------- Cloudinary Multer Storage (multi-field, same as Blog) ---------- */
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const fileFilter = (_req, file, cb) => {
  const ok = (file.mimetype || "").startsWith("image/");
  if (!ok) return cb(new Error("Only image files are allowed!"), false);
  cb(null, true);
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = "news";
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
  console.log("Creating News");
  console.log("BODY", req.body);
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
    if (!title || title.trim() === "") return res.status(400).json({ success: false, message: "News title is required" });
    if (!htmlContent || htmlContent.trim() === "") return res.status(400).json({ success: false, message: "News content is required" });

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

    const newsStatus = status === "published" ? "published" : "draft";
    const isPublished = newsStatus === "published";

    const newNews = new News({
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
      description: Description?.trim() || "",
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
      status: newsStatus,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    });

    const savedNews = await newNews.save();

    await Agent.findByIdAndUpdate(
      agent._id,
      {
        $push: {
          news: {
            newsId: savedNews._id,
            title: savedNews.title,
            slug: savedNews.slug || "",
            description: savedNews.metaInfo?.metaDescription || savedNews.description || "",
            imageUrl: savedNews.coverImage?.url || null,
            isPublished: savedNews.isPublished,
            publishedAt: savedNews.publishedAt,
            createdAt: savedNews.createdAt,
            updatedAt: savedNews.updatedAt,
          },
        },
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: `News ${isPublished ? "published" : "saved as draft"} successfully`,
      savedNews,
    });
  } catch (error) {
    console.error("NEWS CREATE ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to create news", error: error.message });
  }
};

const updateNews = async (req, res) => {
  console.log("Working")
  try {
    const { id } = req.query;
    console.log("UPDATE REQUEST - ID:", id);
    console.log("UPDATE REQUEST - BODY:", req.body);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "News ID is required in URL parameters",
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

    // Find the news
    const news = await News.findById(id);
    if (!news) {
      console.log("News NOT FOUND - ID:", id);
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    console.log("News FOUND - Current title:", news.title);

    let agentChanged = false;
    let oldAgentEmail = null;
    let newAgent = null;

    // Handle agent email change
    if (agentEmail) {
      const newAgentEmail = agentEmail.toLowerCase().trim();
      const currentAgentEmail = news.author?.agentEmail?.toLowerCase();

      // Check if agent email is different
      if (currentAgentEmail !== newAgentEmail) {
        console.log("AGENT EMAIL CHANGE DETECTED - from:", currentAgentEmail, "to:", newAgentEmail);

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

        // Update news author information
        news.author = {
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
        news.markModified("author");
        console.log("Updated news author to new agent:", newAgentEmail);
      }else{
        const currentAgent = await Agent.findOne({ email: news.author.agentEmail });
                if (currentAgent) {
                  news.author.agentSocialMedia = {
                    instagram: currentAgent?.instagram || "",
                    linkedin: currentAgent?.linkedin || "",
                  };
                  news.author.agentImage = {
                    url: currentAgent?.imageUrl || "",
                  };
                  news.author.agentName = currentAgent.agentName;
                  news.markModified("author");
                  console.log("Updated author social media links for same agent");
                }
      }
    }

    // Update basic fields
    if (title) {
      console.log("UPDATING title from:", news.title, "to:", title.trim());
      news.title = title.trim();
    }

    if (Description !== undefined) {
      news.description = Description.trim();
    }

    if (metaTitle) {
      console.log("UPDATING metaTitle from:", news.metaInfo?.metaTitle, "to:", metaTitle.trim());
      if (!news.metaInfo) news.metaInfo = {};
      news.metaInfo.metaTitle = metaTitle.trim();
      news.markModified("metaInfo");
    }

    if (metaDescription !== undefined) {
      console.log("UPDATING metaDescription");
      if (!news.metaInfo) news.metaInfo = {};
      news.metaInfo.metaDescription = metaDescription.trim();
      news.markModified("metaInfo");
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
      if (!news.metaInfo) news.metaInfo = {};
      news.metaInfo.tags = tagsArray;
      news.markModified("metaInfo");
    }

    // Update content
    if (htmlContent) {
      console.log("UPDATING htmlContent, length:", htmlContent.length);
      const plainText = stripHtmlTags(htmlContent);

      if (!news.content) news.content = {};
      news.content.htmlContent = htmlContent;
      news.content.plainText = plainText;
      news.markModified("content");
      console.log("Content updated");
    }

    // Update cover image if new one is uploaded
    if (req.files?.coverImage?.[0]) {
      console.log("NEW COVER IMAGE UPLOADED");
      // Delete old image from Cloudinary if exists
      if (news.coverImage?.publicId) {
        try {
          await destroyPublicId(news.coverImage.publicId);
          console.log("Old cover image deleted from Cloudinary");
        } catch (err) {
          console.error("Error deleting old cover image:", err);
        }
      }
      news.coverImage = createImageData(req.files.coverImage[0]);
    }

    // Update body images if new ones are uploaded
    for (let i = 1; i <= 7; i++) {
      const fieldName = `bodyImage${i}`;
      if (req.files?.[fieldName]?.[0]) {
        console.log(`NEW BODY IMAGE ${i} UPLOADED`);
        // Delete old body image from Cloudinary if exists
        if (news.bodyImages?.[i - 1]?.publicId) {
          try {
            await destroyPublicId(news.bodyImages[i - 1].publicId);
            console.log(`Old body image ${i} deleted from Cloudinary`);
          } catch (err) {
            console.error(`Error deleting old body image ${i}:`, err);
          }
        }
        // Add or update the body image
        if (!news.bodyImages) news.bodyImages = [];
        news.bodyImages[i - 1] = createImageData(req.files[fieldName][0]);
      }
    }

    // Update status and publish date
    if (status) {
      const NewsStatus = status === "published" ? "published" : "draft";
      const wasPublished = news.isPublished;
      
      news.status = NewsStatus;
      news.isPublished = NewsStatus === "published";

      // Handle publish date
      if (publishedAt) {
        // Use provided publish date
        news.publishedAt = new Date(publishedAt);
        console.log("Using provided publishedAt:", news.publishedAt);
      } else if (NewsStatus === "published" && !wasPublished) {
        // First time publishing - set to now if no date provided
        news.publishedAt = new Date();
        console.log("First time publishing - setting publishedAt to now");
      } else if (NewsStatus === "draft") {
        // Changed to draft - clear publish date
        news.publishedAt = null;
        console.log("Changed to draft - clearing publishedAt");
      }
      // If staying published and date already exists, keep the existing date

      console.log(`Status updated: ${NewsStatus}, isPublished: ${news.isPublished}`);
    } else if (publishedAt) {
      // Update publish date even if status wasn't changed
      news.publishedAt = new Date(publishedAt);
      console.log("Updated publishedAt without status change:", news.publishedAt);
    }

    // Save the updated news
    const updatedNews = await news.save();
    console.log("News SAVED SUCCESSFULLY");

    // Handle agent reassignment in Agent collection
    if (agentChanged && oldAgentEmail) {
      try {
        // Remove news from old agent's News array
        await Agent.findOneAndUpdate(
          { email: oldAgentEmail },
          { $pull: { news: { newsId: updatedNews._id } } }
        );
        console.log("Removed News from old agent:", oldAgentEmail);

        // Add News to new agent's News array
        if (newAgent) {
          await Agent.findByIdAndUpdate(newAgent._id, {
            $push: {
              news: {
                newsId: updatedNews._id,
                title: updatedNews.title,
                slug: updatedNews.slug || "",
                description: updatedNews.metaInfo?.metaDescription || updatedNews.description || "",
                imageUrl: updatedNews.coverImage?.url || null,
                isPublished: updatedNews.isPublished,
                publishedAt: updatedNews.publishedAt,
                createdAt: updatedNews.createdAt,
                updatedAt: updatedNews.updatedAt,
              },
            },
          });
          console.log("Added news to new agent:", newAgent.email);
        }
      } catch (err) {
        console.error("Error updating agent news array:", err);
      }
    } else if (agentEmail && news.author?.agentEmail) {
      // If same agent, update the news info in agent's news array
      try {
        await Agent.findOneAndUpdate(
          { email: news.author.agentEmail, "news.newsId": updatedNews._id },
          {
            $set: {
              "news.$.title": updatedNews.title,
              "news.$.slug": updatedNews.slug || "",
              "news.$.description": updatedNews.metaInfo?.metaDescription || updatedNews.description || "",
              "news.$.imageUrl": updatedNews.coverImage?.url || null,
              "news.$.isPublished": updatedNews.isPublished,
              "news.$.publishedAt": updatedNews.publishedAt,
              "news.$.updatedAt": updatedNews.updatedAt,
            },
          }
        );
        console.log("Updated News info in agent's News array");
      } catch (err) {
        console.error("Error updating News in agent's array:", err);
      }
    }

    console.log("News UPDATED SUCCESSFULLY - New title:", updatedNews.title);

    res.status(200).json({
      success: true,
      message: agentChanged 
        ? "News updated and reassigned to new agent successfully" 
        : "News updated successfully",
      data: { 
        news: updatedNews,
        agentChanged,
      },
    });
  } catch (error) {
    console.error("UPDATE News ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update News",
      error: error.message,
    });
  }
};

/* ---------- READS ---------- */
const GetAllNews = async (req, res) => {
  try {
    const { isPublished, isViewing } = req.query;

    const filter = {};
    if (isPublished !== undefined) {
      filter.isPublished = isPublished === "true";
    }

    // Base fields
    let selectFields =
      "_id title slug description coverImage metaInfo isPublished publishedAt author createdAt";
    // If viewing a single/full news item
    if (isViewing === "true") {
      selectFields += " content";
    }

    const newsItems = await News.find(filter)
      .select(selectFields)
      .populate(
        "author",
        "agentName email imageUrl designation"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
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

    const news = await News.findById(newsId)

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

const getNewsBySlug = async (req, res) => {
  try {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "News slug is required",
      });
    }

    const news = await News.findOne({ slug });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "News fetched successfully",
      data: news,
    });
  } catch (error) {
    console.error("getNewsBySlug error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch news",
      error: error.message,
    });
  }
};

const getNewsByTags = async (req, res) => {
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

    const items = await News.find(query)
      .select({
        title: 1,
        slug: 1,
        isPublished: 1,
        status: 1,
        coverImage: 1,
        metaInfo: 1,
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const data = items
      .map((n) => {
        const matchingTags = (n.metaInfo?.tags || []).filter((t) =>
          tagsArray.includes(String(t).toLowerCase())
        );

        return {
          _id: n._id,
          title: n.title || n.metaInfo.metaTitle,
          isPublished: n.isPublished,
          slug: n.slug,
          status: n.status,
          coverImage: n.coverImage,
          metaInfo: n.metaInfo,
          matchScore: matchingTags.length,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      message: "News with matching tags fetched successfully",
      count: data.length,
      data,
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
    const newsId = req.query.id;
    if (!newsId) {
      return res.status(400).json({
        success: false,
        message: "News ID is required",
      });
    }

    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }
    const agent = await Agent.findOne({
      email: news.author.agentEmail,
    });

    if (agent) {
      agent.news = agent.news.filter(
        (n) => n.newsId.toString() !== newsId
      );
      await agent.save({ validateBeforeSave: false });
    }
    if (news.image?.publicId) {
      await destroyPublicId(news.image.publicId);
    }

    if (news.bodyImages) {
      for (const key in news.bodyImages) {
        if (news.bodyImages[key]?.publicId) {
          await destroyPublicId(news.bodyImages[key].publicId);
        }
      }
    }
    await News.findByIdAndDelete(newsId);

    return res.status(200).json({
      success: true,
      message: "News and associated images deleted successfully",
    });
  } catch (error) {
    console.error("Delete News error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete News",
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
  getNewsBySlug,
  getNewsByTags,
  createNews,
  updateNews,
  deleteNews,
  getNewsByAgent,
  getAgentsWithNews,
  toggleNewsPublishStatus,
};