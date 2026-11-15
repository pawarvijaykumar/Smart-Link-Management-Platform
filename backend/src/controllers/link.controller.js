import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
// CHANGE: Notifications Step 3A — 2026-11-04
import Notification from "../models/notification.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { parseUserAgent } from "../utils/userAgentParser.js";
// CHANGE: Stage 8 — Geo-Location Analytics — 2026-11-08
import { getVisitorIP, resolveGeoLocation } from "../utils/geo.util.js";

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

// Calculate midnight IST boundary for the past N calendar days, converted to UTC Date
const getISTCalendarStart = (days) => {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [year, month, day] = todayStr.split("-").map(Number);
  const midnightUtcForIst = Date.UTC(year, month - 1, day - (days - 1), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(midnightUtcForIst);
};

// CHANGE: Added optional UTM campaign data during link creation — 2026-11-01
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

    // Validate and normalize optional UTM campaign tracking parameters
    const utmFields = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent"];
    const normalizedUtm = {};

    for (const field of utmFields) {
      const val = req.body[field];

      if (val === undefined || val === null) {
        normalizedUtm[field] = null;
      } else if (typeof val !== "string") {
        return res.status(400).json({
          success: false,
          message: `${field} must be a string`,
        });
      } else {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
          normalizedUtm[field] = null;
        } else if (trimmed.length > 200) {
          return res.status(400).json({
            success: false,
            message: `${field} cannot exceed 200 characters`,
          });
        } else {
          normalizedUtm[field] = trimmed;
        }
      }
    }

    // CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
    let validatedExpiresAt = null;
    if (req.body.expiresAt) {
      const expDate = new Date(req.body.expiresAt);
      if (isNaN(expDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid expiration date and time",
        });
      }
      if (expDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Expiration date must be in the future",
        });
      }
      validatedExpiresAt = expDate;
    }

    let validatedMaxClicks = null;
    if (req.body.maxClicks !== undefined && req.body.maxClicks !== null && req.body.maxClicks !== "") {
      const parsedMax = Number(req.body.maxClicks);
      if (!Number.isInteger(parsedMax) || parsedMax < 1) {
        return res.status(400).json({
          success: false,
          message: "Maximum clicks must be a positive whole number (at least 1)",
        });
      }
      validatedMaxClicks = parsedMax;
    }

    const validatedIsPaused = Boolean(req.body.isPaused);

    // Generate a unique short code
    const shortCode = crypto.randomBytes(4).toString("hex");

    // Save the link in MongoDB
    const link = await Link.create({
      originalUrl: trimmedUrl,
      shortCode,
      user: req.user.userId,
      utmSource: normalizedUtm.utmSource,
      utmMedium: normalizedUtm.utmMedium,
      utmCampaign: normalizedUtm.utmCampaign,
      utmTerm: normalizedUtm.utmTerm,
      utmContent: normalizedUtm.utmContent,
      expiresAt: validatedExpiresAt,
      maxClicks: validatedMaxClicks,
      isPaused: validatedIsPaused,
    });

    // CHANGE: Notifications Step 3A/4E — 2026-11-05
    // Safely create an in-app notification for the user without breaking link creation if notification saving fails
    try {
      await Notification.create({
        user: req.user.userId,
        title: "New Link Created",
        message: "Your short link was created successfully.",
        type: "link",
        isRead: false,
        idempotencyKey: `link_created:${link._id}`,
      });
    } catch (notifError) {
      console.error("Non-blocking notification creation error:", notifError);
    }

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

