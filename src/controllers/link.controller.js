import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { parseUserAgent } from "../utils/userAgentParser.js";

// Helper to validate whether a URL string has a valid HTTP/HTTPS web scheme
const isValidHttpUrl = (urlString) => {
  if (!urlString || typeof urlString !== "string") return false;
  const trimmed = urlString.trim();
  if (trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname && parsed.hostname.length > 0)
    );
  } catch {
    return false;
  }
};

// Safe helper for formatting Date to IST string
const safeFormatIST = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return "";
  }
};

const createLink = async (req, res) => {
  try {
    const { originalUrl } = req.body;

    // Check whether the URL was provided
    if (!originalUrl || typeof originalUrl !== "string" || !originalUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "Original URL is required",
      });
    }

    const trimmedUrl = originalUrl.trim();

    // Validate that the URL has a safe http or https protocol
    if (!isValidHttpUrl(trimmedUrl)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid HTTP or HTTPS URL (e.g. https://example.com)",
      });
    }

    // Generate a unique short code
    const shortCode = crypto.randomBytes(4).toString("hex");

    // Save the link in MongoDB
    const link = await Link.create({
      originalUrl: trimmedUrl,
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

// Redirect visitors to original URL while recording click details asynchronously
const redirectLink = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOneAndUpdate(
      { shortCode },
      { $inc: { clicks: 1 } },
      { new: true }
    )
      .select("originalUrl _id")
      .lean();

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Short link not found",
      });
    }

    // Ensure the destination URL uses a safe web protocol
    if (!isValidHttpUrl(link.originalUrl)) {
      return res.status(400).json({
        success: false,
        message: "Destination URL is invalid or unsafe",
      });
    }

    // 1. Immediately send HTTP 302 redirect to visitor for minimum latency
    res.redirect(link.originalUrl);

    // 2. Safely record visitor device type and browser asynchronously in the background
    try {
      const userAgent = req.headers["user-agent"] || "";
      const { deviceType, browser } = parseUserAgent(userAgent);

      Click.create({
        link: link._id,
        clickedAt: new Date(),
        deviceType,
        browser,
      }).catch((clickError) => {
        console.error("Non-blocking click record error:", clickError.message);
      });
    } catch (parseError) {
      console.error("Failed to parse user-agent:", parseError.message);
    }
  } catch (error) {
    console.error("Redirect link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to redirect",
    });
  }
};

// Helper to format hour (0-23) to 12-hour IST window string
const formatHourIST = (h) => {
  if (h === null || h === undefined) return "No peak window";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? "PM" : "AM";
  const nextH = (h + 1) % 24;
  const nextHour12 = nextH % 12 === 0 ? 12 : nextH % 12;
  const nextAmpm = nextH >= 12 ? "PM" : "AM";
  return `${hour12}:00 ${ampm} – ${nextHour12}:00 ${nextAmpm} IST`;
};

