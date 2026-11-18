// =============================================================================
// Stage 14: Report Data Aggregator Utility — 2026-11-19
// Aggregates real MongoDB Click, Link, Anomaly, and Experiment data for PDF & CSV
// reports strictly scoped to the authenticated user with IST calendar boundaries.
// =============================================================================

import mongoose from "mongoose";
import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
import Anomaly from "../models/anomaly.model.js";
import Experiment from "../models/experiment.model.js";

// Safe helper for formatting Date to IST string
export const formatISTDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  try {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toISOString();
  }
};

// Format short IST date (e.g. "19 Nov 2026")
export const formatShortISTDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  try {
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

// Calculate midnight IST boundary for the past N calendar days, converted to UTC Date
export const getISTCalendarStart = (days) => {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [year, month, day] = todayStr.split("-").map(Number);
  const midnightUtcForIst = Date.UTC(year, month - 1, day - (days - 1), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(midnightUtcForIst);
};

// Generate list of continuous IST date strings (YYYY-MM-DD)
export const generateISTDateList = (days, baseDateStr) => {
  const todayStr = baseDateStr || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [year, month, day] = todayStr.split("-").map(Number);
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(year, month - 1, day - i, 12, 0, 0));
    list.push(dt.toISOString().slice(0, 10));
  }
  return list;
};

/**
 * Aggregates all data required for a specific report category.
 *
 * @param {string|ObjectId} userId - Authenticated user's ObjectId
 * @param {string} type - Report category ("overall", "links", "qr", "geo", "devices", "campaigns", "traffic", "anomalies", "experiments")
 * @param {string} range - Date range ("7d", "30d", "all")
 * @param {Object} options - Optional filters such as linkId / shortCode
 */