// CHANGE: Added UTM campaign parameters to redirects and click snapshots — 2026-11-01
// CHANGE: QR visit tracking — 2026-11-06
// CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
const redirectLink = async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Detect whether visit originated from QR code scan
    const isQR = req.query.qr === "1";

    const now = new Date();

    // 1. Concurrency-safe atomic check and click increment
    // Only matches if:
    // - Link exists with matching shortCode
    // - isPaused is NOT true
    // - expiresAt is null, undefined, or in the future (> now)
    // - maxClicks is null, undefined, or clicks < maxClicks
    const link = await Link.findOneAndUpdate(
      {
        shortCode,
        isPaused: { $ne: true },
        $and: [
          {
            $or: [
              { expiresAt: null },
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: now } },
            ],
          },
          {
            $or: [
              { maxClicks: null },
              { maxClicks: { $exists: false } },
              { $expr: { $lt: ["$clicks", "$maxClicks"] } },
            ],
          },
        ],
      },
      { $inc: { clicks: 1 } },
      { new: true }
    )
      .select("originalUrl _id shortCode user clicks utmSource utmMedium utmCampaign utmTerm utmContent notifiedMilestones expiresAt maxClicks isPaused")
      .lean();

    // 2. If atomic update did not succeed, inspect reason without recording clicks or notifications
    if (!link) {
      const inspectLink = await Link.findOne({ shortCode })
        .select("shortCode originalUrl isPaused expiresAt maxClicks clicks")
        .lean();

      if (!inspectLink) {
        return res.status(404).json({
          success: false,
          code: "LINK_NOT_FOUND",
          message: "Short link not found",
        });
      }

      // Check whether owner has paused the link
      if (inspectLink.isPaused) {
        return res.status(403).json({
          success: false,
          code: "LINK_PAUSED",
          message: "This link has been paused by the owner",
        });
      }

      // Check whether current time is past expiresAt
      if (inspectLink.expiresAt && now > new Date(inspectLink.expiresAt)) {
        return res.status(410).json({
          success: false,
          code: "LINK_EXPIRED",
          message: "This link has expired",
          expiredAt: inspectLink.expiresAt,
        });
      }

      // Check whether click limit has been reached
      if (inspectLink.maxClicks && inspectLink.clicks >= inspectLink.maxClicks) {
        return res.status(410).json({
          success: false,
          code: "CLICK_LIMIT_REACHED",
          message: "This link has reached its maximum click limit",
          maxClicks: inspectLink.maxClicks,
          clicks: inspectLink.clicks,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Link is unavailable",
      });
    }

    // Ensure the destination URL uses a safe web protocol
    if (!isValidHttpUrl(link.originalUrl)) {
      return res.status(400).json({
        success: false,
        message: "Destination URL is invalid or unsafe",
      });
    }

    // Build the final destination URL with UTM campaign parameters
    let destinationUrl = link.originalUrl;
    try {
      const parsedUrl = new URL(link.originalUrl);
      const utmMap = [
        ["utm_source", link.utmSource],
        ["utm_medium", link.utmMedium],
        ["utm_campaign", link.utmCampaign],
        ["utm_term", link.utmTerm],
        ["utm_content", link.utmContent],
      ];

      for (const [key, val] of utmMap) {
        if (typeof val === "string" && val.trim().length > 0) {
          parsedUrl.searchParams.set(key, val.trim());
        }
      }

      destinationUrl = parsedUrl.toString();
    } catch (urlError) {
      console.warn("Failed to construct UTM destination URL, falling back to original URL:", urlError.message);
    }

    // 1. Immediately send HTTP 302 redirect to visitor for minimum latency
    // CHANGE: Stage 9 Step 4/5 — Request Client Hints for hardware model detection with Vary header — 2026-11-15
    res.set("Accept-CH", "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version");
    res.set("Vary", "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version");
    res.redirect(destinationUrl);

    // 2. Safely record visitor device type, browser, isQR, UTM snapshot, and approximate geolocation in the background
    let recordedClick = null;
    try {
      const userAgent = req.headers["user-agent"] || "";
      // CHANGE: Stage 9 Step 4/5 Device Intelligence Improvements & Client Hints Inspection — 2026-11-15
      // Extract client hints if available from modern Chromium browsers
      const clientHints = {
        model: req.headers["sec-ch-ua-model"],
        platform: req.headers["sec-ch-ua-platform"],
        platformVersion: req.headers["sec-ch-ua-platform-version"],
      };
      const {
        deviceType,
        browser,
        browserVersion,
        operatingSystem,
        osVersion,
        deviceVendor,
        deviceModel,
      } = parseUserAgent(userAgent, clientHints);

      // CHANGE: Stage 9 Step 5 — Diagnostic log for incoming Client Hint headers (no IP/PII logged) — 2026-11-15
      console.log(
        `[Device Diagnostic] UA="${userAgent.slice(0, 90)}..." | ` +
        `Sec-CH-UA="${req.headers["sec-ch-ua"] || "none"}" | ` +
        `Sec-CH-UA-Mobile="${req.headers["sec-ch-ua-mobile"] || "none"}" | ` +
        `Sec-CH-UA-Platform="${req.headers["sec-ch-ua-platform"] || "none"}" | ` +
        `Sec-CH-UA-Model="${req.headers["sec-ch-ua-model"] || "none"}" | ` +
        `Sec-CH-UA-Platform-Version="${req.headers["sec-ch-ua-platform-version"] || "none"}" | ` +
        `Result: Vendor="${deviceVendor}", Model="${deviceModel}", OS="${operatingSystem} ${osVersion}"`
      );
      // CHANGE: Stage 8 — Extract visitor IP and resolve approximate geolocation (raw IP is not stored)
      const visitorIP = getVisitorIP(req);
      const { country, countryCode, region, city } = await resolveGeoLocation(visitorIP, req);

      recordedClick = await Click.create({
        link: link._id,
        clickedAt: new Date(),
        deviceType,
        browser,
        browserVersion,
        operatingSystem,
        osVersion,
        deviceVendor,
        deviceModel,
        isQR,
        utmSource: link.utmSource || null,
        utmMedium: link.utmMedium || null,
        utmCampaign: link.utmCampaign || null,
        utmTerm: link.utmTerm || null,
        utmContent: link.utmContent || null,
        country,
        countryCode,
        region,
        city,
      });

      if (process.env.NODE_ENV !== "production" && recordedClick) {
        const dbName = mongoose.connection?.name || "smartlink";
        const collName = Click.collection?.name || "clicks";
        console.log(
          `[Click DB Inserted] ID: ${recordedClick._id} | Collection: ${collName} | Database: ${dbName} | Link: ${shortCode}`
        );
      }
    } catch (parseError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[Click DB Error] Insertion failed:", parseError);
      } else {
        console.error("Non-blocking click record or geo parse error:", parseError.message);
      }
    }

    // 3. CHANGE: Notifications Step 3B — 2026-11-04
    // Concurrency-safe, idempotent milestone detection with failure recovery
    try {
      const MILESTONES = [100, 500, 1000];
      const currentClicks = link.clicks;

      // Identify any achieved milestones that have not yet been successfully recorded
      const pendingMilestones = MILESTONES.filter(
        (m) => currentClicks >= m && !(link.notifiedMilestones || []).includes(m)
      );

      if (link.user && pendingMilestones.length > 0) {
        for (const m of pendingMilestones) {
          // Atomic claim on Link document: guarantees only one concurrent request proceeds per milestone
          const claimed = await Link.findOneAndUpdate(
            {
              _id: link._id,
              notifiedMilestones: { $ne: m },
            },
            {
              $addToSet: { notifiedMilestones: m },
            },
            { new: true }
          );

          if (!claimed) {
            // Another concurrent process already claimed this milestone
            continue;
          }

          const displayCount = m === 1000 ? "1,000" : m;
          const idempotencyKey = `milestone:${link._id}:${m}`;

          try {
            await Notification.create({
              user: link.user,
              title: "Click Milestone Reached",
              message: `Your short link ${link.shortCode} has reached ${displayCount} clicks!`,
              type: "milestone",
              isRead: false,
              idempotencyKey,
            });
          } catch (notifErr) {
            if (notifErr.code === 11000) {
              // Database-enforced uniqueness: notification already exists, treat as idempotent success
            } else {
              // Notification write failed due to a non-duplicate error: roll back claim so it can be retried safely
              console.error(`Notification write failed for milestone ${m}, rolling back claim:`, notifErr.message);
              await Link.updateOne(
                { _id: link._id },
                { $pull: { notifiedMilestones: m } }
              ).catch((pullErr) => {
                console.error("Rollback pull error:", pullErr.message);
              });
            }
          }
        }
      }
    } catch (milestoneError) {
      console.error("Non-blocking milestone notification error:", milestoneError);
    }

    // 4. CHANGE: Notifications Step 3C — 2026-11-04
    // Automatically notify the link owner when a UTM campaign receives its first attributed click
    try {
      // Use the UTM campaign snapshot recorded in the Click document (Requirement 2)
      const recordedCampaign = recordedClick?.utmCampaign;

      if (
        link.user &&
        recordedCampaign &&
        typeof recordedCampaign === "string" &&
        recordedCampaign.trim().length > 0
      ) {
        const campaignName = recordedCampaign.trim();
        // Identify the campaign using the link owner's user ID and normalized UTM campaign name (Requirement 3)
        const normalizedCampaignKey = campaignName.toLowerCase();
        const idempotencyKey = `campaign_first_click:${link.user}:${normalizedCampaignKey}`;

        // Fast check to skip subsequent clicks without write attempts (Requirement 7)
        const existingNotification = await Notification.findOne({ idempotencyKey })
          .select("_id")
          .lean();

        if (!existingNotification) {
          try {
            await Notification.create({
              user: link.user,
              title: "Campaign Received Traffic",
              message: `Your campaign ${campaignName} has received its first click!`,
              type: "campaign",
              isRead: false,
              idempotencyKey,
            });
          } catch (notifErr) {
            if (notifErr.code === 11000) {
              // Database-enforced uniqueness: concurrent click already created notification, treat as idempotent success
            } else {
              // Notification write failed due to a non-duplicate error: log safely without throwing so subsequent click can retry and recover
              console.error(
                `Non-blocking campaign notification write error for campaign "${campaignName}":`,
                notifErr.message
              );
            }
          }
        }
      }
    } catch (campaignError) {
      console.error("Non-blocking campaign activity notification error:", campaignError);
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
  const matchCondition = Array.isArray(linkId)
    ? { link: { $in: linkId } }
    : { link: linkId };

  const [aggResult] = await Click.aggregate([
    { $match: matchCondition },
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
        // CHANGE: QR visit tracking — 2026-11-06
        qrCount: [
          { $match: { isQR: true } },
          { $count: "count" },
        ],
      },
    },
  ]);

  const totalRecorded = aggResult?.totalCount?.[0]?.count || 0;
  // CHANGE: QR visit tracking — 2026-11-06
  const qrScans = aggResult?.qrCount?.[0]?.count || 0;
  const directClicks = Math.max(0, totalRecorded - qrScans);
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
    // CHANGE: QR visit tracking — 2026-11-06
    qrScans,
    directClicks,
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
        .select("clickedAt deviceType browser isQR")
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
      isQR: Boolean(click.isQR),
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
        .select("clickedAt deviceType browser isQR")
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
      isQR: Boolean(click.isQR),
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

