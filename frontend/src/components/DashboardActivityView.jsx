import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  HelpCircle,
  Flame,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import CountUp from "./CountUp";
import AnimatedList from "./AnimatedList";
import FadeContent from "./FadeContent";
import Skeleton from "./ui/Skeleton";
import "./DashboardActivityView.css";

// -----------------------------------------------------------------------------
// Time & Date Helpers (Asia/Kolkata UTC+05:30)
// -----------------------------------------------------------------------------
function getTodayISTStr() {
  const d = new Date();
  const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().slice(0, 10);
}

function formatRelativeTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour12(h) {
  const hour = h % 24;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function formatHourShort(h) {
  const hour = h % 24;
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function DashboardActivityView({
  token: propToken = "",
  apiBaseUrl: propApiBaseUrl = "",
}) {
  const apiBase =
    propApiBaseUrl ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000";

  const token =
    propToken ||
    (typeof window !== "undefined" ? localStorage.getItem("token") || "" : "");

  const todayIST = useMemo(() => getTodayISTStr(), []);
  const currentYear = useMemo(() => parseInt(todayIST.slice(0, 4), 10), [todayIST]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periodTab, setPeriodTab] = useState("weekly"); // "weekly" | "monthly"

  // Analytics states
  const [activityData, setActivityData] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Recent clicks (Live feed)
  const [recentClicks, setRecentClicks] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Top links
  const [topLinks, setTopLinks] = useState([]);
  const [loadingTopLinks, setLoadingTopLinks] = useState(true);

  // Hover states for tooltips
  const [tooltipState, setTooltipState] = useState(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------------
  // 1. Data Fetching
  // ---------------------------------------------------------------------------
  const fetchActivity = useCallback(async (year) => {
    try {
      setLoadingActivity(true);
      const res = await fetch(`${apiBase}/api/analytics/activity?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActivityData(data);
      }
    } catch (err) {
      console.error("Failed to fetch activity analytics:", err);
    } finally {
      setLoadingActivity(false);
    }
  }, [apiBase, token]);

  const fetchRecentClicks = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/analytics/recent-clicks?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentClicks(data.recentClicks || []);
      }
    } catch (err) {
      console.error("Failed to fetch recent clicks:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, [apiBase, token]);

  const fetchTopLinks = useCallback(async () => {
    try {
      setLoadingTopLinks(true);
      const res = await fetch(`${apiBase}/api/analytics/top-links?days=7`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTopLinks(data.topLinks || []);
      }
    } catch (err) {
      console.error("Failed to fetch top links:", err);
    } finally {
      setLoadingTopLinks(false);
    }
  }, [apiBase, token]);

  // Initial load
  useEffect(() => {
    fetchActivity(selectedYear);
    fetchTopLinks();
    fetchRecentClicks();
  }, [fetchActivity, fetchTopLinks, fetchRecentClicks, selectedYear]);

  // Live polling for recent clicks every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecentClicks();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchRecentClicks]);

  // ---------------------------------------------------------------------------
  // 2. Computed Insights (Row 1) & Day of Week Subtitle
  // ---------------------------------------------------------------------------
  const insights = useMemo(() => {
    if (!activityData) return { peakDayText: "", peakHourText: "", streakText: "", dowSentence: "" };

    const total = activityData.total || 0;
    const byWeekday = activityData.byWeekday || [0, 0, 0, 0, 0, 0, 0];
    const byHourWeekday = activityData.byHourWeekday || [];

    // Col 1: Best Day
    let peakDayText = "";
    let dowSentence = "";
    if (total > 0) {
      let maxDayIdx = 0;
      let maxDayClicks = 0;
      byWeekday.forEach((c, idx) => {
        if (c > maxDayClicks) {
          maxDayClicks = c;
          maxDayIdx = idx;
        }
      });
      if (maxDayClicks > 0) {
        const pct = ((maxDayClicks / total) * 100).toFixed(1);
        peakDayText = `${FULL_WEEKDAY_NAMES[maxDayIdx]} is your best day (${pct}% of clicks).`;
        dowSentence = `Most clicks on ${FULL_WEEKDAY_NAMES[maxDayIdx]} (${pct}%).`;
      }
    }

    // Col 2: Peak Hour (IST)
    let peakHourText = "";
    if (total > 0 && byHourWeekday.length > 0) {
      const hourlySums = Array(24).fill(0);
      byHourWeekday.forEach((row) => {
        row.forEach((val, h) => {
          hourlySums[h] += val;
        });
      });
      let maxHour = 0;
      let maxHourClicks = 0;
      hourlySums.forEach((c, h) => {
        if (c > maxHourClicks) {
          maxHourClicks = c;
          maxHour = h;
        }
      });
      if (maxHourClicks > 0) {
        const hStart = formatHour12(maxHour);
        const hEnd = formatHour12((maxHour + 1) % 24);
        peakHourText = `Clicks peak between ${hStart} and ${hEnd} IST.`;
      }
    }

    // Col 3: Streak / Engagement
    let streakText = "";
    const curStreak = activityData.currentStreak || 0;
    const longestStreak = activityData.longestStreak || 0;
    const activeDays = activityData.activeDays || 0;

    if (curStreak > 0) {
      streakText = `Current streak: ${curStreak} active day${curStreak > 1 ? "s" : ""}.`;
    } else if (longestStreak > 0) {
      streakText = `Longest streak: ${longestStreak} active day${longestStreak > 1 ? "s" : ""}.`;
    } else if (activeDays > 0) {
      streakText = `${activeDays} active day${activeDays > 1 ? "s" : ""} recorded this year.`;
    }

    return { peakDayText, peakHourText, streakText, dowSentence };
  }, [activityData]);

  // ---------------------------------------------------------------------------
  // 3. Contribution Calendar 53-week Grid Model
  // ---------------------------------------------------------------------------
  const calendarModel = useMemo(() => {
    const dailyCounts = activityData?.dailyCounts || {};

    let maxDayClicks = 1;
    Object.values(dailyCounts).forEach((c) => {
      if (c > maxDayClicks) maxDayClicks = c;
    });

    const jan1 = new Date(Date.UTC(selectedYear, 0, 1));
    const jan1Day = (jan1.getUTCDay() + 6) % 7; // 0=Mon ... 6=Sun
    const startMonday = new Date(jan1);
    startMonday.setUTCDate(startMonday.getUTCDate() - jan1Day);

    const dec31 = new Date(Date.UTC(selectedYear, 11, 31));
    const dec31Day = (dec31.getUTCDay() + 6) % 7; // 0=Mon ... 6=Sun
    const endSunday = new Date(dec31);
    endSunday.setUTCDate(endSunday.getUTCDate() + (6 - dec31Day));

    const totalDays = Math.round((endSunday.getTime() - startMonday.getTime()) / (24 * 3600 * 1000)) + 1;
    const totalWeeks = Math.round(totalDays / 7);

    const weeks = [];
    for (let w = 0; w < totalWeeks; w++) {
      const days = [];
      const weekMon = new Date(startMonday);
      weekMon.setUTCDate(weekMon.getUTCDate() + w * 7);

      for (let d = 0; d < 7; d++) {
        const curDate = new Date(weekMon);
        curDate.setUTCDate(curDate.getUTCDate() + d);
        const iso = curDate.toISOString().slice(0, 10);
        const inYear = curDate.getUTCFullYear() === selectedYear;
        const isFuture = iso > todayIST;

        const clicks = inYear && !isFuture ? dailyCounts[iso] || 0 : 0;

        let level = 0;
        if (clicks > 0) {
          if (clicks === 1) level = 1;
          else if (clicks <= Math.ceil(maxDayClicks * 0.35)) level = 2;
          else if (clicks <= Math.ceil(maxDayClicks * 0.7)) level = 3;
          else level = 4;
        }

        days.push({
          dateStr: iso,
          inYear,
          isFuture,
          clicks,
          level,
          dayIndex: d,
        });
      }

      weeks.push({ weekIndex: w, days });
    }

    // Month headers: place each month label at its starting column (1st of month)
    const monthHeaders = [];
    let prevCol = -99;
    for (let m = 0; m < 12; m++) {
      const firstOfMonth = new Date(Date.UTC(selectedYear, m, 1));
      const diffDays = Math.round((firstOfMonth.getTime() - startMonday.getTime()) / (24 * 3600 * 1000));
      const weekIdx = Math.floor(diffDays / 7);
      if (weekIdx - prevCol >= 2) {
        monthHeaders.push({
          weekIndex: weekIdx,
          label: MONTH_NAMES[m],
        });
        prevCol = weekIdx;
      }
    }

    return { weeks, monthHeaders, maxDayClicks };
  }, [activityData, selectedYear, todayIST]);

  const showTooltip = (e, text) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipState({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      visible: true,
    });
  };

  const hideTooltip = () => {
    setTooltipState((prev) => (prev ? { ...prev, visible: false } : null));
  };

  // ---------------------------------------------------------------------------
  // 4. Render
  // ---------------------------------------------------------------------------
  return (
    <div className="activity-view-container" role="region" aria-label="Activity Analytics">
      {/* =====================================================================
          ROW 1: INSIGHTS STRIP (Full Width, 3 Columns)
          ===================================================================== */}
      <FadeContent distance={8}>
        <div className="insights-strip-card" role="region" aria-label="Key Insights">
          {loadingActivity ? (
            <div className="insights-strip-loading">
              <Skeleton height="20px" width="30%" />
              <div className="insights-divider" />
              <Skeleton height="20px" width="30%" />
              <div className="insights-divider" />
              <Skeleton height="20px" width="30%" />
            </div>
          ) : (
            <div className="insights-strip-content">
              {/* Column 1: Best Day */}
              {insights.peakDayText ? (
                <div className="insight-item">
                  <div className="insight-icon-wrap">
                    <Calendar size={15} className="insight-icon" />
                  </div>
                  <span className="insight-text">{insights.peakDayText}</span>
                </div>
              ) : (
                <div className="insight-item insight-empty">
                  <span className="insight-text">Share links to analyze best days.</span>
                </div>
              )}

              <div className="insights-divider" aria-hidden="true" />

              {/* Column 2: Peak Hours */}
              {insights.peakHourText ? (
                <div className="insight-item">
                  <div className="insight-icon-wrap">
                    <Clock size={15} className="insight-icon" />
                  </div>
                  <span className="insight-text">{insights.peakHourText}</span>
                </div>
              ) : (
                <div className="insight-item insight-empty">
                  <span className="insight-text">Hourly peak will appear after clicks.</span>
                </div>
              )}

              <div className="insights-divider" aria-hidden="true" />

              {/* Column 3: Streaks */}
              {insights.streakText ? (
                <div className="insight-item">
                  <div className="insight-icon-wrap">
                    <Flame size={15} className="insight-icon" />
                  </div>
                  <span className="insight-text">{insights.streakText}</span>
                </div>
              ) : (
                <div className="insight-item insight-empty">
                  <span className="insight-text">Activity streak starts on your first click.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </FadeContent>

      {/* =====================================================================
          ROW 2: CONTRIBUTION CALENDAR (53 Weeks, Full Width)
          ===================================================================== */}
      <FadeContent distance={8} delay={0.06}>
        <div
          className="activity-card calendar-card"
          role="region"
          aria-label="53-Week Activity Heatmap"
        >
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Contribution calendar</h3>
              <p className="card-subtitle">
                Daily click frequency across 53 weeks (Asia/Kolkata).
              </p>
            </div>
            <div className="calendar-controls">
              <label htmlFor="calendar-year-select" className="sr-only">
                Select Year
              </label>
              <select
                id="calendar-year-select"
                className="calendar-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              >
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear - 1}>{currentYear - 1}</option>
              </select>
            </div>
          </div>

          <div className="calendar-body-layout">
            {/* Left: 53-Week Grid */}
            <div className="calendar-grid-wrap">
              <div className="calendar-scroll-area">
                {/* Month labels on top */}
                <div className="calendar-month-row" aria-hidden="true">
                  <div className="calendar-weekday-spacer" />
                  <div className="calendar-month-track">
                    {calendarModel.monthHeaders.map((m) => (
                      <span
                        key={m.weekIndex}
                        className="calendar-month-label"
                        style={{ left: `${m.weekIndex * 16}px` }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Grid + Weekday Labels */}
                <div className="calendar-grid-columns" role="grid" aria-label="Activity calendar">
                  <div className="calendar-weekday-labels" aria-hidden="true">
                    <span>Mon</span>
                    <span className="spacer-day" />
                    <span>Wed</span>
                    <span className="spacer-day" />
                    <span>Fri</span>
                    <span className="spacer-day" />
                    <span className="spacer-day" />
                  </div>

                  <div className="calendar-weeks-container">
                    {calendarModel.weeks.map((week) => (
                      <div key={week.weekIndex} className="calendar-week-col" role="row">
                        {week.days.map((day) => {
                          if (!day.inYear) {
                            return (
                              <div
                                key={day.dateStr}
                                className="act-cal-cell cell-empty"
                                aria-hidden="true"
                              />
                            );
                          }

                          if (day.isFuture) {
                            return (
                              <div
                                key={day.dateStr}
                                className="act-cal-cell cell-future"
                                aria-hidden="true"
                              />
                            );
                          }

                          const labelText =
                            day.clicks === 0
                              ? `No clicks on ${day.dateStr}`
                              : `${day.clicks} click${day.clicks > 1 ? "s" : ""} on ${day.dateStr}`;

                          return (
                            <motion.button
                              key={day.dateStr}
                              type="button"
                              className={`act-cal-cell act-cell-lvl-${day.level}`}
                              role="gridcell"
                              tabIndex={0}
                              aria-label={labelText}
                              initial={
                                prefersReducedMotion
                                  ? false
                                  : { opacity: 0, scale: 0.85 }
                              }
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                duration: 0.2,
                                delay: prefersReducedMotion
                                  ? 0
                                  : Math.min(
                                      0.6,
                                      (week.weekIndex + day.dayIndex) * 0.006
                                    ),
                              }}
                              onMouseEnter={(e) => showTooltip(e, labelText)}
                              onMouseLeave={hideTooltip}
                              onFocus={(e) => showTooltip(e, labelText)}
                              onBlur={hideTooltip}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend below grid */}
                <div className="calendar-legend-row" aria-hidden="true">
                  <span className="legend-label">Less</span>
                  <div className="act-legend-swatch act-cell-lvl-0" />
                  <div className="act-legend-swatch act-cell-lvl-1" />
                  <div className="act-legend-swatch act-cell-lvl-2" />
                  <div className="act-legend-swatch act-cell-lvl-3" />
                  <div className="act-legend-swatch act-cell-lvl-4" />
                  <span className="legend-label">More</span>
                </div>
              </div>
            </div>

            {/* Right: Stats Column */}
            <div className="calendar-stats-col">
              <div className="calendar-stat-box">
                <span className="stat-label">Current streak</span>
                <span className="stat-number">
                  <CountUp to={activityData?.currentStreak || 0} duration={0.9} />
                </span>
                <span className="stat-unit">consecutive days</span>
              </div>

              <div className="calendar-stat-box">
                <span className="stat-label">Longest streak</span>
                <span className="stat-number">
                  <CountUp to={activityData?.longestStreak || 0} duration={0.9} />
                </span>
                <span className="stat-unit">consecutive days</span>
              </div>

              <div className="calendar-stat-box">
                <span className="stat-label">Active days</span>
                <span className="stat-number">
                  <CountUp to={activityData?.activeDays || 0} duration={0.9} />
                </span>
                <span className="stat-unit">days with traffic</span>
              </div>
            </div>
          </div>
        </div>
      </FadeContent>

      {/* =====================================================================
          ROW 3: 12-COL GRID: DAY OF WEEK (5 COLS) & BEST TIME TO SHARE (7 COLS)
          ===================================================================== */}
      <FadeContent distance={8} delay={0.12}>
        <div className="activity-grid-12">
          {/* Card 1: Day of Week (5 cols) */}
          <div
            className="activity-card col-span-5"
            role="region"
            aria-label="Day of week chart"
          >
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Day of week</h3>
                <p className="card-subtitle">
                  {insights.dowSentence || "Traffic distribution by weekday."}
                </p>
              </div>
            </div>

            {loadingActivity ? (
              <div className="chart-loading-box">
                <Skeleton height="150px" width="100%" />
              </div>
            ) : (
              <div className="dow-chart-container">
                <div className="chart-gridlines" aria-hidden="true">
                  <div className="gridline" />
                  <div className="gridline" />
                  <div className="gridline" />
                </div>

                <div className="dow-bars-row">
                  {WEEKDAY_NAMES.map((dayName, idx) => {
                    const clicks = activityData?.byWeekday?.[idx] || 0;
                    const maxClicks = Math.max(
                      1,
                      ...(activityData?.byWeekday || [1])
                    );
                    const pctHeight = Math.max(4, Math.round((clicks / maxClicks) * 100));
                    const isPeak =
                      clicks > 0 &&
                      clicks === Math.max(...(activityData?.byWeekday || [0]));

                    const tooltipText = `${FULL_WEEKDAY_NAMES[idx]}: ${clicks} click${
                      clicks === 1 ? "" : "s"
                    }`;

                    return (
                      <div key={dayName} className="dow-bar-col">
                        <div className="dow-bar-track">
                          <motion.button
                            type="button"
                            className={`dow-bar ${isPeak ? "bar-accent" : "bar-neutral"}`}
                            aria-label={tooltipText}
                            style={{ height: `${pctHeight}%` }}
                            initial={
                              prefersReducedMotion
                                ? false
                                : { scaleY: 0, originY: 1 }
                            }
                            animate={{ scaleY: 1 }}
                            transition={{
                              duration: 0.35,
                              delay: prefersReducedMotion ? 0 : idx * 0.03,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            onMouseEnter={(e) => showTooltip(e, tooltipText)}
                            onMouseLeave={hideTooltip}
                            onFocus={(e) => showTooltip(e, tooltipText)}
                            onBlur={hideTooltip}
                          />
                        </div>
                        <span className={`dow-label ${isPeak ? "label-peak" : ""}`}>
                          {dayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="chart-baseline" />
              </div>
            )}
          </div>

          {/* Card 2: Best Time to Share Heatmap (7 cols) */}
          <div
            className="activity-card col-span-7"
            role="region"
            aria-label="Best time to share heatmap"
          >
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Best time to share</h3>
                <p className="card-subtitle">
                  7x24 engagement heatmap in Indian Standard Time (IST).
                </p>
              </div>
            </div>

            {loadingActivity ? (
              <div className="chart-loading-box">
                <Skeleton height="150px" width="100%" />
              </div>
            ) : (
              <div className="heatmap-wrap">
                <div className="heatmap-hour-headers" aria-hidden="true">
                  <div className="heatmap-day-label-spacer" />
                  <div className="heatmap-hours-track">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                      <span
                        key={h}
                        className="hour-tick"
                        style={{ left: `${(h / 24) * 100}%` }}
                      >
                        {formatHourShort(h)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="heatmap-grid" role="grid" aria-label="Hourly traffic by weekday">
                  {WEEKDAY_NAMES.map((dayName, dayIdx) => {
                    const rowCounts = activityData?.byHourWeekday?.[dayIdx] || [];
                    const maxInHeatmap = Math.max(
                      1,
                      ...(activityData?.byHourWeekday?.flat() || [1])
                    );

                    return (
                      <div key={dayName} className="heatmap-row" role="row">
                        <span className="heatmap-row-label" aria-hidden="true">
                          {dayName}
                        </span>
                        <div className="heatmap-cells-track">
                          {Array.from({ length: 24 }).map((_, h) => {
                            const clicks = rowCounts[h] || 0;
                            let level = 0;
                            if (clicks > 0) {
                              if (clicks === 1) level = 1;
                              else if (clicks <= Math.ceil(maxInHeatmap * 0.4)) level = 2;
                              else if (clicks <= Math.ceil(maxInHeatmap * 0.75)) level = 3;
                              else level = 4;
                            }

                            const cellText = `${dayName} ${formatHour12(h)}: ${clicks} click${
                              clicks === 1 ? "" : "s"
                            }`;

                            return (
                              <motion.button
                                key={h}
                                type="button"
                                className={`act-heatmap-cell act-cell-lvl-${level}`}
                                role="gridcell"
                                tabIndex={0}
                                aria-label={cellText}
                                initial={
                                  prefersReducedMotion ? false : { opacity: 0 }
                                }
                                animate={{ opacity: 1 }}
                                transition={{
                                  duration: 0.2,
                                  delay: prefersReducedMotion
                                    ? 0
                                    : Math.min(0.6, (dayIdx + h) * 0.008),
                                }}
                                onMouseEnter={(e) => showTooltip(e, cellText)}
                                onMouseLeave={hideTooltip}
                                onFocus={(e) => showTooltip(e, cellText)}
                                onBlur={hideTooltip}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="heatmap-legend" aria-hidden="true">
                  <span className="legend-label">Less</span>
                  <div className="act-legend-swatch act-cell-lvl-0" />
                  <div className="act-legend-swatch act-cell-lvl-1" />
                  <div className="act-legend-swatch act-cell-lvl-2" />
                  <div className="act-legend-swatch act-cell-lvl-3" />
                  <div className="act-legend-swatch act-cell-lvl-4" />
                  <span className="legend-label">More</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </FadeContent>

      {/* =====================================================================
          ROW 4: ONE CARD: CLICKS BY PERIOD (Weekly | Monthly Segmented)
          ===================================================================== */}
      <FadeContent distance={8} delay={0.18}>
        <div
          className="activity-card period-card"
          role="region"
          aria-label="Clicks by period"
        >
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Clicks by period</h3>
              <p className="card-subtitle">
                {periodTab === "weekly"
                  ? "Volume across the last 26 weeks."
                  : `Monthly traffic breakdown for ${selectedYear}.`}
              </p>
            </div>

            <div className="period-segmented-wrap" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={periodTab === "weekly"}
                className={`period-seg-btn ${periodTab === "weekly" ? "active" : ""}`}
                onClick={() => setPeriodTab("weekly")}
              >
                {periodTab === "weekly" && (
                  <motion.div
                    layoutId="periodActivePill"
                    className="period-active-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="seg-label">Weekly</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={periodTab === "monthly"}
                className={`period-seg-btn ${periodTab === "monthly" ? "active" : ""}`}
                onClick={() => setPeriodTab("monthly")}
              >
                {periodTab === "monthly" && (
                  <motion.div
                    layoutId="periodActivePill"
                    className="period-active-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="seg-label">Monthly</span>
              </button>
            </div>
          </div>

          {loadingActivity ? (
            <div className="chart-loading-box">
              <Skeleton height="160px" width="100%" />
            </div>
          ) : (
            <div className="period-chart-area">
              <div className="chart-gridlines" aria-hidden="true">
                <div className="gridline" />
                <div className="gridline" />
                <div className="gridline" />
              </div>

              {/* Weekly View (Last 26 Weeks) */}
              {periodTab === "weekly" && (
                <div className="weekly-bars-container">
                  {(activityData?.weeklyCounts || []).map((week, idx) => {
                    const clicks = week.clicks || 0;
                    const maxClicks = Math.max(
                      1,
                      ...(activityData?.weeklyCounts?.map((w) => w.clicks) || [1])
                    );
                    const pctHeight = clicks > 0 ? Math.max(6, Math.round((clicks / maxClicks) * 100)) : 0;
                    const tooltipText = `${week.weekStart} to ${week.weekEnd}: ${clicks} click${
                      clicks === 1 ? "" : "s"
                    }`;

                    return (
                      <div key={week.weekIndex} className="weekly-bar-slot">
                        <div className="weekly-bar-track">
                          {clicks > 0 ? (
                            <motion.button
                              type="button"
                              className="weekly-bar-fill"
                              style={{ height: `${pctHeight}%` }}
                              aria-label={tooltipText}
                              initial={
                                prefersReducedMotion
                                  ? false
                                  : { scaleY: 0, originY: 1 }
                              }
                              animate={{ scaleY: 1 }}
                              transition={{
                                duration: 0.35,
                                delay: prefersReducedMotion ? 0 : idx * 0.015,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              onMouseEnter={(e) => showTooltip(e, tooltipText)}
                              onMouseLeave={hideTooltip}
                              onFocus={(e) => showTooltip(e, tooltipText)}
                              onBlur={hideTooltip}
                            />
                          ) : (
                            <div
                              className="weekly-zero-tick"
                              aria-label={tooltipText}
                              onMouseEnter={(e) => showTooltip(e, tooltipText)}
                              onMouseLeave={hideTooltip}
                            />
                          )}
                        </div>
                        <span className="weekly-axis-label">
                          {week.monthStart ? week.monthName : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Monthly View (12 Bars) */}
              {periodTab === "monthly" && (
                <div className="monthly-bars-container">
                  {MONTH_NAMES.map((mName, idx) => {
                    const clicks = activityData?.monthlyCounts?.[idx] || 0;
                    const maxClicks = Math.max(
                      1,
                      ...(activityData?.monthlyCounts || [1])
                    );
                    const pctHeight = clicks > 0 ? Math.max(6, Math.round((clicks / maxClicks) * 100)) : 0;
                    const isCurrentMonth =
                      selectedYear === currentYear &&
                      idx === new Date().getUTCMonth();
                    const tooltipText = `${mName} ${selectedYear}: ${clicks} click${
                      clicks === 1 ? "" : "s"
                    }`;

                    return (
                      <div key={mName} className="monthly-bar-slot">
                        <div className="monthly-bar-track">
                          {clicks > 0 ? (
                            <motion.button
                              type="button"
                              className={`monthly-bar-fill ${
                                isCurrentMonth ? "bar-accent" : "bar-neutral"
                              }`}
                              style={{ height: `${pctHeight}%` }}
                              aria-label={tooltipText}
                              initial={
                                prefersReducedMotion
                                  ? false
                                  : { scaleY: 0, originY: 1 }
                              }
                              animate={{ scaleY: 1 }}
                              transition={{
                                duration: 0.35,
                                delay: prefersReducedMotion ? 0 : idx * 0.03,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              onMouseEnter={(e) => showTooltip(e, tooltipText)}
                              onMouseLeave={hideTooltip}
                              onFocus={(e) => showTooltip(e, tooltipText)}
                              onBlur={hideTooltip}
                            />
                          ) : (
                            <div
                              className="monthly-zero-tick"
                              aria-label={tooltipText}
                              onMouseEnter={(e) => showTooltip(e, tooltipText)}
                              onMouseLeave={hideTooltip}
                            />
                          )}
                        </div>
                        <span
                          className={`monthly-axis-label ${
                            isCurrentMonth ? "label-current" : ""
                          }`}
                        >
                          {mName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="chart-baseline" />
            </div>
          )}
        </div>
      </FadeContent>

      {/* =====================================================================
          ROW 5: 12-COL GRID: LIVE ACTIVITY (5 COLS) & TOP LINKS (7 COLS)
          ===================================================================== */}
      <FadeContent distance={8} delay={0.24}>
        <div className="activity-grid-12">
          {/* Card 1: Live Activity (5 cols) */}
          <div
            className="activity-card col-span-5 live-feed-card"
            role="region"
            aria-label="Live click activity feed"
          >
            <div className="card-header-row">
              <div className="live-header-title">
                <div className="live-badge">
                  <span className="live-pulse-dot" aria-hidden="true" />
                  <span className="live-text">Live</span>
                </div>
                <h3 className="card-title">Live activity</h3>
              </div>
              <span className="live-polling-caption">Polls 15s</span>
            </div>
            <p className="card-subtitle">
              Most recent click events across your active short links.
            </p>

            {loadingRecent ? (
              <div className="feed-loading-stack">
                <Skeleton height="36px" width="100%" />
                <Skeleton height="36px" width="100%" />
                <Skeleton height="36px" width="100%" />
              </div>
            ) : recentClicks.length === 0 ? (
              <div className="feed-empty-state">
                <p>No recent clicks recorded yet.</p>
              </div>
            ) : (
              <div className="live-feed-list-wrap">
                <AnimatedList distance={12} duration={0.25}>
                  {recentClicks.map((click) => {
                    const isMobile =
                      click.device === "mobile" ||
                      click.operatingSystem === "Android" ||
                      click.operatingSystem === "iOS";
                    const isTablet = click.device === "tablet";

                    return (
                      <div key={click._id} className="live-click-row">
                        <div className="click-left">
                          <span
                            className="country-flag-badge"
                            title={click.country || "Unknown Country"}
                          >
                            {click.countryCode || "UN"}
                          </span>
                          <div className="device-icon-wrap" title={click.device || "desktop"}>
                            {isMobile ? (
                              <Smartphone size={13} />
                            ) : isTablet ? (
                              <Tablet size={13} />
                            ) : (
                              <Monitor size={13} />
                            )}
                          </div>
                          <span className="click-shortcode">{click.shortCode}</span>
                        </div>
                        <div className="click-right">
                          <span className="click-browser">{click.browser}</span>
                          <span className="click-time">
                            {formatRelativeTime(click.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </AnimatedList>
              </div>
            )}
          </div>

          {/* Card 2: Top Links (7 cols) */}
          <div
            className="activity-card col-span-7"
            role="region"
            aria-label="Top links performance table"
          >
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Top links</h3>
                <p className="card-subtitle">
                  Performance and 7-day velocity vs previous period.
                </p>
              </div>
            </div>

            {loadingTopLinks ? (
              <div className="toplinks-loading">
                <Skeleton height="40px" width="100%" />
                <Skeleton height="40px" width="100%" />
                <Skeleton height="40px" width="100%" />
              </div>
            ) : topLinks.length === 0 ? (
              <div className="feed-empty-state">
                <p>No link traffic in the last 7 days.</p>
              </div>
            ) : (
              <div className="toplinks-table-wrap">
                <table className="toplinks-table">
                  <thead>
                    <tr>
                      <th scope="col" className="th-link">
                        Link
                      </th>
                      <th scope="col" className="th-clicks text-right">
                        Clicks (7d)
                      </th>
                      <th scope="col" className="th-change text-right">
                        Change
                      </th>
                      <th scope="col" className="th-sparkline text-right">
                        7-day trend
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinks.map((item) => {
                      const isUp = item.changePercent > 0;
                      const isDown = item.changePercent < 0;

                      const maxPt = Math.max(1, ...(item.dailySeries || [1]));
                      const svgWidth = 84;
                      const svgHeight = 22;
                      const pts = (item.dailySeries || [0, 0, 0, 0, 0, 0, 0]).map(
                        (val, ptIdx) => {
                          const x = (ptIdx / 6) * svgWidth;
                          const y = svgHeight - (val / maxPt) * (svgHeight - 4) - 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }
                      );
                      const polylinePoints = pts.join(" ");

                      return (
                        <tr key={item._id} className="toplink-row">
                          <td className="td-link">
                            <span className="toplink-code">/{item.shortCode}</span>
                            <span className="toplink-url" title={item.originalUrl}>
                              {item.originalUrl}
                            </span>
                          </td>
                          <td className="td-clicks text-right">
                            <span className="clicks-val">{item.clicks}</span>
                          </td>
                          <td className="td-change text-right">
                            <span
                              className={`change-badge ${
                                isUp ? "change-up" : isDown ? "change-down" : "change-neutral"
                              }`}
                            >
                              {isUp && <TrendingUp size={12} className="change-icon" />}
                              {isDown && <TrendingDown size={12} className="change-icon" />}
                              {isUp ? `+${item.changePercent}%` : `${item.changePercent}%`}
                            </span>
                          </td>
                          <td className="td-sparkline text-right">
                            <svg
                              className="sparkline-svg"
                              width={svgWidth}
                              height={svgHeight}
                              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                              aria-hidden="true"
                            >
                              <polyline
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={polylinePoints}
                              />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </FadeContent>

      {/* Floating Tooltip */}
      {tooltipState && tooltipState.visible && (
        <div
          role="tooltip"
          className="activity-floating-tooltip"
          style={{
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
          }}
        >
          {tooltipState.text}
        </div>
      )}
    </div>
  );
}