// Calculate Smart Traffic Intelligence: spike alerts, momentum, peak engagement window, and actionable insights
const calculateTrafficIntelligence = ({
  totalClicks = 0,
  totalRecordedClicks = 0,
  dailyTrends = [],
  devices = [],
  browsers = [],
  hourlyTrends = [],
}) => {
  if (totalRecordedClicks === 0) {
    return {
      status: "no_data",
      hasSpike: false,
      spikeAlert: null,
      momentum: {
        status: "new",
        label: "No Activity",
        description: "No traffic recorded yet.",
      },
      peakTime: {
        hour: null,
        label: "Awaiting Traffic",
        timeWindow: "No peak window detected",
      },
      audienceInsight: {
        primaryDevice: "Unknown",
        percentage: 0,
        recommendation: "Share your short link to start gathering automated visitor trends and spike detection.",
      },
      cards: [
        {
          id: "traffic_status",
          title: "Traffic Status",
          icon: "📊",
          headline: "Awaiting First Clicks",
          detail: "Share your link to start gathering automated visitor trends and spike detection.",
          type: "info",
        },
        {
          id: "audience_platform",
          title: "Audience Platform",
          icon: "📱",
          headline: "No Devices Detected",
          detail: "Visitor device and browser breakdowns will appear automatically once clicked.",
          type: "neutral",
        },
        {
          id: "peak_window",
          title: "Peak Engagement (IST)",
          icon: "⏰",
          headline: "Timing Unidentified",
          detail: "Active engagement hours in Indian Standard Time will be calculated with incoming traffic.",
          type: "neutral",
        },
        {
          id: "action_tip",
          title: "Actionable Recommendation",
          icon: "💡",
          headline: "Distribute Link",
          detail: "Share your short link on communications and campaigns to generate traffic insights.",
          type: "tip",
        },
      ],
    };
  }

  // Peak Hour Calculation (IST)
  let peakHour = null;
  let peakHourLabel = "Awaiting Traffic";
  let peakTimeWindow = "No peak window detected";

  if (hourlyTrends && hourlyTrends.length > 0) {
    const sortedHours = [...hourlyTrends].sort((a, b) => b.count - a.count);
    peakHour = sortedHours[0]._id;
    peakTimeWindow = formatHourIST(peakHour);
    peakHourLabel = `Peak Hour: ${peakTimeWindow}`;
  }

  // Device Dominance & Audience Insights
  let primaryDeviceName = "Mixed Devices";
  let primaryDevicePercentage = 0;
  let deviceTip = "Balanced cross-device traffic. Maintain consistent experience across desktop and mobile screens.";

  const activeDevices = devices.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  if (activeDevices.length > 0) {
    const topDev = activeDevices[0];
    primaryDeviceName = topDev.name;
    primaryDevicePercentage = topDev.percentage;

    if (topDev.key === "mobile" && topDev.percentage >= 60) {
      deviceTip = `Audience is heavily mobile (${topDev.percentage}%). Prioritize fast-loading mobile-optimized landing pages.`;
    } else if (topDev.key === "desktop" && topDev.percentage >= 60) {
      deviceTip = `Audience is mostly desktop (${topDev.percentage}%). Ideal for desktop workflows, tools, and long-form content.`;
    } else if (topDev.key === "tablet" && topDev.percentage >= 50) {
      deviceTip = `Noticeable tablet usage (${topDev.percentage}%). Ensure touch navigation and responsive scaling are verified.`;
    }
  }

  // Spike Detection & Momentum Calculation
  let spikeAlert = null;
  let momentum = {
    status: "baseline_forming",
    label: "Baseline Forming",
    description: `Baseline forming (${totalRecordedClicks} click${totalRecordedClicks > 1 ? "s" : ""}). Need at least 5 clicks across 2 days for spike alerts.`,
  };

  // Require at least 2 distinct active days and at least 5 clicks for spike detection
  if (totalRecordedClicks >= 5 && dailyTrends && dailyTrends.length >= 2) {
    const latestDay = dailyTrends[dailyTrends.length - 1];
    const priorDays = dailyTrends.slice(0, -1);
    const priorSum = priorDays.reduce((sum, d) => sum + d.count, 0);
    const priorAvg = priorSum / priorDays.length;
    const baseline = Math.max(priorAvg, 1);
    const currentCount = latestDay.count;
    const spikeRatio = Number((currentCount / baseline).toFixed(2));
    const percentageIncrease = Math.round(((currentCount - baseline) / baseline) * 100);

    if (currentCount >= 5 && spikeRatio >= 2.0 && percentageIncrease >= 100) {
      const isHighSurge = spikeRatio >= 3.0;
      spikeAlert = {
        hasSpike: true,
        ratio: spikeRatio,
        percentageIncrease,
        date: latestDay.date,
        currentClicks: currentCount,
        baselineClicks: Number(baseline.toFixed(1)),
        severity: isHighSurge ? "high" : "moderate",
        message: isHighSurge
          ? `High traffic surge detected on ${latestDay.date} with ${currentCount} clicks (+${percentageIncrease}% above baseline).`
          : `Traffic spike detected on ${latestDay.date} with ${currentCount} clicks (+${percentageIncrease}% above baseline).`,
      };
      momentum = {
        status: "accelerating",
        label: `Surging (+${percentageIncrease}%)`,
        description: `Traffic velocity is ${spikeRatio}x above historical baseline on ${latestDay.date}.`,
      };
    } else if (spikeRatio >= 1.25) {
      momentum = {
        status: "growing",
        label: `Trending Up (+${percentageIncrease}%)`,
        description: `Recent traffic is ${percentageIncrease}% higher than historical daily average.`,
      };
    } else if (spikeRatio >= 0.7) {
      momentum = {
        status: "steady",
        label: "Steady Engagement",
        description: "Click velocity matches consistent historical daily patterns.",
      };
    } else {
      momentum = {
        status: "cooling",
        label: "Cooling Down",
        description: "Recent activity is lower than historical average for this link.",
      };
    }
  }

  // Construct 4 actionable insight cards
  const cards = [
    {
      id: "traffic_status",
      title: "Traffic Trend",
      icon: spikeAlert?.hasSpike ? "⚡" : momentum.status === "accelerating" || momentum.status === "growing" ? "📈" : momentum.status === "cooling" ? "📉" : "📊",
      headline: spikeAlert?.hasSpike ? `${spikeAlert.severity === "high" ? "Surge" : "Spike"}: +${spikeAlert.percentageIncrease}%` : momentum.label,
      detail: spikeAlert?.message || momentum.description,
      type: spikeAlert?.hasSpike ? (spikeAlert.severity === "high" ? "alert-high" : "alert-moderate") : "info",
    },
    {
      id: "audience_platform",
      title: "Audience Platform",
      icon: primaryDeviceName === "Mobile" ? "📱" : primaryDeviceName === "Desktop" ? "🖥️" : "📲",
      headline: `${primaryDeviceName} (${primaryDevicePercentage}%)`,
      detail: deviceTip,
      type: "neutral",
    },
    {
      id: "peak_window",
      title: "Peak Engagement (IST)",
      icon: "⏰",
      headline: peakTimeWindow,
      detail: peakHour !== null ? `Most audience clicks occur during this window. Best time to share or promote updates.` : "Awaiting more click timestamps to determine peak window.",
      type: "neutral",
    },
    {
      id: "action_tip",
      title: "Actionable Strategy",
      icon: "💡",
      headline: spikeAlert?.hasSpike ? "Capitalize on Surge" : "Optimal Sharing Window",
      detail: spikeAlert?.hasSpike
        ? `Capitalize on current momentum while engagement is elevated. Promote relevant follow-ups.`
        : peakHour !== null
        ? `Schedule important social shares and messages around ${peakTimeWindow} for maximum visibility.`
        : "Share your link to generate engagement trends and unlock tailored distribution tips.",
      type: "tip",
    },
  ];

  return {
    status: "active",
    hasSpike: Boolean(spikeAlert?.hasSpike),
    spikeAlert,
    momentum,
    peakTime: {
      hour: peakHour,
      label: peakHourLabel,
      timeWindow: peakTimeWindow,
    },
    audienceInsight: {
      primaryDevice: primaryDeviceName,
      percentage: primaryDevicePercentage,
      recommendation: deviceTip,
    },
    cards,
  };
};