// Retrieve aggregated analytics across ALL links belonging to the authenticated user
const getAllLinksAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    const userLinks = await Link.find({ user: userId })
      .select("_id shortCode originalUrl clicks createdAt")
      .lean();

    const totalLinks = userLinks.length;
    const totalClicks = userLinks.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const linkIds = userLinks.map((l) => l._id);

    if (linkIds.length === 0) {
      return res.status(200).json({
        success: true,
        isAllLinks: true,
        totalLinks: 0,
        totalClicks: 0,
        totalRecordedClicks: 0,
        devices: [],
        browsers: [],
        dailyTrends: [],
        intelligence: calculateTrafficIntelligence({
          totalClicks: 0,
          totalRecordedClicks: 0,
          dailyTrends: [],
          devices: [],
          browsers: [],
          hourlyTrends: [],
        }),
        history: [],
      });
    }

    // Database-level pagination with sensible defaults (default: 100, max: 500)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit
      ? Math.max(1, Math.min(parseInt(req.query.limit), 500))
      : 100;
    const skip = (page - 1) * limit;

    // Concurrently fetch clicks across all user's links and aggregated analytics
    const [paginatedClicks, analytics] = await Promise.all([
      Click.find({ link: { $in: linkIds } })
        .select("link clickedAt deviceType browser isQR")
        .sort({ clickedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      getAggregatedAnalytics(linkIds, totalClicks),
    ]);

    const history = paginatedClicks.map((click) => ({
      _id: click._id,
      link: click.link,
      clickedAt: click.clickedAt,
      clickedAtIST: safeFormatIST(click.clickedAt),
      deviceType: click.deviceType || "unknown",
      browser: click.browser || "Unknown",
      isQR: Boolean(click.isQR),
    }));

    return res.status(200).json({
      success: true,
      isAllLinks: true,
      totalLinks,
      totalClicks,
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
    console.error("All links analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch all links analytics",
    });
  }
};

// CHANGE: Added user-scoped campaign analytics aggregation — 2026-11-01
const getCampaignAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = rawRange === "7d" || rawRange === "30d" ? rawRange : "all";

    const UNTRACKED_LABEL = "Direct / Untracked";

    // 1. User Isolation: Find only links owned by the authenticated user
    const userLinks = await Link.find({ user: userId }).select("_id").lean();
    const linkIds = userLinks.map((l) => l._id);

    // If user has no links, return empty data structure immediately
    if (linkIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          range,
          summary: {
            totalRecordedClicks: 0,
            attributedClicks: 0,
            unattributedClicks: 0,
            totalCampaigns: 0,
            topSource: null,
            topCampaign: null,
          },
          campaigns: [],
          sources: [],
          mediums: [],
          performance: [],
          dailyTrends: [],
        },
      });
    }

    // 2. Date Filtering in IST
    const matchCondition = {
      link: { $in: linkIds },
    };

    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    // 3. Facet Aggregation
    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $project: {
          clickedAt: 1,
          utmSource: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmSource", ""] } } } }, 0] },
              { $trim: { input: "$utmSource" } },
              UNTRACKED_LABEL,
            ],
          },
          utmMedium: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmMedium", ""] } } } }, 0] },
              { $trim: { input: "$utmMedium" } },
              UNTRACKED_LABEL,
            ],
          },
          utmCampaign: {
            $cond: [
              { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmCampaign", ""] } } } }, 0] },
              { $trim: { input: "$utmCampaign" } },
              UNTRACKED_LABEL,
            ],
          },
          isAttributed: {
            $cond: [
              {
                $or: [
                  { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmSource", ""] } } } }, 0] },
                  { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmMedium", ""] } } } }, 0] },
                  { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmCampaign", ""] } } } }, 0] },
                  { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmTerm", ""] } } } }, 0] },
                  { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ["$utmContent", ""] } } } }, 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalRecordedClicks: { $sum: 1 },
                attributedClicks: { $sum: "$isAttributed" },
              },
            },
          ],
          campaigns: [
            {
              $group: {
                _id: "$utmCampaign",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          sources: [
            {
              $group: {
                _id: "$utmSource",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          mediums: [
            {
              $group: {
                _id: "$utmMedium",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          // CHANGE: Stage 5C — 2026-11-03
          performance: [
            {
              $group: {
                _id: {
                  campaign: "$utmCampaign",
                  source: "$utmSource",
                  medium: "$utmMedium",
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          // CHANGE: Added campaign clicks over time daily trends — 2026-11-03
          dailyTrends: [
            {
              $match: { isAttributed: 1 },
            },
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
        },
      },
    ]);

    const totalRecordedClicks = aggResult?.totals?.[0]?.totalRecordedClicks || 0;
    const attributedClicks = aggResult?.totals?.[0]?.attributedClicks || 0;
    const unattributedClicks = Math.max(0, totalRecordedClicks - attributedClicks);

    // Format breakdown lists
    const campaigns = (aggResult?.campaigns || []).map((c) => ({
      name: c._id,
      count: c.count,
    }));

    const sources = (aggResult?.sources || []).map((s) => ({
      name: s._id,
      count: s.count,
    }));

    const mediums = (aggResult?.mediums || []).map((m) => ({
      name: m._id,
      count: m.count,
    }));

    // Format row-by-row campaign performance relationships
    const performance = (aggResult?.performance || []).map((p) => ({
      campaign: p._id?.campaign || UNTRACKED_LABEL,
      source: p._id?.source || UNTRACKED_LABEL,
      medium: p._id?.medium || UNTRACKED_LABEL,
      count: p.count,
    }));

    // Format daily campaign-attributed trends (IST)
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

    // Define distinct non-empty campaign names only (excluding UNTRACKED_LABEL and empty/whitespace)
    const distinctNamedCampaigns = campaigns.filter(
      (c) => c.name && c.name.trim() !== "" && c.name !== UNTRACKED_LABEL
    );
    const totalCampaigns = distinctNamedCampaigns.length;

    // Determine topCampaign and topSource (excluding UNTRACKED_LABEL; null if none exist)
    const topCampaign =
      distinctNamedCampaigns.length > 0
        ? { name: distinctNamedCampaigns[0].name, count: distinctNamedCampaigns[0].count }
        : null;

    const distinctNamedSources = sources.filter(
      (s) => s.name && s.name.trim() !== "" && s.name !== UNTRACKED_LABEL
    );
    const topSource =
      distinctNamedSources.length > 0
        ? { name: distinctNamedSources[0].name, count: distinctNamedSources[0].count }
        : null;

    return res.status(200).json({
      success: true,
      data: {
        range,
        summary: {
          totalRecordedClicks,
          attributedClicks,
          unattributedClicks,
          totalCampaigns,
          topSource,
          topCampaign,
        },
        campaigns,
        sources,
        mediums,
        performance,
        dailyTrends,
      },
    });
  } catch (error) {
    console.error("Campaign analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign analytics",
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
      .select("shortCode originalUrl clicks createdAt updatedAt user expiresAt maxClicks isPaused utmSource utmMedium utmCampaign")
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

// CHANGE: QR analytics API — 2026-11-06
const getQRAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = rawRange === "7d" || rawRange === "30d" ? rawRange : "all";

    // 1. User Isolation: Find only links owned by the authenticated user
    const userLinks = await Link.find({ user: userId })
      .select("_id shortCode originalUrl createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // If user has no links, return empty data structure immediately
    if (userLinks.length === 0) {
      return res.status(200).json({
        success: true,
        range,
        summary: {
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          qrPercentage: 0,
        },
        links: [],
      });
    }

    const linkIds = userLinks.map((l) => l._id);

    // 2. Date Filtering in IST
    const matchCondition = {
      link: { $in: linkIds },
    };

    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    // 3. Facet Aggregation
    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: {
                    $cond: [{ $eq: ["$isQR", true] }, 1, 0],
                  },
                },
                directClicks: {
                  $sum: {
                    $cond: [{ $eq: ["$isQR", true] }, 0, 1],
                  },
                },
              },
            },
          ],
          perLink: [
            {
              $group: {
                _id: "$link",
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: {
                    $cond: [{ $eq: ["$isQR", true] }, 1, 0],
                  },
                },
                directClicks: {
                  $sum: {
                    $cond: [{ $eq: ["$isQR", true] }, 0, 1],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const summaryData = aggResult?.summary?.[0] || {
      totalClicks: 0,
      qrClicks: 0,
      directClicks: 0,
    };

    const totalClicks = summaryData.totalClicks || 0;
    const qrClicks = summaryData.qrClicks || 0;
    const directClicks = summaryData.directClicks || 0;
    const qrPercentage =
      totalClicks > 0
        ? Number(((qrClicks / totalClicks) * 100).toFixed(1))
        : 0;

    // Build per-link lookup map
    const linkStatsMap = new Map();
    if (aggResult?.perLink) {
      for (const item of aggResult.perLink) {
        linkStatsMap.set(item._id.toString(), {
          totalClicks: item.totalClicks || 0,
          qrClicks: item.qrClicks || 0,
          directClicks: item.directClicks || 0,
        });
      }
    }

    // Map each link owned by user to its stats (including zero-click links)
    const links = userLinks.map((link) => {
      const stats = linkStatsMap.get(link._id.toString()) || {
        totalClicks: 0,
        qrClicks: 0,
        directClicks: 0,
      };

      const linkTotalClicks = stats.totalClicks;
      const linkQrClicks = stats.qrClicks;
      const linkDirectClicks = stats.directClicks;
      const linkQrPercentage =
        linkTotalClicks > 0
          ? Number(((linkQrClicks / linkTotalClicks) * 100).toFixed(1))
          : 0;

      return {
        linkId: link._id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        totalClicks: linkTotalClicks,
        qrClicks: linkQrClicks,
        directClicks: linkDirectClicks,
        qrPercentage: linkQrPercentage,
      };
    });

    // Sort links: highest qrClicks first, then totalClicks, then original order
    links.sort((a, b) => b.qrClicks - a.qrClicks || b.totalClicks - a.totalClicks);

    return res.status(200).json({
      success: true,
      range,
      summary: {
        totalClicks,
        qrClicks,
        directClicks,
        qrPercentage,
      },
      links,
    });
  } catch (error) {
    console.error("Get QR analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch QR analytics",
    });
  }
};

// CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
/**
 * Sets or updates expiry date, maximum clicks, and pause state for an owned link.
 */
const updateLinkAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, user: userId }
      : { shortCode: id, user: userId };

    const link = await Link.findOne(query);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found or unauthorized",
      });
    }

    const updates = {};

    // 1. Expiry Date
    if (req.body.expiresAt !== undefined) {
      if (req.body.expiresAt === null || req.body.expiresAt === "") {
        updates.expiresAt = null;
      } else {
        const expDate = new Date(req.body.expiresAt);
        if (isNaN(expDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid expiration date format",
          });
        }
        if (expDate <= new Date()) {
          return res.status(400).json({
            success: false,
            message: "Expiration date must be in the future",
          });
        }
        updates.expiresAt = expDate;
      }
    }

    // 2. Maximum Clicks
    if (req.body.maxClicks !== undefined) {
      if (req.body.maxClicks === null || req.body.maxClicks === "") {
        updates.maxClicks = null;
      } else {
        const parsedMax = Number(req.body.maxClicks);
        if (!Number.isInteger(parsedMax) || parsedMax < 1) {
          return res.status(400).json({
            success: false,
            message: "Maximum clicks must be a positive integer (at least 1)",
          });
        }
        updates.maxClicks = parsedMax;
      }
    }

    // 3. Pause Status
    if (req.body.isPaused !== undefined) {
      updates.isPaused = Boolean(req.body.isPaused);
    }

    Object.assign(link, updates);
    await link.save();

    return res.status(200).json({
      success: true,
      message: "Link access settings updated successfully",
      data: link,
    });
  } catch (error) {
    console.error("Update link access error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update link access settings",
    });
  }
};

// CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
/**
 * Toggles or sets the pause status for an owned link.
 */
const togglePauseLink = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, user: userId }
      : { shortCode: id, user: userId };

    const link = await Link.findOne(query);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found or unauthorized",
      });
    }

    if (req.body && req.body.isPaused !== undefined) {
      link.isPaused = Boolean(req.body.isPaused);
    } else {
      link.isPaused = !link.isPaused;
    }

    await link.save();

    const actionText = link.isPaused ? "paused" : "reactivated";

    return res.status(200).json({
      success: true,
      message: `Link ${actionText} successfully`,
      isPaused: link.isPaused,
      data: link,
    });
  } catch (error) {
    console.error("Toggle pause link error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update link pause status",
    });
  }
};

