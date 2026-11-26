import Link from "../models/link.model.js";
import Click from "../models/click.model.js";

// Helper: Format IST date string (YYYY-MM-DD)
function getISTDateStr(date = new Date()) {
  const d = new Date(date);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffsetMs);
  return istTime.toISOString().slice(0, 10);
}

// Helper: Format IST readable timestamp
function formatISTTimestamp(date = new Date()) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// -----------------------------------------------------------------------------
// 1. GET /api/analytics/activity?year=2026
// -----------------------------------------------------------------------------
export const getActivityAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const now = new Date();
    const todayIST = getISTDateStr(now);
    const currentYearIST = parseInt(todayIST.slice(0, 4), 10);
    const targetYear = parseInt(req.query.year, 10) || currentYearIST;

    // 1. Fetch user's links
    const userLinks = await Link.find({ user: userId })
      .select("_id shortCode originalUrl clicks createdAt")
      .lean();

    const linkIds = userLinks.map((l) => l._id);

    // If user has no links
    if (linkIds.length === 0) {
      return res.status(200).json({
        success: true,
        year: targetYear,
        dailyCounts: {},
        byWeekday: [0, 0, 0, 0, 0, 0, 0],
        byHourWeekday: Array.from({ length: 7 }, () => Array(24).fill(0)),
        currentStreak: 0,
        longestStreak: 0,
        activeDays: 0,
        busiestDay: null,
        busiestMonth: null,
        weeklyCounts: Array.from({ length: 26 }, (_, i) => ({
          weekIndex: i,
          clicks: 0,
          label: "",
        })),
        monthlyCounts: Array(12).fill(0),
        total: 0,
      });
    }

    // Target year time window in IST (+05:30)
    // Jan 1 00:00:00 IST = prev year Dec 31 18:30:00 UTC
    // Dec 31 23:59:59.999 IST = curr year Dec 31 18:29:59.999 UTC
    const yearStartUTC = new Date(Date.UTC(targetYear, 0, 1) - 5.5 * 3600 * 1000);
    const yearEndUTC = new Date(Date.UTC(targetYear + 1, 0, 1) - 5.5 * 3600 * 1000);

    const [aggResult] = await Click.aggregate([
      {
        $match: {
          link: { $in: linkIds },
          clickedAt: { $gte: yearStartUTC, $lt: yearEndUTC },
        },
      },
      {
        $facet: {
          daily: [
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
          weekday: [
            {
              $group: {
                _id: {
                  $isoDayOfWeek: {
                    date: "$clickedAt",
                    timezone: "+05:30",
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          hourWeekday: [
            {
              $group: {
                _id: {
                  day: {
                    $isoDayOfWeek: {
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
          ],
          monthly: [
            {
              $group: {
                _id: {
                  $month: {
                    date: "$clickedAt",
                    timezone: "+05:30",
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    // A. dailyCounts: date to clicks, ONLY up to today in IST
    const dailyCounts = {};
    (aggResult?.daily || []).forEach((d) => {
      if (d._id <= todayIST) {
        dailyCounts[d._id] = d.count;
      }
    });

    // B. byWeekday[7]: 0=Mon .. 6=Sun
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    (aggResult?.weekday || []).forEach((w) => {
      const idx = w._id - 1; // 1=Mon -> 0, 7=Sun -> 6
      if (idx >= 0 && idx < 7) {
        byWeekday[idx] = w.count;
      }
    });

    // C. byHourWeekday[7][24]: row 0..6 (Mon..Sun), col 0..23 (hour IST)
    const byHourWeekday = Array.from({ length: 7 }, () => Array(24).fill(0));
    (aggResult?.hourWeekday || []).forEach((hw) => {
      const dayIdx = hw._id.day - 1;
      const hour = hw._id.hour;
      if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
        byHourWeekday[dayIdx][hour] = hw.count;
      }
    });

    // D. monthlyCounts (12 months): index 0=Jan .. 11=Dec
    const monthlyCounts = Array(12).fill(0);
    (aggResult?.monthly || []).forEach((m) => {
      const idx = m._id - 1;
      if (idx >= 0 && idx < 12) {
        monthlyCounts[idx] = m.count;
      }
    });

    // E. Total clicks in the target year
    const total = aggResult?.totalCount?.[0]?.count || 0;

    // F. Active days in year
    const activeDays = Object.values(dailyCounts).filter((c) => c > 0).length;

    // G. Streaks calculation (in IST)
    // Calculate currentStreak and longestStreak
    let currentStreak = 0;
    let longestStreak = 0;

    // Generate date sequence from Jan 1 up to todayIST (or Dec 31 if past year)
    const yearStartObj = new Date(Date.UTC(targetYear, 0, 1));
    const isCurrentYear = targetYear === currentYearIST;
    const maxDateStr = isCurrentYear ? todayIST : `${targetYear}-12-31`;

    let runningStreak = 0;
    let cursor = new Date(yearStartObj);
    while (true) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (dateStr > maxDateStr) break;

      const clicksOnDate = dailyCounts[dateStr] || 0;
      if (clicksOnDate > 0) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Current streak: active today or yesterday?
    if (isCurrentYear) {
      const todayClicks = dailyCounts[todayIST] || 0;
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const yesterdayIST = getISTDateStr(yesterday);
      const yesterdayClicks = dailyCounts[yesterdayIST] || 0;

      if (todayClicks > 0 || yesterdayClicks > 0) {
        let curCursor = todayClicks > 0 ? new Date(now) : yesterday;
        while (true) {
          const dStr = getISTDateStr(curCursor);
          if (dStr < `${targetYear}-01-01`) break;
          if ((dailyCounts[dStr] || 0) > 0) {
            currentStreak++;
            curCursor = new Date(curCursor.getTime() - 24 * 3600 * 1000);
          } else {
            break;
          }
        }
      }
    }

    // H. Busiest Day
    let busiestDay = null;
    let maxDayClicks = 0;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
      if (count > maxDayClicks) {
        maxDayClicks = count;
        const [y, m, d] = dateStr.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        busiestDay = {
          date: dateStr,
          dayName: dayNames[dt.getUTCDay()],
          clicks: count,
        };
      }
    });

    // I. Busiest Month
    let busiestMonth = null;
    let maxMonthClicks = 0;
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    monthlyCounts.forEach((clicks, idx) => {
      if (clicks > maxMonthClicks) {
        maxMonthClicks = clicks;
        busiestMonth = {
          month: idx + 1,
          monthName: monthNames[idx],
          clicks,
        };
      }
    });

    // J. weeklyCounts: last 26 weeks
    // Find current week Monday (IST)
    const nowISTDate = new Date(now.getTime() + 5.5 * 3600 * 1000);
    // JS getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
    const curDayOfWeek = nowISTDate.getUTCDay();
    const daysSinceMonday = (curDayOfWeek + 6) % 7; // Mon->0, Tue->1, ..., Sun->6

    const currentMonday = new Date(nowISTDate);
    currentMonday.setUTCDate(currentMonday.getUTCDate() - daysSinceMonday);
    currentMonday.setUTCHours(0, 0, 0, 0);

    // Compute 26 weeks
    const weeklyCounts = [];
    // Query click counts for the 26-week span
    const startOf26Weeks = new Date(currentMonday);
    startOf26Weeks.setUTCDate(startOf26Weeks.getUTCDate() - 25 * 7);
    const start26WeeksUTC = new Date(startOf26Weeks.getTime() - 5.5 * 3600 * 1000);

    const weekClicksAgg = await Click.aggregate([
      {
        $match: {
          link: { $in: linkIds },
          clickedAt: { $gte: start26WeeksUTC, $lte: now },
        },
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
    ]);

    const dateToClicks26 = {};
    weekClicksAgg.forEach((w) => {
      dateToClicks26[w._id] = w.count;
    });

    for (let i = 25; i >= 0; i--) {
      const wMon = new Date(currentMonday);
      wMon.setUTCDate(wMon.getUTCDate() - i * 7);
      const wSun = new Date(wMon);
      wSun.setUTCDate(wSun.getUTCDate() + 6);

      const monStr = wMon.toISOString().slice(0, 10);
      const sunStr = wSun.toISOString().slice(0, 10);

      // Sum clicks in this week
      let weekClicks = 0;
      let dayCursor = new Date(wMon);
      for (let d = 0; d < 7; d++) {
        const dStr = dayCursor.toISOString().slice(0, 10);
        weekClicks += dateToClicks26[dStr] || 0;
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
      }

      const monthName = monthNames[wMon.getUTCMonth()].slice(0, 3);
      weeklyCounts.push({
        weekIndex: 25 - i,
        weekStart: monStr,
        weekEnd: sunStr,
        label: `${monthName} ${wMon.getUTCDate()}`,
        monthStart: wMon.getUTCDate() <= 7,
        monthName,
        clicks: weekClicks,
      });
    }

    return res.status(200).json({
      success: true,
      year: targetYear,
      dailyCounts,
      byWeekday,
      byHourWeekday,
      currentStreak,
      longestStreak,
      activeDays,
      busiestDay,
      busiestMonth,
      weeklyCounts,
      monthlyCounts,
      total,
    });
  } catch (error) {
    console.error("Error in getActivityAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity analytics",
      error: error.message,
    });
  }
};

// -----------------------------------------------------------------------------
// 2. GET /api/analytics/recent-clicks?limit=20
// -----------------------------------------------------------------------------
export const getRecentClicks = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 100));

    const userLinks = await Link.find({ user: userId })
      .select("_id shortCode originalUrl title clicks")
      .lean();

    const linkMap = {};
    const linkIds = [];
    userLinks.forEach((l) => {
      linkIds.push(l._id);
      linkMap[l._id.toString()] = l;
    });

    if (linkIds.length === 0) {
      return res.status(200).json({
        success: true,
        recentClicks: [],
        total: 0,
      });
    }

    const clicks = await Click.find({ link: { $in: linkIds } })
      .select("link clickedAt deviceType browser operatingSystem country countryCode isQR")
      .sort({ clickedAt: -1 })
      .limit(limit)
      .lean();

    const recentClicks = clicks.map((c) => {
      const link = linkMap[c.link?.toString()] || {};
      return {
        _id: c._id,
        linkId: c.link,
        shortCode: link.shortCode || "unknown",
        linkTitle: link.title || link.shortCode || link.originalUrl || "Untitled",
        originalUrl: link.originalUrl || "",
        country: c.country || "Unknown",
        countryCode: c.countryCode || "UN",
        device: c.deviceType || "desktop",
        browser: c.browser || "Unknown",
        operatingSystem: c.operatingSystem || "Unknown",
        timestamp: c.clickedAt,
        clickedAtIST: formatISTTimestamp(c.clickedAt),
        isQR: Boolean(c.isQR),
      };
    });

    return res.status(200).json({
      success: true,
      recentClicks,
      total: recentClicks.length,
    });
  } catch (error) {
    console.error("Error in getRecentClicks:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent clicks",
      error: error.message,
    });
  }
};

// -----------------------------------------------------------------------------
// 3. GET /api/analytics/top-links?days=7
// -----------------------------------------------------------------------------
export const getTopLinks = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 7, 90));
    const now = new Date();

    const userLinks = await Link.find({ user: userId })
      .select("_id shortCode originalUrl title clicks createdAt")
      .lean();

    const linkIds = userLinks.map((l) => l._id);
    if (linkIds.length === 0) {
      return res.status(200).json({
        success: true,
        days,
        topLinks: [],
      });
    }

    // Time ranges:
    // Current period: [now - days * 24h, now]
    // Previous period: [now - 2 * days * 24h, now - days * 24h]
    const currentStart = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const previousStart = new Date(now.getTime() - 2 * days * 24 * 3600 * 1000);

    // Prepare 7-day sparkline date keys (in IST)
    const dailyKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      dailyKeys.push(getISTDateStr(d));
    }

    // Aggregate clicks for both current and previous periods
    const clicksAgg = await Click.aggregate([
      {
        $match: {
          link: { $in: linkIds },
          clickedAt: { $gte: previousStart, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            link: "$link",
            dateStr: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$clickedAt",
                timezone: "+05:30",
              },
            },
            isCurrent: { $gte: ["$clickedAt", currentStart] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Map counts per link
    // linkId -> { currentClicks: N, previousClicks: N, daily: { dateStr: count } }
    const linkStatsMap = {};
    clicksAgg.forEach((item) => {
      const lId = item._id.link.toString();
      if (!linkStatsMap[lId]) {
        linkStatsMap[lId] = {
          currentClicks: 0,
          previousClicks: 0,
          daily: {},
        };
      }
      if (item._id.isCurrent) {
        linkStatsMap[lId].currentClicks += item.count;
        linkStatsMap[lId].daily[item._id.dateStr] =
          (linkStatsMap[lId].daily[item._id.dateStr] || 0) + item.count;
      } else {
        linkStatsMap[lId].previousClicks += item.count;
      }
    });

    const topLinks = userLinks.map((link) => {
      const lId = link._id.toString();
      const stats = linkStatsMap[lId] || {
        currentClicks: 0,
        previousClicks: 0,
        daily: {},
      };

      const curClicks = stats.currentClicks;
      const prevClicks = stats.previousClicks;

      // % change calculation
      let changePercent = 0;
      if (prevClicks === 0) {
        changePercent = curClicks > 0 ? 100 : 0;
      } else {
        changePercent = Math.round(((curClicks - prevClicks) / prevClicks) * 100);
      }

      // Sparkline daily series
      const dailySeries = dailyKeys.map((k) => stats.daily[k] || 0);

      return {
        _id: link._id,
        shortCode: link.shortCode,
        title: link.title || link.shortCode,
        originalUrl: link.originalUrl,
        clicks: curClicks,
        previousClicks: prevClicks,
        changePercent,
        dailySeries,
        totalClicks: link.clicks || 0,
      };
    });

    // Sort by current period clicks descending, then totalClicks descending
    topLinks.sort((a, b) => b.clicks - a.clicks || b.totalClicks - a.totalClicks);

    return res.status(200).json({
      success: true,
      days,
      topLinks,
    });
  } catch (error) {
    console.error("Error in getTopLinks:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top links analytics",
      error: error.message,
    });
  }
};