// High-performance MongoDB aggregation for device, browser, and IST daily trends
const getAggregatedAnalytics = async (linkId, totalClicks) => {
  const [aggResult] = await Click.aggregate([
    { $match: { link: linkId } },
    {
      $facet: {
        devices: [
          {
            $group: {
              _id: { $ifNull: ["$deviceType", "unknown"] },
              count: { $sum: 1 },
            },
          },
        ],
        browsers: [
          {
            $group: {
              _id: { $ifNull: ["$browser", "Unknown"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        dailyTrends: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$clickedAt",
                  timezone: "+05:30",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        hourlyTrends: [
          {
            $group: {
              _id: {
                $hour: {
                  date: "$clickedAt",
                  timezone: "+05:30",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const totalRecorded = aggResult?.totalCount?.[0]?.count || 0;
  const deviceCounts = {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    unknown: 0,
  };

  if (aggResult?.devices) {
    for (const d of aggResult.devices) {
      if (deviceCounts[d._id] !== undefined) {
        deviceCounts[d._id] = d.count;
      } else {
        deviceCounts.unknown += d.count;
      }
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

  const browsers = (aggResult?.browsers || []).map((b) => ({
    name: b._id || "Unknown",
    count: b.count,
    percentage:
      totalRecorded > 0
        ? Number(((b.count / totalRecorded) * 100).toFixed(1))
        : 0,
  }));

  const dailyTrends = (aggResult?.dailyTrends || []).map((t) => {
    let displayDate = t._id;
    try {
      const d = new Date(t._id + "T12:00:00+05:30");
      if (!isNaN(d.getTime())) {
        displayDate = d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
        });
      }
    } catch {
      // Keep ISO date string fallback
    }
    return {
      isoDate: t._id,
      date: displayDate,
      count: t.count,
    };
  });

  const intelligence = calculateTrafficIntelligence({
    totalClicks,
    totalRecordedClicks: totalRecorded,
    dailyTrends,
    devices,
    browsers,
    hourlyTrends: aggResult?.hourlyTrends || [],
  });

  return {
    totalClicks,
    totalRecordedClicks: totalRecorded,
    devices,
    browsers,
    dailyTrends,
    intelligence,
  };
};

// Retrieve click history and analytics for a short link with database-level pagination
const getClickHistory = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({
      shortCode,
      user: req.user.userId,
    })
      .select("shortCode originalUrl clicks")
      .lean();

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    // Database-level pagination with sensible defaults (default: 100, max: 500)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit
      ? Math.max(1, Math.min(parseInt(req.query.limit), 500))
      : 100;
    const skip = (page - 1) * limit;

    // Concurrently fetch database-paginated clicks and database-aggregated analytics
    const [paginatedClicks, analytics] = await Promise.all([
      Click.find({ link: link._id })
        .select("clickedAt deviceType browser")
        .sort({ clickedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      getAggregatedAnalytics(link._id, link.clicks),
    ]);

    const history = paginatedClicks.map((click) => ({
      _id: click._id,
      clickedAt: click.clickedAt,
      clickedAtIST: safeFormatIST(click.clickedAt),
      deviceType: click.deviceType || "unknown",
      browser: click.browser || "Unknown",
    }));

    return res.status(200).json({
      success: true,
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      totalClicks: link.clicks,
      totalRecordedClicks: analytics.totalRecordedClicks,
      page,
      limit,
      totalPages: Math.ceil(analytics.totalRecordedClicks / limit) || 1,
      devices: analytics.devices,
      browsers: analytics.browsers,
      dailyTrends: analytics.dailyTrends,
      intelligence: analytics.intelligence,
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

// Retrieve comprehensive analytics for a short link with database-level pagination
const getLinkAnalytics = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({
      shortCode,
      user: req.user.userId,
    })
      .select("shortCode originalUrl clicks")
      .lean();

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    // Database-level pagination with sensible defaults (default: 100, max: 500)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit
      ? Math.max(1, Math.min(parseInt(req.query.limit), 500))
      : 100;
    const skip = (page - 1) * limit;

    // Concurrently fetch database-paginated clicks and database-aggregated analytics
    const [paginatedClicks, analytics] = await Promise.all([
      Click.find({ link: link._id })
        .select("clickedAt deviceType browser")
        .sort({ clickedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      getAggregatedAnalytics(link._id, link.clicks),
    ]);

    const history = paginatedClicks.map((click) => ({
      _id: click._id,
      clickedAt: click.clickedAt,
      clickedAtIST: safeFormatIST(click.clickedAt),
      deviceType: click.deviceType || "unknown",
      browser: click.browser || "Unknown",
    }));

    return res.status(200).json({
      success: true,
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      totalClicks: link.clicks,
      totalRecordedClicks: analytics.totalRecordedClicks,
      page,
      limit,
      totalPages: Math.ceil(analytics.totalRecordedClicks / limit) || 1,
      devices: analytics.devices,
      browsers: analytics.browsers,
      dailyTrends: analytics.dailyTrends,
      intelligence: analytics.intelligence,
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
    const userId = req.user.userId;
    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const hasPagination = Boolean(req.query.page || req.query.limit);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit
      ? Math.max(1, Math.min(parseInt(req.query.limit), 500))
      : 100;
    const skip = (page - 1) * limit;

    let linksQuery = Link.find({ user: userId })
      .select("shortCode originalUrl clicks createdAt updatedAt user")
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      linksQuery = linksQuery.skip(skip).limit(limit);
    }

    // Run queries concurrently: fetch links, total count, and total clicks
    const [links, totalLinks, totalClicksResult] = await Promise.all([
      linksQuery,
      Link.countDocuments({ user: userId }),
      Link.aggregate([
        { $match: { user: userOid } },
        { $group: { _id: null, totalClicks: { $sum: "$clicks" } } },
      ]),
    ]);

    const totalClicks = totalClicksResult[0]?.totalClicks || 0;

    const responsePayload = {
      success: true,
      totalLinks,
      totalClicks,
      data: links,
    };

    if (hasPagination) {
      responsePayload.page = page;
      responsePayload.limit = limit;
      responsePayload.totalPages = Math.ceil(totalLinks / limit) || 1;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Get my links error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch links",
    });
  }
};

export { createLink, redirectLink, getClickHistory, getLinkAnalytics, getMyLinks };