// CHANGE: Stage 8 — Geo-Location Analytics API — 2026-11-08
/**
 * Returns user-scoped geolocation analytics with date filtering (7d, 30d, all).
 * Computes:
 * - summary: totalClicks, geoIdentifiedClicks, unknownClicks, countriesCount, citiesCount, qrGeoClicks, directGeoClicks, geoIdentifiedPercentage
 * - topCountries: ranked country breakdown with totalClicks, qrClicks, directClicks, percentage, qrPercentage
 * - topCities: ranked city breakdown with totalClicks, qrClicks, directClicks, percentage
 * - qrVsDirectByCountry: comparative distribution across top countries
 */
const getGeoAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = rawRange === "7d" || rawRange === "30d" ? rawRange : "all";

    // 1. User Isolation: Find only links owned by the authenticated user
    const userLinks = await Link.find({ user: userId })
      .select("_id")
      .lean();

    if (userLinks.length === 0) {
      return res.status(200).json({
        success: true,
        range,
        summary: {
          totalClicks: 0,
          geoIdentifiedClicks: 0,
          unknownClicks: 0,
          countriesCount: 0,
          citiesCount: 0,
          qrGeoClicks: 0,
          directGeoClicks: 0,
          geoIdentifiedPercentage: 0,
        },
        topCountries: [],
        topCities: [],
        qrVsDirectByCountry: [],
      });
    }

    const linkIds = userLinks.map((l) => l._id);

    // 2. Date Filtering in IST boundaries
    const matchCondition = {
      link: { $in: linkIds },
    };

    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    // 3. Faceted Aggregation for Country, City, and Overall Summary
    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalClicks: { $sum: 1 },
                geoIdentifiedClicks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$countryCode", null] },
                          { $ne: ["$country", "Unknown"] },
                          { $ne: ["$country", ""] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                unknownClicks: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$countryCode", null] },
                          { $eq: ["$country", "Unknown"] },
                          { $not: ["$country"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                qrGeoClicks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$isQR", true] },
                          { $ne: ["$countryCode", null] },
                          { $ne: ["$country", "Unknown"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                directGeoClicks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$isQR", true] },
                          { $ne: ["$countryCode", null] },
                          { $ne: ["$country", "Unknown"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          countries: [
            {
              $match: {
                countryCode: { $ne: null },
                country: { $ne: "Unknown" },
              },
            },
            {
              $group: {
                _id: {
                  countryCode: "$countryCode",
                  country: "$country",
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1, "_id.country": 1 } },
          ],
          regions: [
            {
              $match: {
                countryCode: { $ne: null },
                country: { $ne: "Unknown" },
              },
            },
            {
              $group: {
                _id: {
                  countryCode: "$countryCode",
                  country: "$country",
                  region: { $ifNull: ["$region", "Unknown"] },
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1, "_id.region": 1 } },
          ],
          cities: [
            {
              $match: {
                city: { $ne: null, $nin: ["Unknown", ""] },
                country: { $ne: "Unknown" },
              },
            },
            {
              $group: {
                _id: {
                  city: "$city",
                  region: { $ifNull: ["$region", "Unknown"] },
                  country: "$country",
                  countryCode: "$countryCode",
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1, "_id.city": 1 } },
            { $limit: 250 },
          ],
        },
      },
    ]);

    const summaryRaw = aggResult?.summary?.[0] || {
      totalClicks: 0,
      geoIdentifiedClicks: 0,
      unknownClicks: 0,
      qrGeoClicks: 0,
      directGeoClicks: 0,
    };

    const totalClicks = summaryRaw.totalClicks || 0;
    const geoIdentifiedClicks = summaryRaw.geoIdentifiedClicks || 0;
    const unknownClicks = summaryRaw.unknownClicks || 0;
    const qrGeoClicks = summaryRaw.qrGeoClicks || 0;
    const directGeoClicks = summaryRaw.directGeoClicks || 0;
    const geoIdentifiedPercentage =
      totalClicks > 0 ? Number(((geoIdentifiedClicks / totalClicks) * 100).toFixed(1)) : 0;

    const countriesRaw = aggResult?.countries || [];
    const regionsRaw = aggResult?.regions || [];
    const citiesRaw = aggResult?.cities || [];

    // Format Top Countries
    const topCountries = countriesRaw.map((c, index) => {
      const clicks = c.totalClicks || 0;
      const qr = c.qrClicks || 0;
      const direct = c.directClicks || 0;
      const percentage =
        geoIdentifiedClicks > 0
          ? Number(((clicks / geoIdentifiedClicks) * 100).toFixed(1))
          : 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;

      return {
        rank: index + 1,
        country: c._id.country || "Unknown",
        countryCode: c._id.countryCode || null,
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        percentage,
        qrPercentage,
      };
    });

    // Format Regions / States for drill-down
    const regions = regionsRaw.map((r, index) => {
      const clicks = r.totalClicks || 0;
      const qr = r.qrClicks || 0;
      const direct = r.directClicks || 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;

      return {
        rank: index + 1,
        country: r._id.country || "Unknown",
        countryCode: r._id.countryCode || null,
        region: r._id.region || "Unknown",
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        qrPercentage,
      };
    });

    // Format Top Cities
    const totalCityIdentifiedClicks = citiesRaw.reduce(
      (sum, item) => sum + (item.totalClicks || 0),
      0
    );
    const topCities = citiesRaw.map((c, index) => {
      const clicks = c.totalClicks || 0;
      const qr = c.qrClicks || 0;
      const direct = c.directClicks || 0;
      const percentage =
        totalCityIdentifiedClicks > 0
          ? Number(((clicks / totalCityIdentifiedClicks) * 100).toFixed(1))
          : 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;

      return {
        rank: index + 1,
        city: c._id.city || "Unknown",
        region: c._id.region || "Unknown",
        country: c._id.country || "Unknown",
        countryCode: c._id.countryCode || null,
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        percentage,
        qrPercentage,
      };
    });

    // Format QR vs Direct geographic breakdown
    const qrVsDirectByCountry = topCountries.slice(0, 10).map((c) => ({
      country: c.country,
      countryCode: c.countryCode,
      qrClicks: c.qrClicks,
      directClicks: c.directClicks,
      totalClicks: c.totalClicks,
      qrPercentage: c.qrPercentage,
    }));

    return res.status(200).json({
      success: true,
      range,
      summary: {
        totalClicks,
        geoIdentifiedClicks,
        unknownClicks,
        countriesCount: topCountries.length,
        citiesCount: topCities.length,
        qrGeoClicks,
        directGeoClicks,
        geoIdentifiedPercentage,
      },
      topCountries,
      regions,
      topCities,
      qrVsDirectByCountry,
    });
  } catch (error) {
    console.error("Get geo analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch geolocation analytics",
    });
  }
};

// =========================================================================
// CHANGE: Stage 9 Device & Browser Intelligence — 2026-11-14
// High-performance authenticated aggregation for device categories,
// operating systems, browsers, hardware vendors, models, and QR vs Direct traffic.
// =========================================================================
const getDeviceAnalytics = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request",
      });
    }

    const rawRange = (req.query.range || "all").toString().toLowerCase().trim();
    const range = rawRange === "7d" || rawRange === "30d" ? rawRange : "all";

    // 1. User Isolation: Find only links owned by the authenticated user
    const userLinks = await Link.find({ user: userId })
      .select("_id")
      .lean();

    if (userLinks.length === 0) {
      return res.status(200).json({
        success: true,
        range,
        summary: {
          totalClicks: 0,
          mobileClicks: 0,
          desktopClicks: 0,
          tabletClicks: 0,
          unknownClicks: 0,
          mobilePercentage: 0,
          desktopPercentage: 0,
          tabletPercentage: 0,
          qrClicks: 0,
          directClicks: 0,
          primaryOs: "Unknown",
          primaryBrowser: "Unknown",
        },
        deviceTypes: [],
        operatingSystems: [],
        browsers: [],
        vendors: [],
        models: [],
        qrVsDirectByDevice: [],
      });
    }

    const linkIds = userLinks.map((l) => l._id);

    // 2. Date Filtering in IST boundaries
    const matchCondition = {
      link: { $in: linkIds },
    };

    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    // 3. Faceted Aggregation for Devices, OS, Browsers, Vendors, Models
    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalClicks: { $sum: 1 },
                mobileClicks: {
                  $sum: { $cond: [{ $eq: ["$deviceType", "mobile"] }, 1, 0] },
                },
                desktopClicks: {
                  $sum: { $cond: [{ $eq: ["$deviceType", "desktop"] }, 1, 0] },
                },
                tabletClicks: {
                  $sum: { $cond: [{ $eq: ["$deviceType", "tablet"] }, 1, 0] },
                },
                unknownClicks: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$deviceType", "unknown"] },
                          { $eq: ["$deviceType", null] },
                          { $not: ["$deviceType"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
          ],
          deviceTypes: [
            {
              $group: {
                _id: { $ifNull: ["$deviceType", "unknown"] },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1 } },
          ],
          operatingSystems: [
            {
              $group: {
                _id: {
                  os: { $ifNull: ["$operatingSystem", "Unknown"] },
                  version: { $ifNull: ["$osVersion", "Unknown"] },
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1 } },
          ],
          browsers: [
            {
              $group: {
                _id: {
                  browser: { $ifNull: ["$browser", "Unknown"] },
                  version: { $ifNull: ["$browserVersion", "Unknown"] },
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1 } },
          ],
          vendors: [
            {
              $group: {
                _id: { $ifNull: ["$deviceVendor", "Unknown"] },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1 } },
          ],
          models: [
            {
              $match: {
                deviceModel: { $ne: null, $nin: ["Unknown", ""] },
              },
            },
            {
              $group: {
                _id: {
                  model: "$deviceModel",
                  vendor: { $ifNull: ["$deviceVendor", "Unknown"] },
                },
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { totalClicks: -1 } },
            { $limit: 30 },
          ],
        },
      },
    ]);

    const summaryRaw = aggResult?.summary?.[0] || {
      totalClicks: 0,
      mobileClicks: 0,
      desktopClicks: 0,
      tabletClicks: 0,
      unknownClicks: 0,
      qrClicks: 0,
      directClicks: 0,
    };

    const totalClicks = summaryRaw.totalClicks || 0;
    const mobileClicks = summaryRaw.mobileClicks || 0;
    const desktopClicks = summaryRaw.desktopClicks || 0;
    const tabletClicks = summaryRaw.tabletClicks || 0;
    const unknownClicks = summaryRaw.unknownClicks || 0;
    const qrClicks = summaryRaw.qrClicks || 0;
    const directClicks = summaryRaw.directClicks || 0;

    const mobilePercentage = totalClicks > 0 ? Number(((mobileClicks / totalClicks) * 100).toFixed(1)) : 0;
    const desktopPercentage = totalClicks > 0 ? Number(((desktopClicks / totalClicks) * 100).toFixed(1)) : 0;
    const tabletPercentage = totalClicks > 0 ? Number(((tabletClicks / totalClicks) * 100).toFixed(1)) : 0;

    // Format Device Types
    const deviceTypes = (aggResult?.deviceTypes || []).map((d) => {
      const clicks = d.totalClicks || 0;
      const qr = d.qrClicks || 0;
      const direct = d.directClicks || 0;
      const percentage = totalClicks > 0 ? Number(((clicks / totalClicks) * 100).toFixed(1)) : 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;
      return {
        type: d._id || "unknown",
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        percentage,
        qrPercentage,
      };
    });

    // Format Operating Systems (Roll up versions by OS name)
    const osMap = new Map();
    for (const item of (aggResult?.operatingSystems || [])) {
      const osName = item._id?.os || "Unknown";
      const osVersion = item._id?.version || "Unknown";
      const clicks = item.totalClicks || 0;
      const qr = item.qrClicks || 0;
      const direct = item.directClicks || 0;

      if (!osMap.has(osName)) {
        osMap.set(osName, {
          name: osName,
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          versions: [],
        });
      }
      const entry = osMap.get(osName);
      entry.totalClicks += clicks;
      entry.qrClicks += qr;
      entry.directClicks += direct;
      if (osVersion && osVersion !== "Unknown") {
        entry.versions.push({
          version: osVersion,
          clicks,
        });
      }
    }

    const operatingSystems = Array.from(osMap.values())
      .map((os) => {
        const percentage = totalClicks > 0 ? Number(((os.totalClicks / totalClicks) * 100).toFixed(1)) : 0;
        const qrPercentage = os.totalClicks > 0 ? Number(((os.qrClicks / os.totalClicks) * 100).toFixed(1)) : 0;
        os.versions.sort((a, b) => b.clicks - a.clicks);
        return {
          rank: 1,
          name: os.name,
          totalClicks: os.totalClicks,
          qrClicks: os.qrClicks,
          directClicks: os.directClicks,
          percentage,
          qrPercentage,
          versions: os.versions,
        };
      })
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .map((os, index) => ({ ...os, rank: index + 1 }));

    // Format Browsers (Roll up versions by Browser name)
    const browserMap = new Map();
    for (const item of (aggResult?.browsers || [])) {
      const bName = item._id?.browser || "Unknown";
      const bVersion = item._id?.version || "Unknown";
      const clicks = item.totalClicks || 0;
      const qr = item.qrClicks || 0;
      const direct = item.directClicks || 0;

      if (!browserMap.has(bName)) {
        browserMap.set(bName, {
          name: bName,
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          versions: [],
        });
      }
      const entry = browserMap.get(bName);
      entry.totalClicks += clicks;
      entry.qrClicks += qr;
      entry.directClicks += direct;
      if (bVersion && bVersion !== "Unknown") {
        entry.versions.push({
          version: bVersion,
          clicks,
        });
      }
    }

    const browsers = Array.from(browserMap.values())
      .map((b) => {
        const percentage = totalClicks > 0 ? Number(((b.totalClicks / totalClicks) * 100).toFixed(1)) : 0;
        const qrPercentage = b.totalClicks > 0 ? Number(((b.qrClicks / b.totalClicks) * 100).toFixed(1)) : 0;
        b.versions.sort((a, b) => b.clicks - a.clicks);
        return {
          rank: 1,
          name: b.name,
          totalClicks: b.totalClicks,
          qrClicks: b.qrClicks,
          directClicks: b.directClicks,
          percentage,
          qrPercentage,
          versions: b.versions,
        };
      })
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .map((b, index) => ({ ...b, rank: index + 1 }));

    // Format Vendors
    const vendors = (aggResult?.vendors || []).map((v, index) => {
      const clicks = v.totalClicks || 0;
      const qr = v.qrClicks || 0;
      const direct = v.directClicks || 0;
      const percentage = totalClicks > 0 ? Number(((clicks / totalClicks) * 100).toFixed(1)) : 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;
      return {
        rank: index + 1,
        vendor: v._id || "Unknown",
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        percentage,
        qrPercentage,
      };
    });

    // Format Models
    const models = (aggResult?.models || []).map((m, index) => {
      const clicks = m.totalClicks || 0;
      const qr = m.qrClicks || 0;
      const direct = m.directClicks || 0;
      const percentage = totalClicks > 0 ? Number(((clicks / totalClicks) * 100).toFixed(1)) : 0;
      const qrPercentage = clicks > 0 ? Number(((qr / clicks) * 100).toFixed(1)) : 0;
      return {
        rank: index + 1,
        model: m._id?.model || "Unknown",
        vendor: m._id?.vendor || "Unknown",
        totalClicks: clicks,
        qrClicks: qr,
        directClicks: direct,
        percentage,
        qrPercentage,
      };
    });

    // QR vs Direct by Device
    const qrVsDirectByDevice = deviceTypes.map((d) => ({
      deviceType: d.type,
      totalClicks: d.totalClicks,
      qrClicks: d.qrClicks,
      directClicks: d.directClicks,
      qrPercentage: d.qrPercentage,
    }));

    const primaryOs = operatingSystems.length > 0 ? operatingSystems[0].name : "Unknown";
    const primaryBrowser = browsers.length > 0 ? browsers[0].name : "Unknown";

    return res.status(200).json({
      success: true,
      range,
      summary: {
        totalClicks,
        mobileClicks,
        desktopClicks,
        tabletClicks,
        unknownClicks,
        mobilePercentage,
        desktopPercentage,
        tabletPercentage,
        qrClicks,
        directClicks,
        primaryOs,
        primaryBrowser,
      },
      deviceTypes,
      operatingSystems,
      browsers,
      vendors,
      models,
      qrVsDirectByDevice,
    });
  } catch (error) {
    console.error("Get device analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch device analytics",
    });
  }
};

