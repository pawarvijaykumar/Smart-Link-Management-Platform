
import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
import crypto from "crypto";
import { parseUserAgent } from "../utils/userAgentParser.js";

const createLink = async (req, res) => {
  try {
    const { originalUrl } = req.body;

    // Check whether the URL was provided
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: "Original URL is required",
      });
    }

    // Generate a unique short code
    const shortCode = crypto.randomBytes(4).toString("hex");//Generates random bytes for a short code

    // Save the link in MongoDB
    const link = await Link.create({
      originalUrl,
      shortCode,
      user: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Short link created successfully",
      data: link,
    });
  } catch (error) {
    console.error("Create link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create short link",
    });
  }
};
// Redirect visitors to original URL while recording click details
const redirectLink = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOneAndUpdate(
      { shortCode },
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Short link not found",
      });
    }

    // Safely parse visitor device type and browser from User-Agent
    const userAgent = req.headers["user-agent"] || "";
    const { deviceType, browser } = parseUserAgent(userAgent);

    // Save individual click with timestamp, device, and browser
    await Click.create({
      link: link._id,
      clickedAt: new Date(),
      deviceType,
      browser,
    });

    return res.redirect(link.originalUrl);
  } catch (error) {
    console.error("Redirect link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to redirect",
    });
  }
};

// Calculate device breakdown, browser breakdown, and daily trends in IST
const calculateAnalytics = (clicks, totalClicks) => {
  const totalRecorded = clicks.length;

  const deviceCounts = {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    unknown: 0,
  };

  const browserCounts = {};
  const dailyMap = {};

  for (const click of clicks) {
    // 1. Device Breakdown
    const dev = click.deviceType || "unknown";
    if (deviceCounts[dev] !== undefined) {
      deviceCounts[dev] += 1;
    } else {
      deviceCounts.unknown += 1;
    }

    // 2. Browser Breakdown
    const br = click.browser || "Unknown";
    browserCounts[br] = (browserCounts[br] || 0) + 1;

    // 3. Daily Trends (Asia/Kolkata timezone)
    if (click.clickedAt) {
      const isoDateIST = new Date(click.clickedAt).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      const displayDate = new Date(click.clickedAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      });
      if (!dailyMap[isoDateIST]) {
        dailyMap[isoDateIST] = {
          isoDate: isoDateIST,
          date: displayDate,
          count: 0,
        };
      }
      dailyMap[isoDateIST].count += 1;
    }
  }

  const deviceLabels = {
    desktop: "Desktop",
    mobile: "Mobile",
    tablet: "Tablet",
    unknown: "Unknown",
  };

  const devices = Object.keys(deviceCounts)
    .filter((key) => deviceCounts[key] > 0 || totalRecorded === 0)
    .map((key) => ({
      key,
      name: deviceLabels[key] || key,
      count: deviceCounts[key],
      percentage:
        totalRecorded > 0
          ? Number(((deviceCounts[key] / totalRecorded) * 100).toFixed(1))
          : 0,
    }));

  const browsers = Object.entries(browserCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage:
        totalRecorded > 0
          ? Number(((count / totalRecorded) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const dailyTrends = Object.values(dailyMap)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map(({ date, count }) => ({ date, count }));

  return {
    totalClicks,
    totalRecordedClicks: totalRecorded,
    devices,
    browsers,
    dailyTrends,
  };
};

// Retrieve click history and analytics for a short link
const getClickHistory = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({
      shortCode,
      user: req.user.userId,
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    const clicks = await Click.find({
      link: link._id,
    }).sort({ clickedAt: -1 });

    const analytics = calculateAnalytics(clicks, link.clicks);

    const history = clicks.map((click) => ({
      _id: click._id,
      clickedAt: click.clickedAt,
      clickedAtIST: click.clickedAt
        ? new Date(click.clickedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
      deviceType: click.deviceType || "unknown",
      browser: click.browser || "Unknown",
    }));

    return res.status(200).json({
      success: true,
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      totalClicks: link.clicks,
      totalRecordedClicks: clicks.length,
      devices: analytics.devices,
      browsers: analytics.browsers,
      dailyTrends: analytics.dailyTrends,
      analytics,
      history,
    });
  } catch (error) {
    console.error("Click history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch click history",
    });
  }
};

// Retrieve comprehensive analytics for a short link
const getLinkAnalytics = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({
      shortCode,
      user: req.user.userId,
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    const clicks = await Click.find({
      link: link._id,
    }).sort({ clickedAt: -1 });

    const analytics = calculateAnalytics(clicks, link.clicks);

    const history = clicks.map((click) => ({
      _id: click._id,
      clickedAt: click.clickedAt,
      clickedAtIST: click.clickedAt
        ? new Date(click.clickedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "",
      deviceType: click.deviceType || "unknown",
      browser: click.browser || "Unknown",
    }));

    return res.status(200).json({
      success: true,
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      totalClicks: link.clicks,
      totalRecordedClicks: clicks.length,
      devices: analytics.devices,
      browsers: analytics.browsers,
      dailyTrends: analytics.dailyTrends,
      history,
    });
  } catch (error) {
    console.error("Link analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch link analytics",
    });
  }
};

const getMyLinks = async (req, res) => {
  try {
    const links = await Link.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalLinks: links.length,
      totalClicks: links.reduce(
        (total, link) => total + link.clicks,
        0
      ),
      data: links,
    });
  } catch (error) {
    console.error("Get my links error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch links",
    });
  }
};

export { createLink, redirectLink, getClickHistory, getLinkAnalytics, getMyLinks };
