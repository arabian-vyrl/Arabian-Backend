const LandingPage = require("../Models/LandingPageModel");

const pageId = "abu-dhabi-briefing";

function requiredText(value, label, limit) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
    throw new Error(label + " must contain 1 to " + limit + " characters.");
  }
  return value.trim();
}

function list(value, label, minimum, maximum = 100) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(label + " must contain " + (minimum === maximum ? minimum : minimum + " to " + maximum) + " items.");
  }
  return value;
}

function youtubeLink(value, label) {
  try {
    const url = new URL(requiredText(value, label, 500));
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    const path = url.pathname.split("/").filter(Boolean);
    let id;
    if (url.hostname === "youtu.be") id = path[0];
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)) {
      if (path[0] === "watch") id = url.searchParams.get("v");
      if (["shorts", "embed", "live", "v"].includes(path[0])) id = path[1];
    }
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error();
    return "https://www.youtube.com/watch?v=" + id;
  } catch {
    throw new Error(label + " must be a valid YouTube video link.");
  }
}

function validateContent(input) {
  const eventAt = input?.eventAt;
  const instant = typeof eventAt === "string" && new Date(eventAt);
  if (!instant || !Number.isFinite(instant.getTime()) || instant.toISOString() !== eventAt) {
    throw new Error("Enter a valid event date and time.");
  }

  return {
    title: requiredText(input.title, "Title", 200),
    subtitle: requiredText(input.subtitle, "Subtitle", 1000),
    eventAt,
    hostVideoUrl: input.hostVideoUrl === "" ? "" : youtubeLink(input.hostVideoUrl, "Host video"),
    outcomes: list(input.outcomes, "Outcomes", 5, 5).map((text, index) => requiredText(text, "Outcome " + (index + 1), 1000)),
    whyTitle: requiredText(input.whyTitle, "Why this session title", 200),
    whyDescription: requiredText(input.whyDescription, "Why this session description", 10000),
    agenda: list(input.agenda, "Agenda", 1).map((item, index) => ({
      title: requiredText(item?.title, "Agenda item " + (index + 1) + " title", 200),
      description: requiredText(item?.description, "Agenda item " + (index + 1) + " description", 3000),
    })),
    audience: list(input.audience, "Audience", 1).map((text, index) => requiredText(text, "Audience point " + (index + 1), 1000)),
    clientVideoUrls: list(input.clientVideoUrls, "Client videos", 0).map((url, index) => youtubeLink(url, "Client video " + (index + 1))),
  };
}

async function getLandingPage(req, res, next) {
  try {
    const page = await LandingPage.findById(pageId).lean();
    res.set("Cache-Control", "no-store").json({ content: page?.content ?? null });
  } catch (error) {
    next(error);
  }
}

async function updateLandingPage(req, res, next) {
  if (req.user?.role !== "admin" || req.user.email !== process.env.DASHBOARD_ADMIN_EMAIL) {
    return res.status(403).json({ message: "Admin access is required." });
  }

  let content;
  try {
    content = validateContent(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    await LandingPage.updateOne({ _id: pageId }, { $set: { content } }, { upsert: true });
    return res.json({ content });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getLandingPage, updateLandingPage };