// =========================================================================
// CHANGE: Stage 10 Advanced Traffic Visualization — 2026-11-16
// High-performance authenticated aggregation for traffic analytics:
// Daily traffic trends, hourly distribution, QR vs direct trends over time,
// device distribution, campaign trends, and day-of-week x hour heatmap in IST.
// =========================================================================

const DAY_INFO = [
  { dayOfWeek: 1, name: "Sunday", short: "Sun" },
  { dayOfWeek: 2, name: "Monday", short: "Mon" },
  { dayOfWeek: 3, name: "Tuesday", short: "Tue" },
  { dayOfWeek: 4, name: "Wednesday", short: "Wed" },
  { dayOfWeek: 5, name: "Thursday", short: "Thu" },
  { dayOfWeek: 6, name: "Friday", short: "Fri" },
  { dayOfWeek: 7, name: "Saturday", short: "Sat" },
];

const getISTDateStr = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
};

const generateISTDateList = (count, endDateStr = getISTDateStr()) => {
  const [y, m, d] = endDateStr.split("-").map(Number);
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i, 12, 0, 0));
    const year = dt.getUTCFullYear();
    const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    result.push(`${year}-${month}-${day}`);
  }
  return result;
};

const getDaysDiff = (startStr, endStr) => {
  if (!startStr || !endStr) return 7;
  const [y1, m1, d1] = startStr.split("-").map(Number);
  const [y2, m2, d2] = endStr.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const t2 = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  return Math.max(1, Math.round((t2 - t1) / 86400000) + 1);
};