export async function aggregateReportData(userId, type, range = "all", options = {}) {
  const validRanges = ["7d", "30d", "all"];
  const selectedRange = validRanges.includes(range?.toLowerCase()) ? range.toLowerCase() : "all";
  const userOid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const generatedAt = new Date();
  const generatedAtIST = formatISTDate(generatedAt);

  // Range label for headers and summaries
  const rangeLabels = {
    "7d": "Last 7 Days (IST)",
    "30d": "Last 30 Days (IST)",
    "all": "All Time",
  };
  const rangeLabel = rangeLabels[selectedRange] || "All Time";

  // Base date filter
  let dateFilter = {};
  if (selectedRange === "7d") {
    dateFilter = { clickedAt: { $gte: getISTCalendarStart(7) } };
  } else if (selectedRange === "30d") {
    dateFilter = { clickedAt: { $gte: getISTCalendarStart(30) } };
  }

  // Fetch all user links
  const userLinks = await Link.find({ user: userOid }).sort({ createdAt: -1 }).lean();
  const userLinkIds = userLinks.map((l) => l._id);

  // Common metadata envelope
  const reportMeta = {
    platform: "Smart Link Management Platform",
    reportType: type,
    range: selectedRange,
    rangeLabel,
    generatedAt,
    generatedAtIST,
    totalUserLinks: userLinks.length,
  };

  // CHANGE: Stage 14 PDF & Reports Fix: Full-schema default envelopes for zero-link users — 2026-11-19
  if (userLinkIds.length === 0 && type !== "anomalies" && type !== "experiments") {
    const emptyEnvelopes = {
      overall: {
        meta: reportMeta,
        summary: {
          totalLinks: 0,
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          qrPercent: 0,
          uniqueCountries: 0,
        },
        links: [],
        topCountries: [],
        deviceBreakdown: [],
        isEmpty: true,
      },
      links: {
        meta: { ...reportMeta, isSingleLink: false, targetShortCode: "All Links" },
        summary: {
          totalLinksEvaluated: 0,
          totalClicks: 0,
          totalLogsIncluded: 0,
        },
        links: [],
        recentLogs: [],
        isEmpty: true,
      },
      qr: {
        meta: reportMeta,
        summary: {
          totalClicks: 0,
          qrClicks: 0,
          directClicks: 0,
          qrPercentage: 0,
          activeQRLinksCount: 0,
        },
        qrLinks: [],
        dailyTrend: [],
        isEmpty: true,
      },
      geo: {
        meta: reportMeta,
        summary: {
          totalClicks: 0,
          totalCountries: 0,
          totalCities: 0,
          topCountry: "N/A",
          topCity: "N/A",
        },
        countries: [],
        cities: [],
        isEmpty: true,
      },
      devices: {
        meta: reportMeta,
        summary: {
          totalClicks: 0,
          topDeviceType: "N/A",
          topOS: "N/A",
          topBrowser: "N/A",
        },
        devices: [],
        operatingSystems: [],
        browsers: [],
        vendors: [],
        isEmpty: true,
      },
      campaigns: {
        meta: reportMeta,
        summary: {
          totalClicks: 0,
          activeCampaignsCount: 0,
          topCampaign: "N/A",
          topSource: "N/A",
        },
        campaigns: [],
        sources: [],
        mediums: [],
        isEmpty: true,
      },
      traffic: {
        meta: reportMeta,
        summary: {
          totalClicks: 0,
          peakHour: "N/A",
          peakDay: "N/A",
        },
        hourlyDistribution: Array.from({ length: 24 }, (_, hr) => ({
          hour: hr,
          hourLabel:
            hr === 0
              ? "12 AM IST"
              : hr < 12
              ? `${hr} AM IST`
              : hr === 12
              ? "12 PM IST"
              : `${hr - 12} PM IST`,
          clicks: 0,
          qrClicks: 0,
          directClicks: 0,
        })),
        dailyTrends: [],
        isEmpty: true,
      },
    };

    if (emptyEnvelopes[type]) {
      return emptyEnvelopes[type];
    }

    return {
      meta: reportMeta,
      summary: { totalClicks: 0, totalLinks: 0 },
      data: [],
      isEmpty: true,
    };
  }

  // Handle each report type
  switch (type) {
    // -------------------------------------------------------------------------
    // 1. Overall Dashboard Report
    // -------------------------------------------------------------------------
    case "overall": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [clickStats, geoStats, deviceStats, linkClicksAgg] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalClicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$country", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$deviceType", "unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$link",
              clicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
        ]),
      ]);

      const totalClicks = clickStats[0]?.totalClicks || 0;
      const qrClicks = clickStats[0]?.qrClicks || 0;
      const directClicks = clickStats[0]?.directClicks || 0;
      const qrPercent = totalClicks > 0 ? Math.round((qrClicks / totalClicks) * 100) : 0;

      const linkClickMap = new Map();
      linkClicksAgg.forEach((item) => {
        linkClickMap.set(String(item._id), item);
      });

      const linksTable = userLinks.map((link) => {
        const stats = linkClickMap.get(String(link._id)) || { clicks: 0, qrClicks: 0, directClicks: 0 };
        return {
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          totalClicks: selectedRange === "all" ? Math.max(link.clicks || 0, stats.clicks) : stats.clicks,
          qrClicks: stats.qrClicks,
          directClicks: stats.directClicks,
          createdAtIST: formatShortISTDate(link.createdAt),
          isPaused: Boolean(link.isPaused),
        };
      });

      // Sort by totalClicks descending
      linksTable.sort((a, b) => b.totalClicks - a.totalClicks);

      return {
        meta: reportMeta,
        summary: {
          totalLinks: userLinks.length,
          totalClicks,
          qrClicks,
          directClicks,
          qrPercent,
          uniqueCountries: geoStats.length,
        },
        links: linksTable,
        topCountries: geoStats.map((g) => ({
          country: g._id,
          clicks: g.count,
          percentage: totalClicks > 0 ? Math.round((g.count / totalClicks) * 100) : 0,
        })),
        deviceBreakdown: deviceStats.map((d) => ({
          deviceType: d._id,
          clicks: d.count,
          percentage: totalClicks > 0 ? Math.round((d.count / totalClicks) * 100) : 0,
        })),
        isEmpty: totalClicks === 0 && userLinks.length === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 2. Individual Link Performance Report
    // -------------------------------------------------------------------------
    case "links": {
      let targetLinkIds = userLinkIds;
      let singleTargetLink = null;

      if (options.linkId || options.shortCode) {
        const query = { user: userOid };
        if (options.linkId && mongoose.Types.ObjectId.isValid(options.linkId)) {
          query._id = options.linkId;
        } else if (options.shortCode) {
          query.shortCode = options.shortCode;
        }
        singleTargetLink = await Link.findOne(query).lean();
        if (singleTargetLink) {
          targetLinkIds = [singleTargetLink._id];
        }
      }

      const matchQuery = { link: { $in: targetLinkIds }, ...dateFilter };

      const [clicksByLink, recentClicks] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$link",
              totalClicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
        ]),
        Click.find(matchQuery)
          .sort({ clickedAt: -1 })
          .limit(options.limit || 50)
          .populate("link", "shortCode originalUrl")
          .lean(),
      ]);

      const clickMap = new Map();
      clicksByLink.forEach((c) => clickMap.set(String(c._id), c));

      const activeLinksList = singleTargetLink ? [singleTargetLink] : userLinks;

      const linksPerformance = activeLinksList.map((link) => {
        const stats = clickMap.get(String(link._id)) || { totalClicks: 0, qrClicks: 0, directClicks: 0 };
        const clicks = selectedRange === "all" ? Math.max(link.clicks || 0, stats.totalClicks) : stats.totalClicks;
        const qr = stats.qrClicks;
        const direct = Math.max(0, clicks - qr);
        return {
          id: String(link._id),
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          totalClicks: clicks,
          qrClicks: qr,
          directClicks: direct,
          qrPercentage: clicks > 0 ? Math.round((qr / clicks) * 100) : 0,
          createdAtIST: formatISTDate(link.createdAt),
          status: link.isPaused ? "Paused" : "Active",
          hasPassword: Boolean(link.password),
          expiresAtIST: link.expiresAt ? formatISTDate(link.expiresAt) : "Never",
          maxClicks: link.maxClicks || "Unlimited",
          campaign: link.utmCampaign || "None",
        };
      });

      linksPerformance.sort((a, b) => b.totalClicks - a.totalClicks);

      const totalClicks = linksPerformance.reduce((acc, l) => acc + l.totalClicks, 0);

      const logs = recentClicks.map((c) => ({
        timestampIST: formatISTDate(c.clickedAt),
        shortCode: c.link?.shortCode || "N/A",
        originalUrl: c.link?.originalUrl || "N/A",
        deviceType: c.deviceType || "unknown",
        browser: c.browser || "Unknown",
        os: c.operatingSystem || "Unknown",
        country: c.country || "Unknown",
        city: c.city || "Unknown",
        channel: c.isQR ? "QR Code" : "Direct Link",
      }));

      return {
        meta: {
          ...reportMeta,
          isSingleLink: Boolean(singleTargetLink),
          targetShortCode: singleTargetLink?.shortCode || "All Links",
        },
        summary: {
          totalLinksEvaluated: activeLinksList.length,
          totalClicks,
          totalLogsIncluded: logs.length,
        },
        links: linksPerformance,
        recentLogs: logs,
        isEmpty: linksPerformance.length === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 3. QR Analytics Report
    // -------------------------------------------------------------------------
    case "qr": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [overallQrStats, qrLinksAgg, qrDailyAgg] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalClicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$link",
              totalClicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
          { $sort: { qrClicks: -1 } },
        ]),
        Click.aggregate([
          { $match: { ...matchQuery, isQR: true } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$clickedAt",
                  timezone: "Asia/Kolkata",
                },
              },
              qrCount: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const totalClicks = overallQrStats[0]?.totalClicks || 0;
      const qrClicks = overallQrStats[0]?.qrClicks || 0;
      const directClicks = overallQrStats[0]?.directClicks || 0;
      const qrPercentage = totalClicks > 0 ? Math.round((qrClicks / totalClicks) * 100) : 0;

      const linkMap = new Map();
      userLinks.forEach((l) => linkMap.set(String(l._id), l));

      const qrLinksTable = qrLinksAgg.map((item) => {
        const link = linkMap.get(String(item._id));
        const total = item.totalClicks || 0;
        const qr = item.qrClicks || 0;
        return {
          shortCode: link?.shortCode || "N/A",
          originalUrl: link?.originalUrl || "N/A",
          totalClicks: total,
          qrClicks: qr,
          directClicks: item.directClicks || 0,
          qrPercentage: total > 0 ? Math.round((qr / total) * 100) : 0,
          createdAtIST: link ? formatShortISTDate(link.createdAt) : "N/A",
        };
      });

      return {
        meta: reportMeta,
        summary: {
          totalClicks,
          qrClicks,
          directClicks,
          qrPercentage,
          activeQRLinksCount: qrLinksTable.filter((l) => l.qrClicks > 0).length,
        },
        qrLinks: qrLinksTable,
        dailyTrend: qrDailyAgg.map((d) => ({
          dateIST: d._id,
          qrScans: d.qrCount,
        })),
        isEmpty: totalClicks === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 4. Geo-Location Analytics Report
    // -------------------------------------------------------------------------
    case "geo": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [countryAgg, cityAgg, totalGeo] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                country: { $ifNull: ["$country", "Unknown"] },
                code: { $ifNull: ["$countryCode", "NA"] },
              },
              clicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
          { $sort: { clicks: -1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                city: { $ifNull: ["$city", "Unknown"] },
                country: { $ifNull: ["$country", "Unknown"] },
              },
              clicks: { $sum: 1 },
            },
          },
          { $sort: { clicks: -1 } },
          { $limit: 25 },
        ]),
        Click.countDocuments(matchQuery),
      ]);

      const countries = countryAgg.map((c) => ({
        country: c._id.country,
        countryCode: c._id.code,
        clicks: c.clicks,
        qrClicks: c.qrClicks,
        directClicks: c.directClicks,
        percentage: totalGeo > 0 ? Math.round((c.clicks / totalGeo) * 100) : 0,
      }));

      const cities = cityAgg.map((c) => ({
        city: c._id.city,
        country: c._id.country,
        clicks: c.clicks,
        percentage: totalGeo > 0 ? Math.round((c.clicks / totalGeo) * 100) : 0,
      }));

      return {
        meta: reportMeta,
        summary: {
          totalClicks: totalGeo,
          totalCountries: countries.length,
          totalCities: cities.length,
          topCountry: countries[0]?.country || "N/A",
          topCity: cities[0]?.city || "N/A",
        },
        countries,
        cities,
        isEmpty: totalGeo === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 5. Device & Browser Analytics Report
    // -------------------------------------------------------------------------
    case "devices": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [deviceTypeAgg, osAgg, browserAgg, vendorAgg, totalClicks] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$deviceType", "unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$operatingSystem", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$browser", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          { $group: { _id: { $ifNull: ["$deviceVendor", "Unknown"] }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.countDocuments(matchQuery),
      ]);

      const formatItems = (arr) =>
        arr.map((item) => ({
          name: item._id,
          clicks: item.count,
          percentage: totalClicks > 0 ? Math.round((item.count / totalClicks) * 100) : 0,
        }));

      return {
        meta: reportMeta,
        summary: {
          totalClicks,
          topDeviceType: deviceTypeAgg[0]?._id || "N/A",
          topOS: osAgg[0]?._id || "N/A",
          topBrowser: browserAgg[0]?._id || "N/A",
        },
        devices: formatItems(deviceTypeAgg),
        operatingSystems: formatItems(osAgg),
        browsers: formatItems(browserAgg),
        vendors: formatItems(vendorAgg),
        isEmpty: totalClicks === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 6. Campaign Analytics Report
    // -------------------------------------------------------------------------
    case "campaigns": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [campaignAgg, sourceAgg, mediumAgg, totalClicks] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                campaign: { $ifNull: ["$utmCampaign", "Direct / Untracked"] },
                source: { $ifNull: ["$utmSource", "None"] },
                medium: { $ifNull: ["$utmMedium", "None"] },
              },
              clicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
          { $sort: { clicks: -1 } },
        ]),
        Click.aggregate([
          { $match: { ...matchQuery, utmSource: { $ne: null } } },
          { $group: { _id: "$utmSource", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.aggregate([
          { $match: { ...matchQuery, utmMedium: { $ne: null } } },
          { $group: { _id: "$utmMedium", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Click.countDocuments(matchQuery),
      ]);

      const campaigns = campaignAgg.map((c) => ({
        campaign: c._id.campaign,
        source: c._id.source,
        medium: c._id.medium,
        clicks: c.clicks,
        qrClicks: c.qrClicks,
        directClicks: c.directClicks,
        percentage: totalClicks > 0 ? Math.round((c.clicks / totalClicks) * 100) : 0,
      }));

      return {
        meta: reportMeta,
        summary: {
          totalClicks,
          activeCampaignsCount: campaigns.filter((c) => c.campaign !== "Direct / Untracked").length,
          topCampaign: campaigns.find((c) => c.campaign !== "Direct / Untracked")?.campaign || "Direct / Untracked",
          topSource: sourceAgg[0]?._id || "None",
        },
        campaigns,
        sources: sourceAgg.map((s) => ({
          name: s._id,
          clicks: s.count,
          percentage: totalClicks > 0 ? Math.round((s.count / totalClicks) * 100) : 0,
        })),
        mediums: mediumAgg.map((m) => ({
          name: m._id,
          clicks: m.count,
          percentage: totalClicks > 0 ? Math.round((m.count / totalClicks) * 100) : 0,
        })),
        isEmpty: totalClicks === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 7. Traffic Analytics Report
    // -------------------------------------------------------------------------
    case "traffic": {
      const matchQuery = { link: { $in: userLinkIds }, ...dateFilter };

      const [hourlyAgg, dailyAgg, totalClicks] = await Promise.all([
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                $hour: {
                  date: "$clickedAt",
                  timezone: "Asia/Kolkata",
                },
              },
              clicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Click.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$clickedAt",
                  timezone: "Asia/Kolkata",
                },
              },
              clicks: { $sum: 1 },
              qrClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 1, 0] } },
              directClicks: { $sum: { $cond: [{ $eq: ["$isQR", true] }, 0, 1] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Click.countDocuments(matchQuery),
      ]);

      const hourMap = new Map();
      hourlyAgg.forEach((h) => hourMap.set(h._id, h));

      const hourlyDistribution = [];
      for (let hr = 0; hr < 24; hr++) {
        const item = hourMap.get(hr) || { clicks: 0, qrClicks: 0, directClicks: 0 };
        const hourLabel =
          hr === 0
            ? "12 AM IST"
            : hr < 12
            ? `${hr} AM IST`
            : hr === 12
            ? "12 PM IST"
            : `${hr - 12} PM IST`;
        hourlyDistribution.push({
          hour: hr,
          hourLabel,
          clicks: item.clicks,
          qrClicks: item.qrClicks,
          directClicks: item.directClicks,
        });
      }

      // Find peak hour
      let peakHour = hourlyDistribution[0];
      hourlyDistribution.forEach((h) => {
        if (h.clicks > peakHour.clicks) peakHour = h;
      });

      const dailyTrends = dailyAgg.map((d) => ({
        dateIST: d._id,
        clicks: d.clicks,
        qrClicks: d.qrClicks,
        directClicks: d.directClicks,
      }));

      // Find peak day
      let peakDay = dailyTrends[0] || { dateIST: "N/A", clicks: 0 };
      dailyTrends.forEach((d) => {
        if (d.clicks > peakDay.clicks) peakDay = d;
      });

      return {
        meta: reportMeta,
        summary: {
          totalClicks,
          peakHour: peakHour.clicks > 0 ? `${peakHour.hourLabel} (${peakHour.clicks} clicks)` : "N/A",
          peakDay: peakDay.clicks > 0 ? `${peakDay.dateIST} (${peakDay.clicks} clicks)` : "N/A",
        },
        hourlyDistribution,
        dailyTrends,
        isEmpty: totalClicks === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 8. Anomaly Detection Report
    // -------------------------------------------------------------------------
    case "anomalies": {
      const anomalyQuery = { user: userOid };
      if (selectedRange === "7d") {
        anomalyQuery.createdAt = { $gte: getISTCalendarStart(7) };
      } else if (selectedRange === "30d") {
        anomalyQuery.createdAt = { $gte: getISTCalendarStart(30) };
      }

      const anomaliesList = await Anomaly.find(anomalyQuery)
        .sort({ createdAt: -1 })
        .populate("link", "shortCode originalUrl")
        .lean();

      let spikeCount = 0;
      let dropCount = 0;
      anomaliesList.forEach((a) => {
        if (a.type === "SPIKE") spikeCount++;
        if (a.type === "DROP") dropCount++;
      });

      const totalAnomalies = anomaliesList.length;
      let healthScore = 100;
      if (totalAnomalies > 0) {
        healthScore = Math.max(10, 100 - (spikeCount * 15 + dropCount * 25));
      }
      const healthRating =
        healthScore >= 90
          ? "EXCELLENT"
          : healthScore >= 75
          ? "GOOD"
          : healthScore >= 50
          ? "FAIR"
          : "CRITICAL";

      const formattedAnomalies = anomaliesList.map((a) => ({
        id: String(a._id),
        detectedAtIST: formatISTDate(a.createdAt),
        shortCode: a.shortCode,
        originalUrl: a.originalUrl || a.link?.originalUrl || "N/A",
        type: a.type === "SPIKE" ? "Traffic Surge" : "Traffic Drop",
        severity: a.severity,
        status: a.status,
        currentClicks: a.currentClicks,
        baselineAverage: Number(a.baselineAverage || 0).toFixed(1),
        percentageDeviation:
          a.percentageDeviation !== null && a.percentageDeviation !== undefined
            ? `${a.percentageDeviation > 0 ? "+" : ""}${a.percentageDeviation}%`
            : "N/A",
        absoluteDifference: a.absoluteDifference,
        description: a.description || "",
      }));

      return {
        meta: reportMeta,
        summary: {
          fleetHealthScore: `${healthScore}%`,
          healthRating,
          totalAnomalies,
          spikeCount,
          dropCount,
        },
        anomalies: formattedAnomalies,
        isEmpty: totalAnomalies === 0,
      };
    }

    // -------------------------------------------------------------------------
    // 9. A/B Experiment Performance Report
    // -------------------------------------------------------------------------
    case "experiments": {
      const experimentsList = await Experiment.find({ user: userOid })
        .sort({ createdAt: -1 })
        .populate("link", "shortCode clicks")
        .lean();

      if (experimentsList.length === 0) {
        return {
          meta: reportMeta,
          summary: {
            totalExperiments: 0,
            activeExperiments: 0,
            totalClicks: 0,
            totalClicksRecorded: 0,
          },
          experiments: [],
          isEmpty: true,
        };
      }

      const expIds = experimentsList.map((e) => e._id);
      const matchQuery = { experimentId: { $in: expIds }, ...dateFilter };

      const clickStats = await Click.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: { expId: "$experimentId", variant: "$experimentVariant" },
            clicks: { $sum: 1 },
          },
        },
      ]);

      const expStatsMap = new Map();
      clickStats.forEach((cs) => {
        const id = String(cs._id.expId);
        if (!expStatsMap.has(id)) {
          expStatsMap.set(id, { variantA: 0, variantB: 0 });
        }
        if (cs._id.variant === "A") expStatsMap.get(id).variantA = cs.clicks;
        if (cs._id.variant === "B") expStatsMap.get(id).variantB = cs.clicks;
      });

      let grandTotalClicks = 0;
      let activeCount = 0;

      const formattedExperiments = experimentsList.map((exp) => {
        const id = String(exp._id);
        const stats = expStatsMap.get(id) || { variantA: 0, variantB: 0 };
        const clicksA = stats.variantA;
        const clicksB = stats.variantB;
        const total = clicksA + clicksB;
        grandTotalClicks += total;
        if (exp.status === "active") activeCount++;

        const percentA = total > 0 ? Math.round((clicksA / total) * 100) : 50;
        const percentB = total > 0 ? Math.round((clicksB / total) * 100) : 50;

        let winner = "Tie / Inconclusive";
        if (clicksA > clicksB) winner = "Variant A";
        else if (clicksB > clicksA) winner = "Variant B";

        return {
          id,
          name: exp.name,
          shortCode: exp.link?.shortCode || "N/A",
          status: exp.status,
          fallbackVariant: `Variant ${exp.fallbackVariant || "A"}`,
          variantAUrl: exp.variantA,
          variantBUrl: exp.variantB,
          variantAClicks: clicksA,
          variantAPercent: `${percentA}%`,
          variantBClicks: clicksB,
          variantBPercent: `${percentB}%`,
          totalClicks: total,
          winner,
          leadMargin: Math.abs(clicksA - clicksB),
          createdAtIST: formatISTDate(exp.createdAt),
        };
      });

      return {
        meta: reportMeta,
        summary: {
          totalExperiments: experimentsList.length,
          activeExperiments: activeCount,
          totalClicksRecorded: grandTotalClicks,
        },
        experiments: formattedExperiments,
        isEmpty: experimentsList.length === 0,
      };
    }

    default:
      throw new Error(`Invalid report type: ${type}`);
  }
}