const formatHourLabel = (h) => {
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12} ${ampm} (${String(h).padStart(2, "0")}:00 IST)`;
};

const buildEmptyTrafficData = (range) => {
  const daysCount = range === "30d" ? 30 : 7;
  const dates = generateISTDateList(daysCount);

  const dailyTrends = dates.map((d) => ({
    date: d,
    totalClicks: 0,
    qrClicks: 0,
    directClicks: 0,
  }));

  const qrVsDirectOverTime = dates.map((d) => ({
    date: d,
    qr: 0,
    direct: 0,
    total: 0,
  }));

  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    count: 0,
    qrClicks: 0,
    directClicks: 0,
  }));

  const heatmapGrid = [];
  const heatmapDays = DAY_INFO.map((d) => {
    const hours = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      heatmapGrid.push({
        dayOfWeek: d.dayOfWeek,
        dayName: d.short,
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        count: 0,
      });
    }
    return {
      dayOfWeek: d.dayOfWeek,
      dayName: d.name,
      shortName: d.short,
      totalClicks: 0,
      hours,
    };
  });

  const deviceDistribution = [
    { deviceType: "mobile", label: "Mobile", count: 0, percentage: 0, qrClicks: 0, directClicks: 0 },
    { deviceType: "desktop", label: "Desktop", count: 0, percentage: 0, qrClicks: 0, directClicks: 0 },
    { deviceType: "tablet", label: "Tablet", count: 0, percentage: 0, qrClicks: 0, directClicks: 0 },
    { deviceType: "unknown", label: "Unknown", count: 0, percentage: 0, qrClicks: 0, directClicks: 0 },
  ];

  return {
    summary: {
      totalClicks: 0,
      qrClicks: 0,
      directClicks: 0,
      qrPercentage: 0,
      directPercentage: 0,
      peakHour: null,
      peakHourLabel: "N/A",
      peakHourClicks: 0,
      topDayOfWeek: "N/A",
      topDayClicks: 0,
      topDevice: "N/A",
      topCampaign: "None",
    },
    dailyTrends,
    hourlyDistribution,
    qrVsDirectOverTime,
    deviceDistribution,
    campaignTrends: {
      topCampaigns: [],
      dailySeries: [],
    },
    heatmap: {
      grid: heatmapGrid,
      days: heatmapDays,
    },
  };
};

const getTrafficAnalytics = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request",
      });
    }

    const rawRange = (req.query.range || "7d").toString().toLowerCase().trim();
    const range = rawRange === "30d" || rawRange === "all" ? rawRange : "7d";

    // 1. User Isolation: Find only links owned by the authenticated user
    const userLinks = await Link.find({ user: userId })
      .select("_id")
      .lean();

    if (userLinks.length === 0) {
      return res.status(200).json({
        success: true,
        range,
        data: buildEmptyTrafficData(range),
      });
    }

    const linkIds = userLinks.map((l) => l._id);

    // 2. Date Filtering in IST boundaries
    const matchCondition = {
      link: { $in: linkIds },
    };

    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    // 3. Faceted Aggregation in IST Timezone (+05:30)
    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $facet: {
          // Overall totals
          summary: [
            {
              $group: {
                _id: null,
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
          ],

          // Daily trends (grouped by IST date: YYYY-MM-DD)
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
                totalClicks: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // Hourly distribution (grouped by IST hour: 0 to 23)
          hourlyDistribution: [
            {
              $group: {
                _id: {
                  $hour: {
                    date: "$clickedAt",
                    timezone: "+05:30",
                  },
                },
                count: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // Heatmap: Day of Week (1=Sun, 7=Sat) x Hour (0 to 23) in IST
          heatmap: [
            {
              $group: {
                _id: {
                  dayOfWeek: {
                    $dayOfWeek: {
                      date: "$clickedAt",
                      timezone: "+05:30",
                    },
                  },
                  hour: {
                    $hour: {
                      date: "$clickedAt",
                      timezone: "+05:30",
                    },
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
          ],

          // Device distribution (mobile, desktop, tablet, unknown)
          deviceDistribution: [
            {
              $group: {
                _id: { $ifNull: ["$deviceType", "unknown"] },
                count: { $sum: 1 },
                qrClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] },
                },
                directClicks: {
                  $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] },
                },
              },
            },
            { $sort: { count: -1 } },
          ],

          // Campaign daily clicks
          campaignDaily: [
            {
              $match: {
                utmCampaign: {
                  $exists: true,
                  $ne: null,
                  $nin: ["", "none", "null"],
                },
              },
            },
            {
              $group: {
                _id: {
                  campaign: "$utmCampaign",
                  date: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$clickedAt",
                      timezone: "+05:30",
                    },
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { "_id.date": 1 } },
          ],

          // Top 5 campaigns by volume
          topCampaigns: [
            {
              $match: {
                utmCampaign: {
                  $exists: true,
                  $ne: null,
                  $nin: ["", "none", "null"],
                },
              },
            },
            {
              $group: {
                _id: "$utmCampaign",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]);

    const summaryData = aggResult?.summary?.[0] || {
      totalClicks: 0,
      qrClicks: 0,
      directClicks: 0,
    };
    const totalClicks = summaryData.totalClicks || 0;
    const qrClicks = summaryData.qrClicks || 0;
    const directClicks = summaryData.directClicks || 0;

    const rawDaily = aggResult?.dailyTrends || [];
    const rawHourly = aggResult?.hourlyDistribution || [];
    const rawHeatmap = aggResult?.heatmap || [];
    const rawDevices = aggResult?.deviceDistribution || [];
    const rawCampaignDaily = aggResult?.campaignDaily || [];
    const rawTopCampaigns = aggResult?.topCampaigns || [];

    // Construct contiguous date range for daily trends
    const todayStr = getISTDateStr();
    let dates = [];
    if (range === "7d") {
      dates = generateISTDateList(7, todayStr);
    } else if (range === "30d") {
      dates = generateISTDateList(30, todayStr);
    } else {
      // "all"
      if (rawDaily.length > 0) {
        const earliest = rawDaily[0]._id;
        const span = getDaysDiff(earliest, todayStr);
        dates = generateISTDateList(Math.max(7, span), todayStr);
      } else {
        dates = generateISTDateList(7, todayStr);
      }
    }

    const dailyMap = new Map();
    rawDaily.forEach((item) => {
      if (item._id) {
        dailyMap.set(item._id, item);
      }
    });

    const dailyTrends = dates.map((d) => {
      const item = dailyMap.get(d);
      return {
        date: d,
        totalClicks: item?.totalClicks || 0,
        qrClicks: item?.qrClicks || 0,
        directClicks: item?.directClicks || 0,
      };
    });

    const qrVsDirectOverTime = dates.map((d) => {
      const item = dailyMap.get(d);
      const qr = item?.qrClicks || 0;
      const direct = item?.directClicks || 0;
      return {
        date: d,
        qr,
        direct,
        total: qr + direct,
      };
    });

    // Hourly distribution zero-filled for all 24 hours
    const hourlyMap = new Map();
    let peakHour = null;
    let peakHourClicks = 0;

    rawHourly.forEach((item) => {
      if (item._id !== null && item._id !== undefined) {
        hourlyMap.set(item._id, item);
        if ((item.count || 0) > peakHourClicks) {
          peakHourClicks = item.count;
          peakHour = item._id;
        }
      }
    });

    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => {
      const item = hourlyMap.get(h);
      return {
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        count: item?.count || 0,
        qrClicks: item?.qrClicks || 0,
        directClicks: item?.directClicks || 0,
      };
    });

    // Heatmap zero-filled for 7 days x 24 hours
    const heatmapMap = new Map();
    const dayTotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };

    rawHeatmap.forEach((item) => {
      const dow = item._id?.dayOfWeek;
      const h = item._id?.hour;
      if (dow && h !== undefined) {
        heatmapMap.set(`${dow}_${h}`, item.count || 0);
        dayTotals[dow] = (dayTotals[dow] || 0) + (item.count || 0);
      }
    });

    let topDayOfWeek = "N/A";
    let topDayClicks = 0;
    Object.entries(dayTotals).forEach(([dowStr, count]) => {
      if (count > topDayClicks) {
        topDayClicks = count;
        topDayOfWeek = DAY_INFO.find((d) => d.dayOfWeek === Number(dowStr))?.name || "N/A";
      }
    });

    const heatmapGrid = [];
    const heatmapDays = DAY_INFO.map((d) => {
      const hours = [];
      for (let h = 0; h < 24; h++) {
        const count = heatmapMap.get(`${d.dayOfWeek}_${h}`) || 0;
        hours.push(count);
        heatmapGrid.push({
          dayOfWeek: d.dayOfWeek,
          dayName: d.short,
          hour: h,
          label: `${String(h).padStart(2, "0")}:00`,
          count,
        });
      }
      return {
        dayOfWeek: d.dayOfWeek,
        dayName: d.name,
        shortName: d.short,
        totalClicks: dayTotals[d.dayOfWeek] || 0,
        hours,
      };
    });

    // Device distribution
    const devMap = new Map();
    rawDevices.forEach((item) => {
      if (item._id) {
        devMap.set(item._id.toLowerCase(), item);
      }
    });

    const KNOWN_DEV_TYPES = ["mobile", "desktop", "tablet", "unknown"];
    let topDevice = "N/A";
    let maxDevCount = 0;

    const deviceDistribution = KNOWN_DEV_TYPES.map((type) => {
      const item = devMap.get(type);
      const count = item?.count || 0;
      if (count > maxDevCount) {
        maxDevCount = count;
        topDevice = type.charAt(0).toUpperCase() + type.slice(1);
      }
      const percentage = totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0;
      return {
        deviceType: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage,
        qrClicks: item?.qrClicks || 0,
        directClicks: item?.directClicks || 0,
      };
    });

    // Campaign Trends
    const topCampaignsList = rawTopCampaigns.map((tc) => ({
      campaign: tc._id,
      count: tc.count,
      percentage: totalClicks > 0 ? Math.round((tc.count / totalClicks) * 100) : 0,
    }));

    const campaignDateMap = new Map();
    rawCampaignDaily.forEach((entry) => {
      const camp = entry._id?.campaign;
      const dateStr = entry._id?.date;
      if (camp && dateStr) {
        const key = `${camp}_${dateStr}`;
        campaignDateMap.set(key, entry.count || 0);
      }
    });

    const campaignDailySeries = topCampaignsList.map((tc) => {
      const data = dates.map((d) => ({
        date: d,
        count: campaignDateMap.get(`${tc.campaign}_${d}`) || 0,
      }));
      return {
        campaign: tc.campaign,
        totalClicks: tc.count,
        data,
      };
    });

    const topCampaignName = topCampaignsList.length > 0 ? topCampaignsList[0].campaign : "None";

    const qrPercentage = totalClicks > 0 ? Math.round((qrClicks / totalClicks) * 100) : 0;
    const directPercentage = totalClicks > 0 ? Math.round((directClicks / totalClicks) * 100) : 0;

    const summary = {
      totalClicks,
      qrClicks,
      directClicks,
      qrPercentage,
      directPercentage,
      peakHour,
      peakHourLabel: peakHour !== null ? formatHourLabel(peakHour) : "N/A",
      peakHourClicks,
      topDayOfWeek,
      topDayClicks,
      topDevice,
      topCampaign: topCampaignName,
    };

    return res.status(200).json({
      success: true,
      range,
      data: {
        summary,
        dailyTrends,
        hourlyDistribution,
        qrVsDirectOverTime,
        deviceDistribution,
        campaignTrends: {
          topCampaigns: topCampaignsList,
          dailySeries: campaignDailySeries,
        },
        heatmap: {
          grid: heatmapGrid,
          days: heatmapDays,
        },
      },
    });
  } catch (error) {
    console.error("Get traffic analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch traffic analytics",
    });
  }
};

export {
  createLink,
  redirectLink,
  getClickHistory,
  getLinkAnalytics,
  getAllLinksAnalytics,
  getMyLinks,
  getCampaignAnalytics,
  getQRAnalytics,
  updateLinkAccess,
  togglePauseLink,
  getGeoAnalytics,
  getDeviceAnalytics,
  getTrafficAnalytics,
};
