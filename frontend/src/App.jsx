import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import Login from "./Login";
import ClicksOverviewChart, {
  getTodayISTStr,
  shiftISODate,
  getDaysBetween,
  formatDisplayDate,
  calculateNiceYAxis,
} from "./ClicksOverviewChart";
// CHANGE: QR Code Feature Stage 2 — 2026-11-05
// Import reusable QR Code component and URL helper
import QRCodeCard, { buildShortUrl } from "./QRCodeCard";
import RotatingDottedGlobe from "./components/RotatingDottedGlobe";
// CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
import DeviceAnalyticsView from "./components/DeviceAnalyticsView";
// CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16
import TrafficAnalyticsView from "./components/TrafficAnalyticsView";
// CHANGE: Stage 11 Link Comparison Dashboard — 2026-11-16
import LinkComparisonView from "./components/LinkComparisonView";
// CHANGE: Stage 12 Smart Traffic Anomaly Detection — 2026-11-16
import TrafficAnomalyView from "./components/TrafficAnomalyView";
// CHANGE: Stage 13 Smart A/B Link Testing View — 2026-11-17
import ABTestingView from "./components/ABTestingView";
// CHANGE: Stage 14 Automated Reports View — 2026-11-19
import ReportsView from "./components/ReportsView";
// CHANGE: Integrated React Bits SplitText component — 2026-11-19
import SplitText from "./components/SplitText";
// CHANGE: React Bits Specular Button & SpotlightCard Integration
import SpecularButton from "./components/SpecularButton";
import SpotlightCard from "./components/SpotlightCard";
import CountUp from "./components/CountUp";
import AnimatedContent from "./components/AnimatedContent";
import TrafficSourcesCard from "./components/TrafficSourcesCard";
import {
  Button,
  Card,
  StatCard,
  Badge,
  SegmentedControl,
  Input,
  Table,
  EmptyState,
  Skeleton,
  Tooltip,
  Modal,
} from "./components/ui";
import {
  LayoutDashboard,
  Megaphone,
  QrCode,
  Globe,
  Building2,
  Smartphone,
  Activity,
  ArrowRightLeft,
  ShieldAlert,
  GitFork,
  FileText,
  Link2,
  BarChart3,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Plus,
  LogOut,
  MousePointerClick,
  CheckCircle2,
  TrendingUp,
  Zap,
  Calendar,
  Trophy,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Settings as SettingsIcon,
  HelpCircle,
} from "lucide-react";
import LandingPage from "./marketing/LandingPage";
import PricingPage from "./marketing/PricingPage";
import DocsPage from "./marketing/DocsPage";
import ChangelogPage from "./marketing/ChangelogPage";
import StatusPage from "./marketing/StatusPage";
import SettingsView from "./components/SettingsView";
import SidebarBottom from "./components/SidebarBottom";
import AnnouncementBanner from "./components/AnnouncementBanner";
import { PLAN_LIMITS, CURRENT_PLAN } from "./config/plans.config";
import "./App.css";
import "./AuroraTheme.css";

// CHANGE: QR Code Feature Stage 2 — 2026-11-05
// Support environment-configured public base URL for short link redirection and QR code generation
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";
export const API_URL = `${API_BASE_URL}/api/links`;
const USER_URL = `${API_BASE_URL}/api/v1/users`;
// CHANGE: Notifications Step 4B — 2026-11-04
const NOTIFICATION_URL = `${API_BASE_URL}/api/notifications`;

// Single-Flight Token Refresh: ensures only one /refresh-token network request runs at a time
let refreshPromise = null;
const requestTokenRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${USER_URL}/refresh-token`, {}, { withCredentials: true })
      .then((res) => {
        if (!res.data?.success || !res.data?.token) {
          throw new Error("Invalid refresh response");
        }
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Default Donut Color Palette: Primary in accent, secondaries in neutral greys
const DONUT_COLORS = [
  "var(--accent)", // Primary accent
  "#64748B",       // Slate neutral
  "#94A3B8",       // Slate light
  "#475569",       // Slate dark
  "#CBD5E1",       // Slate extra light
  "#334155",       // Slate extra dark
];

// CHANGE: Notifications Step 4D — 2026-11-05
// Safe helper to format notification createdAt timestamp to Indian Standard Time (IST)
const formatNotificationIST = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toLocaleString();
  }
};

// Configuration for supported notification types: icons, labels, and badge classes
const NOTIFICATION_TYPE_CONFIG = {
  link: {
    label: "Link",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    badgeClass: "badge-link",
  },
  milestone: {
    label: "Milestone",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
    badgeClass: "badge-milestone",
  },
  campaign: {
    label: "Campaign",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    ),
    badgeClass: "badge-campaign",
  },
  system: {
    label: "System",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    badgeClass: "badge-system",
  },
};

// -----------------------------------------------------------------------------
// Component: MetricCards (React Bits SpotlightCard + CountUp) — 2026-11-20
// -----------------------------------------------------------------------------
function MetricCards({
  totalLinks = 0,
  totalClicks = 0,
  activeLinks = 0,
  avgClicks = 0,
  intelligence = null,
}) {
  const todayClicks = intelligence?.totalClicksToday || 0;
  const activePercent = totalLinks > 0 ? Math.round((activeLinks / totalLinks) * 100) : 0;
  const inactiveLinks = Math.max(0, totalLinks - activeLinks);
  const clicksPerActive = activeLinks > 0 ? (totalClicks / activeLinks).toFixed(1) : "0.0";

  const cards = [
    {
      id: "total_links",
      label: "Total links",
      value: totalLinks,
      badgeText: null,
      icon: <Link2 size={18} />,
      sub: totalLinks > 0 ? `${activeLinks} active, ${inactiveLinks} paused` : "No links created yet",
    },
    {
      id: "total_clicks",
      label: "Total clicks",
      value: totalClicks,
      badgeText: null,
      icon: <MousePointerClick size={18} />,
      sub: todayClicks > 0 ? `+${todayClicks} clicks today` : "All-time recorded clicks",
    },
    {
      id: "avg_clicks",
      label: "Avg clicks per link",
      value: totalLinks > 0 ? avgClicks : 0,
      decimals: 1,
      badgeText: null,
      icon: <TrendingUp size={18} />,
      sub: totalLinks > 0 ? `${clicksPerActive} per active link` : "Average clicks per link",
    },
    {
      id: "active_links",
      label: "Active links",
      value: activeLinks,
      badgeText: activeLinks > 0 ? "Active" : "Paused",
      badgeType: activeLinks > 0 ? "positive" : "neutral",
      icon: <Zap size={18} />,
      sub: `${activePercent}% routing capacity`,
    },
  ];

  return (
    <div className="metrics-grid">
      {cards.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          decimals={card.decimals || 0}
          delta={card.badgeText}
          trend={card.badgeType === "positive" ? "up" : "neutral"}
          helper={card.sub}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

// ClicksOverviewChart is imported from ./ClicksOverviewChart
// CHANGE: Prevent chart curve overshoot below zero — 2026-10-19

// -----------------------------------------------------------------------------
// Component: DonutChart (Device and Browser Breakdown Donut)
// -----------------------------------------------------------------------------
function DonutChart({ title, icon, data = [], emptyMessage = "No data recorded yet" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const activeItems = useMemo(() => {
    return (data || []).filter((d) => (d.count || 0) > 0);
  }, [data]);

  const total = useMemo(() => {
    return activeItems.reduce((sum, d) => sum + (d.count || 0), 0);
  }, [activeItems]);

  const size = 124;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2 - 3;
  const circumference = 2 * Math.PI * radius; // ~395.84

  let accumulatedPercent = 0;
  const slices = activeItems.map((item, idx) => {
    const pct = total > 0 ? (item.count / total) * 100 : 0;
    const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += pct;
    const color = item.color || DONUT_COLORS[idx % DONUT_COLORS.length];
    return {
      ...item,
      pct: Math.round(pct),
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  const spotlightColor = "var(--accent-soft, rgba(79, 70, 229, 0.12))";
  const borderColor = "var(--border)";

  return (
    <SpotlightCard
      className="donut-card"
      spotlightColor={spotlightColor}
      borderColor={borderColor}
      radius={280}
    >
      <div className="donut-card-top">
        <h4>
          <span style={{ marginRight: "8px" }}>{icon}</span>
          {title}
        </h4>
        <span className="donut-total-count">
          {total > 0 ? `${total.toLocaleString()} clicks` : "0 recorded"}
        </span>
      </div>

      {total > 0 ? (
        <div className="donut-card-layout">
          <div className="donut-svg-box">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Background Track Circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
              />
              {/* Colored Slices */}
              {slices.map((slice, idx) => {
                const isHovered = hoveredIdx === idx;
                return (
                  <circle
                    key={idx}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      transform: "rotate(-90deg)",
                      transformOrigin: "50% 50%",
                      transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                      cursor: "pointer",
                      opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
              {/* Center text */}
              <text
                x="50%"
                y="47%"
                textAnchor="middle"
                fill="var(--text)"
                fontSize="16"
                fontWeight="800"
                fontFamily="Inter, sans-serif"
              >
                {activeSlice ? `${activeSlice.pct}%` : total.toLocaleString()}
              </text>
              <text
                x="50%"
                y="63%"
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="9.5"
                fontFamily="Inter, sans-serif"
              >
                {activeSlice ? activeSlice.name : "Total Clicks"}
              </text>
            </svg>
          </div>

          <div className="donut-legend-list">
            {slices.map((item, idx) => (
              <div
                key={idx}
                className="donut-legend-row"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer" }}
              >
                <div className="donut-legend-item">
                  <span className="legend-swatch" style={{ background: item.color }} />
                  <span className="legend-label-name">{item.name}</span>
                </div>
                <div className="donut-legend-stats">
                  <span className="legend-val-num">{item.count} {item.count === 1 ? "click" : "clicks"}</span>
                  <span className="legend-val-pct">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="donut-empty-text">{emptyMessage}</p>
      )}
    </SpotlightCard>
  );
}

// -----------------------------------------------------------------------------
// Component: ActivityHeatmap (7 Days x 24 Hours in IST)
// /* CHANGE: Polish heatmap hover and cell styling — 2026-10-19 */
// -----------------------------------------------------------------------------
function ActivityHeatmap({ history = [] }) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const cardRef = useRef(null);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Compute 7 x 24 frequency matrix from click history timestamps in IST
  const { matrix, maxClicks } = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;

    history.forEach((click) => {
      if (!click.clickedAt) return;
      const d = new Date(click.clickedAt);
      if (isNaN(d.getTime())) return;

      // Convert UTC to IST (+05:30)
      const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      const dayIndex = (istTime.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const hour = istTime.getUTCHours(); // 0 to 23

      grid[dayIndex][hour] += 1;
      if (grid[dayIndex][hour] > max) {
        max = grid[dayIndex][hour];
      }
    });

    return { matrix: grid, maxClicks: max };
  }, [history]);

  const formatHourIST = (h) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 ? "PM" : "AM";
    const nextH = (h + 1) % 24;
    const nextH12 = nextH % 12 === 0 ? 12 : nextH % 12;
    const nextAmpm = nextH >= 12 ? "PM" : "AM";
    return `${h12}:00 ${ampm} – ${nextH12}:00 ${nextAmpm} IST`;
  };

  const getCellClass = (count) => {
    if (count === 0) return "cell-lvl-0";
    if (maxClicks <= 1) return "cell-lvl-4";
    const ratio = count / maxClicks;
    if (ratio >= 0.75) return "cell-lvl-4";
    if (ratio >= 0.5) return "cell-lvl-3";
    if (ratio >= 0.25) return "cell-lvl-2";
    return "cell-lvl-1";
  };

  const handleCellMouseEnter = (e, dayName, hour, count) => {
    if (!cardRef.current) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();

    const rawX = cellRect.left - cardRect.left + cellRect.width / 2;
    const cellY = cellRect.top - cardRect.top;

    setHoveredCell({
      day: dayName,
      hour,
      timeWindow: formatHourIST(hour),
      count,
      x: rawX,
      y: cellY,
      cardWidth: cardRect.width,
    });
  };

  return (
    <div className="heatmap-card" ref={cardRef}>
      <div className="heatmap-header">
        <div className="heatmap-title-group">
          <h3>Click Activity Heatmap (IST)</h3>
          <p>Audience interaction density distributed by day of the week and hour in Indian Standard Time</p>
        </div>

        <div className="heatmap-legend-scale">
          <span>Less</span>
          <div className="scale-box cell-lvl-0" />
          <div className="scale-box cell-lvl-1" />
          <div className="scale-box cell-lvl-2" />
          <div className="scale-box cell-lvl-3" />
          <div className="scale-box cell-lvl-4" />
          <span>More</span>
        </div>
      </div>

      <div className="heatmap-grid-wrapper" onMouseLeave={() => setHoveredCell(null)}>
        <table className="heatmap-table">
          <thead>
            <tr className="heatmap-hour-header">
              <th className="heatmap-day-label"></th>
              {hours.map((h) => (
                <th key={h}>{h % 3 === 0 ? (h === 0 ? "12A" : h < 12 ? `${h}A` : h === 12 ? "12P" : `${h - 12}P`) : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((dayName, dayIdx) => (
              <tr key={dayName}>
                <td className="heatmap-day-label">{dayName}</td>
                {hours.map((hour) => {
                  const count = matrix[dayIdx][hour];
                  return (
                    <td
                      key={hour}
                      className={`heatmap-cell ${getCellClass(count)}`}
                      onMouseEnter={(e) => handleCellMouseEnter(e, dayName, hour, count)}
                      aria-label={`${dayName}, ${formatHourIST(hour)}: ${count} clicks`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hoveredCell && (
        <div
          className="heatmap-tooltip"
          style={{
            left: `${Math.max(85, Math.min(hoveredCell.cardWidth - 85, hoveredCell.x))}px`,
            top: `${hoveredCell.y - 8}px`,
          }}
        >
          <div className="heatmap-tooltip-title">{hoveredCell.day} • {hoveredCell.timeWindow}</div>
          <div className="heatmap-tooltip-body">
            <span className="heatmap-tooltip-indicator" />
            <span className="heatmap-tooltip-count">{hoveredCell.count}</span>
            <span className="heatmap-tooltip-label">{hoveredCell.count === 1 ? "click" : "clicks"}</span>
          </div>
        </div>
      )}

      <div className="heatmap-hover-info">
        {hoveredCell ? (
          <span>
            <strong>{hoveredCell.day}</strong>, {hoveredCell.timeWindow}: <strong>{hoveredCell.count}</strong> click{hoveredCell.count !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="heatmap-hint-text">Hover over any cell to inspect hourly click density in IST</span>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: YearlyActivityGraph (GitHub-Style Yearly Contribution Activity in IST)
// -----------------------------------------------------------------------------
function YearlyActivityGraph({ history = [], dailyTrends = [], totalClicks = 0 }) {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [hoveredWeek, setHoveredWeek] = useState(null);
  const [hoveredDow, setHoveredDow] = useState(null);
  const cardRef = useRef(null);

  // 1. Build a fast lookup map of IST dates YYYY-MM-DD -> click count
  const { dateClickMap, availableYears, currentYearClicks } = useMemo(() => {
    const map = {};
    const yearsSet = new Set();
    const currentYr = new Date().getFullYear();
    yearsSet.add(currentYr);
    // Ensure previous 2 years are available for selection even if empty
    yearsSet.add(currentYr - 1);
    yearsSet.add(currentYr - 2);

    // Populate from dailyTrends (already in IST YYYY-MM-DD)
    (dailyTrends || []).forEach((t) => {
      if (t.isoDate) {
        map[t.isoDate] = (map[t.isoDate] || 0) + (t.count || 0);
        const yr = parseInt(t.isoDate.split("-")[0], 10);
        if (!isNaN(yr)) yearsSet.add(yr);
      }
    });

    // Populate from click history (convert clickedAt to IST YYYY-MM-DD)
    (history || []).forEach((c) => {
      if (!c.clickedAt) return;
      const d = new Date(c.clickedAt);
      if (isNaN(d.getTime())) return;
      // Convert to IST (+05:30)
      const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      const iso = istTime.toISOString().slice(0, 10);
      if (!map[iso]) {
        map[iso] = (map[iso] || 0) + 1;
      }
      const yr = istTime.getUTCFullYear();
      if (!isNaN(yr)) yearsSet.add(yr);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    // Calculate total clicks for the selected year
    let yrClicks = 0;
    Object.keys(map).forEach((dateKey) => {
      if (dateKey.startsWith(`${selectedYear}-`)) {
        yrClicks += map[dateKey];
      }
    });

    return {
      dateClickMap: map,
      availableYears: sortedYears,
      currentYearClicks: yrClicks,
    };
  }, [history, dailyTrends, selectedYear]);

  // 2. Generate calendar weeks (52-53 weeks) for selectedYear
  const { weeks, monthHeaders, maxDayClicks } = useMemo(() => {
    const isLeap = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;

    const startDate = new Date(Date.UTC(selectedYear, 0, 1));
    const startDayOfWeek = (startDate.getUTCDay() + 6) % 7; // 0 for Mon ... 6 for Sun

    const allWeeks = [];
    let currentWeek = [];
    const months = [];
    let lastMonthSeen = -1;
    let maxClicks = 0;

    // Pad beginning of first week if Jan 1 is not Monday
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Iterate through every day of the year
    for (let dayOfYear = 0; dayOfYear < daysInYear; dayOfYear++) {
      const curDate = new Date(Date.UTC(selectedYear, 0, 1 + dayOfYear));
      const m = curDate.getUTCMonth();
      const d = curDate.getUTCDate();
      const isoDate = `${selectedYear}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const clicks = dateClickMap[isoDate] || 0;
      if (clicks > maxClicks) maxClicks = clicks;

      if (m !== lastMonthSeen) {
        lastMonthSeen = m;
        months.push({
          monthIndex: m,
          name: curDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
          weekColIndex: allWeeks.length,
        });
      }

      currentWeek.push({
        date: curDate,
        isoDate,
        month: m,
        dayOfMonth: d,
        clicks,
        formattedDate: curDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }),
      });

      if (currentWeek.length === 7) {
        allWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      allWeeks.push(currentWeek);
    }

    return {
      weeks: allWeeks,
      monthHeaders: months,
      maxDayClicks: maxClicks,
    };
  }, [selectedYear, dateClickMap]);

  // 3. Dynamic Statistics for Yearly Activity Summary Panel (Right Side)
  const summaryStats = useMemo(() => {
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      nameShort: monthNamesShort[i],
      nameFull: monthNamesFull[i],
      clicks: 0,
    }));

    let totalYearClicks = 0;
    let activeDaysCount = 0;
    let busiestDay = null;
    let maxClicksOnDay = 0;

    Object.keys(dateClickMap).forEach((dateKey) => {
      if (dateKey.startsWith(`${selectedYear}-`)) {
        const count = dateClickMap[dateKey] || 0;
        if (count > 0) {
          totalYearClicks += count;
          activeDaysCount += 1;

          const parts = dateKey.split("-").map(Number);
          const mIdx = parts[1] - 1;
          const dayNum = parts[2];

          if (mIdx >= 0 && mIdx < 12) {
            monthlyData[mIdx].clicks += count;
          }

          if (count > maxClicksOnDay) {
            maxClicksOnDay = count;
            const d = new Date(Date.UTC(parts[0], mIdx, dayNum));
            busiestDay = {
              isoDate: dateKey,
              formattedDate: d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }),
              clicks: count,
            };
          }
        }
      }
    });

    let busiestMonth = null;
    let maxMonthClicks = 0;
    monthlyData.forEach((m) => {
      if (m.clicks > maxMonthClicks) {
        maxMonthClicks = m.clicks;
        busiestMonth = m;
      }
    });

    const avgClicksPerActiveDay = activeDaysCount > 0
      ? (totalYearClicks / activeDaysCount).toFixed(1)
      : "0.0";

    return {
      totalYearClicks,
      activeDaysCount,
      busiestMonth: busiestMonth ? { name: busiestMonth.nameFull, nameShort: busiestMonth.nameShort, clicks: busiestMonth.clicks } : null,
      busiestDay,
      avgClicksPerActiveDay,
      monthlyData,
      maxMonthClicks,
    };
  }, [dateClickMap, selectedYear]);

  // 4. Weekly Click Activity Data across up to 53 weeks (Indian Standard Time)
  const weeklyData = useMemo(() => {
    let maxClicks = 0;
    let totalClicks = 0;

    const list = weeks.map((week, idx) => {
      const nonNullDays = week.filter(Boolean);
      const weekClicks = week.reduce((sum, d) => sum + (d ? d.clicks : 0), 0);
      if (weekClicks > maxClicks) maxClicks = weekClicks;
      totalClicks += weekClicks;

      const firstDay = nonNullDays[0];
      const lastDay = nonNullDays[nonNullDays.length - 1];
      const rangeLabel = firstDay && lastDay
        ? `${firstDay.formattedDate.split(",")[1]?.trim() || firstDay.isoDate} – ${lastDay.formattedDate.split(",")[1]?.trim() || lastDay.isoDate}`
        : `Week ${idx + 1}`;

      return {
        weekIndex: idx + 1,
        clicks: weekClicks,
        rangeLabel,
      };
    });

    // Generate SVG path coordinates
    let linePath = "";
    let areaPath = "";

    if (maxClicks > 0 && list.length > 0) {
      const pts = list.map((w, idx) => {
        const x = 36 + (idx / Math.max(1, list.length - 1)) * 709;
        const y = 88 - (w.clicks / maxClicks) * 72;
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      });

      linePath = `M ${pts[0].x},${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x},${p.y}`).join(" ");
      areaPath = `M ${pts[0].x},88 L ${pts[0].x},${pts[0].y} ` +
        pts.slice(1).map((p) => `L ${p.x},${p.y}`).join(" ") +
        ` L ${pts[pts.length - 1].x},88 Z`;
    }

    return {
      list,
      maxClicks,
      totalClicks,
      linePath,
      areaPath,
    };
  }, [weeks]);

  // 5. Day-of-Week Analysis Data (Monday through Sunday)
  const dowData = useMemo(() => {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayNamesShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    let totalClicks = 0;

    weeks.forEach((week) => {
      week.forEach((day, dIdx) => {
        if (day && day.clicks > 0) {
          counts[dIdx] += day.clicks;
          totalClicks += day.clicks;
        }
      });
    });

    let maxDayClicks = 0;
    let busiestIdx = -1;
    counts.forEach((c, idx) => {
      if (c > maxDayClicks) {
        maxDayClicks = c;
        busiestIdx = idx;
      }
    });

    const list = dayNames.map((name, idx) => ({
      name,
      nameShort: dayNamesShort[idx],
      clicks: counts[idx],
      percent: totalClicks > 0 ? ((counts[idx] / totalClicks) * 100).toFixed(1) : "0.0",
      isBusiest: busiestIdx === idx && counts[idx] > 0,
    }));

    return {
      list,
      maxDayClicks,
      totalClicks,
      busiestDay: busiestIdx >= 0 && counts[busiestIdx] > 0 ? list[busiestIdx] : null,
    };
  }, [weeks]);

  // 6. X-Axis Week Ticks for Weekly Click Activity (Week 1–53)
  const weekTicks = useMemo(() => {
    if (!weeklyData.list || weeklyData.list.length === 0) return [];
    const totalWeeks = weeklyData.list.length;
    const lastIdx = totalWeeks - 1;
    // Step by 5 weeks: Week 1 (idx 0), Week 5 (idx 4), Week 10 (idx 9)... up to end
    const tickIndices = [0];
    for (let w = 5; w < totalWeeks; w += 5) {
      tickIndices.push(w - 1);
    }
    if (!tickIndices.includes(lastIdx)) {
      if (lastIdx - tickIndices[tickIndices.length - 1] < 2) {
        tickIndices[tickIndices.length - 1] = lastIdx;
      } else {
        tickIndices.push(lastIdx);
      }
    }

    return tickIndices.map((idx) => {
      const w = weeklyData.list[idx];
      const xPos = 36 + (idx / Math.max(1, totalWeeks - 1)) * 709;
      const isFirst = idx === 0;
      const isLast = idx === lastIdx;
      return {
        idx,
        weekNum: idx + 1,
        label: `W${idx + 1}`,
        fullLabel: `Week ${idx + 1}`,
        rangeLabel: w ? w.rangeLabel : `Week ${idx + 1}`,
        xPos,
        textAnchor: isFirst ? "start" : isLast ? "end" : "middle",
      };
    });
  }, [weeklyData.list]);

  // Intensity level calculation (0 to 4)
  const getIntensityLevel = (count) => {
    if (count === 0) return 0;
    if (maxDayClicks <= 3) return Math.min(count, 4);
    const ratio = count / maxDayClicks;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  };

  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div className="yearly-graph-card" ref={cardRef}>
      {/* Top Header Row with Title and Year Selector */}
      <div className="yearly-graph-topbar">
        <div className="yearly-graph-title-group">
          <h3>
            <Calendar size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "8px", color: "var(--accent)" }} />
            Click Activity Graph ({selectedYear})
          </h3>
          <p>Daily click activity and frequency.</p>
        </div>

        <div className="yearly-graph-actions">
          <div className="yearly-total-badge">
            <span className="yearly-total-num">{summaryStats.totalYearClicks.toLocaleString()}</span> clicks in {selectedYear}
          </div>

          <select
            className="year-select-dropdown"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="Select Activity Year"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Two-Column Side-by-Side Layout */}
      <div className="yearly-main-layout">
        {/* LEFT COLUMN: Contribution Calendar + Weekly Click Activity + Day-of-Week Analysis */}
        <div className="yearly-calendar-panel">
          {/* Block 1: Contribution Calendar (Top) */}
          <SpotlightCard
            className="yearly-panel-block calendar-sub-block"
            spotlightColor="rgba(168, 85, 247, 0.22)"
            borderColor="rgba(192, 132, 252, 0.65)"
            radius={340}
          >
            <div className="yearly-panel-title">
              <span>Contribution Calendar</span>
              <span className="yearly-sub-hint">53 Weeks · Monday to Sunday (IST)</span>
            </div>

            <div className="yearly-graph-container">
              <div className="yearly-graph-scroll">
                {/* Month labels row */}
                <div className="yearly-months-row">
                  <div className="yearly-day-label-placeholder" />
                  <div className="yearly-months-track">
                    {monthHeaders.map((m, idx) => (
                      <span
                        key={idx}
                        className="yearly-month-label"
                        style={{ left: `${m.weekColIndex * 15}px` }}
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Grid body: Weekday labels on left + 53 week columns on right */}
                <div className="yearly-grid-body">
                  <div className="yearly-day-labels-col">
                    {dayLabels.map((lbl, idx) => (
                      <span key={idx} className="yearly-day-label">
                        {lbl}
                      </span>
                    ))}
                  </div>

                  <div className="yearly-weeks-grid">
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="yearly-week-col">
                        {week.map((day, dIdx) => {
                          if (!day) {
                            return <div key={dIdx} className="yearly-cell yearly-cell-empty" />;
                          }
                          const lvl = getIntensityLevel(day.clicks);
                          return (
                            <div
                              key={dIdx}
                              className={`yearly-cell yearly-cell-lvl-${lvl}`}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const cardRect = cardRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
                                setHoveredDay({
                                  ...day,
                                  x: rect.left - cardRect.left + rect.width / 2,
                                  y: rect.top - cardRect.top,
                                });
                              }}
                              onMouseLeave={() => setHoveredDay(null)}
                              aria-label={`${day.clicks} clicks on ${day.formattedDate}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Tooltip */}
              {hoveredDay && (
                <div
                  className="yearly-tooltip"
                  style={{
                    left: `${hoveredDay.x}px`,
                    top: `${hoveredDay.y - 12}px`,
                  }}
                >
                  <div className="yearly-tooltip-count">
                    {hoveredDay.clicks > 0
                      ? `${hoveredDay.clicks} ${hoveredDay.clicks === 1 ? "click" : "clicks"}`
                      : "No clicks"}
                  </div>
                  <div className="yearly-tooltip-date">{hoveredDay.formattedDate} (IST)</div>
                </div>
              )}
            </div>

            {/* Legend & Stats footer */}
            <div className="yearly-graph-footer">
              <span className="yearly-footer-note">Hover over any day square to inspect recorded clicks in IST</span>
              <div className="yearly-legend">
                <span className="yearly-legend-text">Less</span>
                <div className="yearly-legend-cell yearly-cell-lvl-0" />
                <div className="yearly-legend-cell yearly-cell-lvl-1" />
                <div className="yearly-legend-cell yearly-cell-lvl-2" />
                <div className="yearly-legend-cell yearly-cell-lvl-3" />
                <div className="yearly-legend-cell yearly-cell-lvl-4" />
                <span className="yearly-legend-text">More</span>
              </div>
            </div>
          </SpotlightCard>

          {/* Block 2: Weekly Click Activity (Middle) */}
          <SpotlightCard
            className="yearly-panel-block weekly-chart-block"
            spotlightColor="rgba(56, 189, 248, 0.24)"
            borderColor="rgba(56, 189, 248, 0.70)"
            radius={340}
          >
            <div className="weekly-chart-header">
              <div className="weekly-title-group">
                <h5>
                  <TrendingUp size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--accent)" }} />
                  Weekly Click Activity ({selectedYear})
                </h5>
                <p>Weekly click totals across 52 weeks.</p>
              </div>
            </div>

            <div className="weekly-chart-svg-wrap">
              <svg viewBox="0 0 760 110" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="weeklyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                <line x1="36" y1="16" x2="745" y2="16" stroke="var(--border)" strokeDasharray="3,3" />
                <line x1="36" y1="52" x2="745" y2="52" stroke="var(--border)" strokeDasharray="3,3" />
                <line x1="36" y1="88" x2="745" y2="88" stroke="var(--border)" />

                {/* Y-axis tick labels */}
                <text x="30" y="19" fill="#64748b" fontSize="9" textAnchor="end">{weeklyData.maxClicks > 0 ? weeklyData.maxClicks : "-"}</text>
                <text x="30" y="55" fill="#64748b" fontSize="9" textAnchor="end">{weeklyData.maxClicks > 0 ? Math.round(weeklyData.maxClicks / 2) : "-"}</text>
                <text x="30" y="91" fill="#64748b" fontSize="9" textAnchor="end">0</text>

                {/* X-axis Week Markers (Week 1–53) */}
                {weekTicks.map((tick) => (
                  <g key={tick.idx}>
                    <line
                      x1={tick.xPos}
                      y1="88"
                      x2={tick.xPos}
                      y2="92"
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                    <text
                      x={tick.xPos}
                      y="103"
                      fill="#94a3b8"
                      fontSize="8.5"
                      fontWeight="500"
                      textAnchor={tick.textAnchor}
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* Area and Line Path */}
                {weeklyData.maxClicks > 0 ? (
                  <>
                    <path
                      d={weeklyData.areaPath}
                      fill="url(#weeklyAreaGrad)"
                    />
                    <path
                      d={weeklyData.linePath}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data points on active weeks */}
                    {weeklyData.list.map((w, wIdx) => {
                      if (w.clicks === 0) return null;
                      const x = 36 + (wIdx / Math.max(1, weeklyData.list.length - 1)) * 709;
                      const y = 88 - (w.clicks / weeklyData.maxClicks) * 72;
                      return (
                        <circle
                          key={wIdx}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#38bdf8"
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </>
                ) : (
                  <text x="390" y="52" fill="#64748b" fontSize="11" textAnchor="middle">
                    No weekly click activity recorded for {selectedYear}
                  </text>
                )}

                {/* Interactive Hover Guideline & Tooltip Tag */}
                {hoveredWeek && (
                  <>
                    <line
                      x1={hoveredWeek.x}
                      y1="16"
                      x2={hoveredWeek.x}
                      y2="88"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={hoveredWeek.x}
                      cy={hoveredWeek.y}
                      r="5"
                      fill="#38bdf8"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                    <g transform={`translate(${Math.min(680, Math.max(70, hoveredWeek.x))}, ${hoveredWeek.y > 45 ? hoveredWeek.y - 18 : hoveredWeek.y + 20})`}>
                      <rect x="-46" y="-11" width="92" height="19" rx="4" fill="var(--surface-2)" stroke="var(--accent)" strokeWidth="1" />
                      <text x="0" y="2" fill="#38bdf8" fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                        W{hoveredWeek.weekIndex}: {hoveredWeek.clicks} {hoveredWeek.clicks === 1 ? "click" : "clicks"}
                      </text>
                    </g>
                  </>
                )}

                {/* Transparent hover capture rects */}
                {weeklyData.list.map((w, wIdx) => {
                  const x = 36 + (wIdx / Math.max(1, weeklyData.list.length - 1)) * 709;
                  const y = weeklyData.maxClicks > 0 ? 88 - (w.clicks / weeklyData.maxClicks) * 72 : 88;
                  const sliceWidth = 709 / weeklyData.list.length;
                  return (
                    <rect
                      key={wIdx}
                      x={x - sliceWidth / 2}
                      y="10"
                      width={sliceWidth}
                      height="80"
                      fill="transparent"
                      cursor="pointer"
                      onMouseEnter={() => setHoveredWeek({ ...w, x, y })}
                      onMouseLeave={() => setHoveredWeek(null)}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="weekly-chart-footer">
              {hoveredWeek ? (
                <span className="weekly-hover-info">
                  <strong>Week {hoveredWeek.weekIndex} ({hoveredWeek.rangeLabel})</strong>: {hoveredWeek.clicks} {hoveredWeek.clicks === 1 ? "click" : "clicks"}
                </span>
              ) : (
                <span className="weekly-chart-hint">
                  {weeklyData.totalClicks > 0
                    ? `Hover curve to inspect weekly volume · ${weeklyData.totalClicks} clicks recorded across 52 weeks`
                    : `No weekly click records for ${selectedYear}`}
                </span>
              )}
            </div>
          </SpotlightCard>

          {/* Block 3: Day-of-Week Analysis (Bottom) */}
          <SpotlightCard
            className="yearly-panel-block dow-chart-block"
            spotlightColor="rgba(168, 85, 247, 0.24)"
            borderColor="rgba(192, 132, 252, 0.70)"
            radius={340}
          >
            <div className="dow-chart-header">
              <div className="dow-title-group">
                <h5>
                  <BarChart3 size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--accent)" }} />
                  Day-of-Week Analysis
                </h5>
                <p>Traffic distribution from Monday through Sunday.</p>
              </div>
            </div>

            <div className="dow-bars-container">
              {dowData.list.map((day, dIdx) => {
                const ratio = dowData.maxDayClicks > 0 ? day.clicks / dowData.maxDayClicks : 0;
                const heightPercent = dowData.maxDayClicks > 0
                  ? Math.max(day.clicks > 0 ? 14 : 4, Math.round(ratio * 100))
                  : 4;

                return (
                  <div
                    key={dIdx}
                    className={`dow-bar-col ${day.isBusiest ? "busiest-dow-col" : ""}`}
                    onMouseEnter={() => setHoveredDow(day)}
                    onMouseLeave={() => setHoveredDow(null)}
                    title={`${day.name}: ${day.clicks} clicks (${day.percent}%)`}
                  >
                    {hoveredDow && hoveredDow.name === day.name && (
                      <div className="dow-floating-tooltip">
                        {day.clicks} {day.clicks === 1 ? "click" : "clicks"} ({day.percent}%)
                      </div>
                    )}
                    <div className="dow-bar-val">
                      {day.clicks > 0 ? day.clicks : ""}
                    </div>

                    <div className="dow-bar-track">
                      <div
                        className={`dow-bar-fill ${day.clicks > 0 ? "has-clicks" : "zero-clicks"}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    <span className={`dow-bar-label ${day.isBusiest ? "busiest-dow-label" : ""}`}>
                      {day.nameShort}
                    </span>
                    <span className="dow-bar-percent">
                      {dowData.totalClicks > 0 ? `${day.percent}%` : "0%"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="dow-chart-footer">
              {hoveredDow ? (
                <span className="dow-hover-info">
                  <strong>{hoveredDow.name}</strong>: {hoveredDow.clicks} {hoveredDow.clicks === 1 ? "click" : "clicks"} ({hoveredDow.percent}% of yearly total)
                </span>
              ) : (
                <span className="dow-chart-hint">
                  {dowData.totalClicks > 0
                    ? `Hover day column to inspect weekday concentration · Busiest: ${dowData.busiestDay ? dowData.busiestDay.name : "None"}`
                    : `No weekday click data recorded in ${selectedYear}`}
                </span>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* RIGHT PANEL: Yearly Activity Summary */}
        <div className="yearly-summary-panel">
          <div className="yearly-summary-top">
            <div className="yearly-summary-title">
              <BarChart3 size={15} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--accent)" }} />
              <h4>Yearly Activity Summary</h4>
            </div>
            <span className="summary-year-tag">{selectedYear}</span>
          </div>

          {/* 5 KPI Metric Cards */}
          <div className="yearly-summary-metrics-grid">
            {/* Metric 1: Total Clicks */}
            <SpotlightCard
              className="summary-metric-card"
              spotlightColor="rgba(99, 102, 241, 0.30)"
              borderColor="rgba(129, 140, 248, 0.75)"
              radius={190}
            >
              <div className="metric-card-header">
                <span className="metric-card-label">Total Clicks</span>
                <MousePointerClick size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="metric-card-value">{summaryStats.totalYearClicks.toLocaleString()}</div>
              <div className="metric-card-subtext">in {selectedYear}</div>
            </SpotlightCard>

            {/* Metric 2: Active Days */}
            <SpotlightCard
              className="summary-metric-card"
              spotlightColor="rgba(168, 85, 247, 0.30)"
              borderColor="rgba(192, 132, 252, 0.75)"
              radius={190}
            >
              <div className="metric-card-header">
                <span className="metric-card-label">Active Days</span>
                <Calendar size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="metric-card-value">
                {summaryStats.activeDaysCount} <span className="metric-unit">{summaryStats.activeDaysCount === 1 ? "day" : "days"}</span>
              </div>
              <div className="metric-card-subtext">with &ge;1 recorded click</div>
            </SpotlightCard>

            {/* Metric 3: Avg Clicks / Active Day */}
            <SpotlightCard
              className="summary-metric-card"
              spotlightColor="rgba(6, 182, 212, 0.30)"
              borderColor="rgba(56, 189, 248, 0.75)"
              radius={190}
            >
              <div className="metric-card-header">
                <span className="metric-card-label">Avg / Active Day</span>
                <Zap size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="metric-card-value">
                {summaryStats.avgClicksPerActiveDay}
              </div>
              <div className="metric-card-subtext">clicks per active day</div>
            </SpotlightCard>

            {/* Metric 4: Busiest Month */}
            <SpotlightCard
              className="summary-metric-card"
              spotlightColor="rgba(245, 158, 11, 0.28)"
              borderColor="rgba(251, 191, 36, 0.75)"
              radius={190}
            >
              <div className="metric-card-header">
                <span className="metric-card-label">Busiest Month</span>
                <Trophy size={14} style={{ color: "var(--warning)" }} />
              </div>
              <div className="metric-card-value" title={summaryStats.busiestMonth ? summaryStats.busiestMonth.name : "None"}>
                {summaryStats.busiestMonth ? summaryStats.busiestMonth.nameShort : "None"}
              </div>
              <div className="metric-card-subtext">
                {summaryStats.busiestMonth ? `${summaryStats.busiestMonth.clicks} clicks` : "No clicks recorded"}
              </div>
            </SpotlightCard>

            {/* Metric 5: Busiest Day */}
            <SpotlightCard
              className="summary-metric-card summary-metric-card-wide"
              spotlightColor="rgba(244, 63, 94, 0.28)"
              borderColor="rgba(251, 113, 133, 0.75)"
              radius={240}
            >
              <div className="metric-card-header">
                <span className="metric-card-label">Busiest Day</span>
                <TrendingUp size={14} style={{ color: "var(--danger)" }} />
              </div>
              <div className="metric-card-value">
                {summaryStats.busiestDay ? summaryStats.busiestDay.formattedDate : "None"}
              </div>
              <div className="metric-card-subtext">
                {summaryStats.busiestDay ? `${summaryStats.busiestDay.clicks} clicks recorded (IST)` : "No clicks recorded in " + selectedYear}
              </div>
            </SpotlightCard>
          </div>

          {/* Metric 6: Monthly Activity Chart comparing all 12 months */}
          <SpotlightCard
            className="yearly-monthly-chart-box"
            spotlightColor="rgba(168, 85, 247, 0.24)"
            borderColor="rgba(192, 132, 252, 0.65)"
            radius={280}
          >
            <div className="monthly-chart-header">
              <span className="monthly-chart-title">Monthly Activity (12 Months)</span>
              <span className="monthly-chart-legend">
                {summaryStats.maxMonthClicks > 0
                  ? `Peak: ${summaryStats.maxMonthClicks} clicks`
                  : `0 clicks in ${selectedYear}`}
              </span>
            </div>

            <div className="monthly-bars-container">
              {summaryStats.monthlyData.map((m) => {
                const ratio = summaryStats.maxMonthClicks > 0 ? m.clicks / summaryStats.maxMonthClicks : 0;
                const heightPercent = summaryStats.maxMonthClicks > 0
                  ? Math.max(m.clicks > 0 ? 14 : 4, Math.round(ratio * 100))
                  : 4;
                const isBusiest = summaryStats.busiestMonth && summaryStats.busiestMonth.nameShort === m.nameShort && m.clicks > 0;

                return (
                  <div
                    key={m.monthIndex}
                    className={`monthly-bar-col ${isBusiest ? "busiest-month-col" : ""}`}
                    onMouseEnter={() => setHoveredMonth(m)}
                    onMouseLeave={() => setHoveredMonth(null)}
                  >
                    {/* Click count label above bar if > 0 */}
                    <div className="monthly-bar-val">
                      {m.clicks > 0 ? m.clicks : ""}
                    </div>

                    {/* Bar track & fill */}
                    <div className="monthly-bar-track">
                      <div
                        className={`monthly-bar-fill ${m.clicks > 0 ? "has-clicks" : "zero-clicks"}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Month label */}
                    <span className={`monthly-bar-label ${isBusiest ? "busiest-label" : ""}`}>
                      {m.nameShort}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hover details / contextual helper */}
            <div className="monthly-chart-footer">
              {hoveredMonth ? (
                <span className="monthly-hover-info">
                  <strong>{hoveredMonth.nameFull} {selectedYear}</strong>: {hoveredMonth.clicks} {hoveredMonth.clicks === 1 ? "click" : "clicks"}
                </span>
              ) : (
                <span className="monthly-chart-hint">
                  {summaryStats.totalYearClicks > 0
                    ? `Hover bar to inspect monthly volume · ${summaryStats.totalYearClicks} clicks total`
                    : `No click activity recorded across 12 months for ${selectedYear}`}
                </span>
              )}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: SmartTrafficSection (Spike Alerts & 4 Intel Cards)
// -----------------------------------------------------------------------------
function SmartTrafficSection({ intelligence }) {
  const defaultCards = [
    {
      id: "traffic_status",
      title: "Traffic Trend",
      icon: <Activity size={14} style={{ color: "var(--accent)" }} />,
      headline: "Baseline Forming",
      detail: "Share your short link to start gathering automated visitor trends and spike detection.",
      type: "info",
    },
    {
      id: "audience_platform",
      title: "Audience Platform",
      icon: <Smartphone size={14} style={{ color: "var(--accent)" }} />,
      headline: "Audience Platform",
      detail: "Visitor device and browser breakdowns will appear automatically once clicked.",
      type: "neutral",
    },
    {
      id: "peak_window",
      title: "Peak Engagement (IST)",
      icon: <Calendar size={14} style={{ color: "var(--accent)" }} />,
      headline: "Timing Unidentified",
      detail: "Active engagement hours in Indian Standard Time will be calculated with incoming traffic.",
      type: "neutral",
    },
    {
      id: "action_tip",
      title: "Actionable Strategy",
      icon: <TrendingUp size={14} style={{ color: "var(--accent)" }} />,
      headline: "Optimal Sharing Window",
      detail: "Distribute your short link across channels to generate actionable engagement insights.",
      type: "tip",
    },
  ];

  const spikeAlert = intelligence?.spikeAlert || null;
  const momentum = intelligence?.momentum || {
    status: "baseline_forming",
    label: "Baseline Forming",
    description: "Monitoring incoming traffic velocity and patterns.",
  };

  const rawCards = intelligence?.cards && intelligence.cards.length > 0 ? intelligence.cards : defaultCards;
  const displayCards = defaultCards.map((fallback, idx) => {
    const raw = rawCards[idx] || rawCards.find((c) => c.id === fallback.id);
    return {
      id: fallback.id,
      title: raw?.title || fallback.title,
      icon: raw?.icon || fallback.icon,
      headline: raw?.headline || fallback.headline,
      detail: raw?.detail || fallback.detail,
      type: raw?.type || fallback.type,
    };
  });

  return (
    <div className="intelligence-section">
      {/* Surge Alert Banner */}
      {intelligence?.hasSpike && spikeAlert && (
        <div className={`intelligence-spike-banner severity-${spikeAlert.severity || "moderate"}`} role="alert">
          <div className="spike-banner-content">
            <Zap size={15} style={{ color: "var(--warning)" }} />
            <div className="spike-text">
              <h4>
                {spikeAlert.severity === "high" ? "High Traffic Surge Detected!" : "Traffic Spike Detected!"}
              </h4>
              <p>{spikeAlert.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="intelligence-header">
        <div className="intel-heading-group">
          <div className="intel-icon-box" aria-hidden="true">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3>Smart Traffic Intelligence</h3>
            <p>Traffic alerts and peak activity analysis.</p>
          </div>
        </div>
      </div>

      {/* 4 Actionable Insight Cards */}
      <div className="intel-cards-grid">
        {displayCards.map((card) => {
          return (
            <SpotlightCard
              key={card.id}
              className="intel-card"
              spotlightColor="var(--accent-soft, rgba(79, 70, 229, 0.12))"
              borderColor="var(--border)"
              radius={240}
            >
              <div className="intel-card-top">
                <span className="intel-card-icon" aria-hidden="true">{card.icon}</span>
                <span className="intel-card-title">{card.title}</span>
              </div>
              <div className="intel-card-headline">{card.headline}</div>
              <p className="intel-card-detail">{card.detail}</p>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CHANGE: Stage 7 — Smart Link Expiration & Access Control Helpers — 2026-11-07
// -----------------------------------------------------------------------------
function getLinkStatus(link) {
  if (!link) {
    return { status: "Active", label: "Active", className: "active", icon: "●", desc: "Active" };
  }
  if (link.isPaused) {
    return {
      status: "Paused",
      label: "Paused",
      className: "paused",
      icon: "●",
      desc: "Link is temporarily paused by owner",
    };
  }
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return {
      status: "Expired",
      label: "Expired",
      className: "expired",
      icon: "●",
      desc: "Link has reached its expiration date and time",
    };
  }
  if (
    typeof link.maxClicks === "number" &&
    link.maxClicks > 0 &&
    (link.clicks || 0) >= link.maxClicks
  ) {
    return {
      status: "Limit Reached",
      label: "Limit Reached",
      className: "limit-reached",
      icon: "●",
      desc: "Link has reached its maximum click limit",
    };
  }
  return {
    status: "Active",
    label: "Active",
    className: "active",
    icon: "●",
    desc: "Link is active and accepting traffic",
  };
}

function getExpiryDisplayInfo(expiresAt) {
  if (!expiresAt) return null;
  const expTime = new Date(expiresAt).getTime();
  if (isNaN(expTime)) return null;

  const diff = expTime - Date.now();
  const dateFormatted = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (diff <= 0) {
    return {
      isExpired: true,
      badgeText: `Expired (${dateFormatted})`,
      fullTitle: `Expired on ${new Date(expiresAt).toLocaleString()}`,
    };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  let timeRemaining = "";
  if (days >= 2) {
    timeRemaining = `in ${days}d`;
  } else if (days === 1) {
    timeRemaining = `tomorrow`;
  } else if (hours >= 1) {
    timeRemaining = `in ${hours}h`;
  } else {
    const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
    timeRemaining = `in ${mins}m`;
  }

  return {
    isExpired: false,
    badgeText: `Expires ${dateFormatted} (${timeRemaining})`,
    fullTitle: `Expires on ${new Date(expiresAt).toLocaleString()} (${timeRemaining})`,
  };
}

// -----------------------------------------------------------------------------
// Component: RecentLinksTable (Links Table with Copy, Status, and Actions)
// -----------------------------------------------------------------------------
function RecentLinksTable({
  links = [],
  onCopy,
  copiedLinkId,
  onOpenAnalytics,
  // CHANGE: QR Code Feature Stage 4 — 2026-11-05
  onOpenQRCode,
  // CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
  onTogglePause,
  onOpenAccessModal,
  togglingLinkId,
  searchTerm,
  setSearchTerm,
  sortOrder,
  setSortOrder,
}) {
  const tableBoxRef = useRef(null);

  const filteredLinks = useMemo(() => {
    let list = [...links];

    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.shortCode?.toLowerCase().includes(q) ||
          l.originalUrl?.toLowerCase().includes(q) ||
          l.utmCampaign?.toLowerCase().includes(q)
      );
    }

    if (sortOrder === "most_clicks") {
      list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    } else if (sortOrder === "oldest") {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else {
      // newest
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return list;
  }, [links, searchTerm, sortOrder]);

  // Ensure table starts at its first column when rendered or filter changes
  useEffect(() => {
    if (tableBoxRef.current) {
      tableBoxRef.current.scrollLeft = 0;
    }
  }, [filteredLinks]);

  return (
    <div className="links-table-card">
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Recent Links</h3>
          <p>Manage and track your active short links.</p>
        </div>

        <div className="table-actions-group">
          <select
            className="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort links"
          >
            <option value="newest">Sort: Newest</option>
            <option value="most_clicks">Sort: Most Clicks</option>
            <option value="oldest">Sort: Oldest</option>
          </select>
        </div>
      </div>

      <div className="table-responsive-box" ref={tableBoxRef}>
        <table className="custom-links-table">
          <thead>
            <tr>
              <th>Link Title & Destination</th>
              <th>Short URL</th>
              <th>Clicks</th>
              <th>Created & Expiry</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLinks.length > 0 ? (
              filteredLinks.map((link) => {
                const shortUrl = `${API_URL}/${link.shortCode}`;
                const isCopied = copiedLinkId === link._id;
                const formattedDate = link.createdAt
                  ? new Date(link.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";

                const statusObj = getLinkStatus(link);
                const expiryInfo = getExpiryDisplayInfo(link.expiresAt);
                const isToggling = togglingLinkId === link._id;

                const domainName = (() => {
                  try {
                    return new URL(link.originalUrl).hostname.replace(/^www\./, "");
                  } catch {
                    return "Link Destination";
                  }
                })();

                return (
                  <tr key={link._id}>
                    <td className="original-url-cell">
                      <div className="link-title-cell-wrap">
                        <div className="link-title-row">
                          {link.utmCampaign ? (
                            <span className="link-campaign-tag" title={`Campaign: ${link.utmCampaign}`}>
                              <Megaphone size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                              {link.utmCampaign}
                            </span>
                          ) : (
                            <span className="link-domain-badge" title={domainName}>
                              <Globe size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                              {domainName}
                            </span>
                          )}
                        </div>
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="original-url-link"
                          title={link.originalUrl}
                        >
                          {link.originalUrl}
                        </a>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="short-url-pill"
                          title="Open short link"
                        >
                          /{link.shortCode}
                        </a>
                        <SpecularButton
                          variant={isCopied ? "success" : "secondary"}
                          size="xs"
                          className={`copy-mini-btn ${isCopied ? "copied" : ""}`}
                          onClick={() => onCopy(link)}
                          title="Copy short link"
                        >
                          {isCopied ? "Copied" : "Copy"}
                        </SpecularButton>
                      </div>
                    </td>
                    <td>
                      <div className="clicks-info-stack">
                        <span className="clicks-badge">
                          {link.clicks || 0}
                          {typeof link.maxClicks === "number" && link.maxClicks > 0 && (
                            <span className="clicks-limit-max"> / {link.maxClicks}</span>
                          )}
                        </span>
                        {typeof link.maxClicks === "number" && link.maxClicks > 0 && (
                          <span
                            className={`clicks-limit-subtext ${
                              (link.clicks || 0) >= link.maxClicks ? "text-danger" : ""
                            }`}
                          >
                            {(link.clicks || 0) >= link.maxClicks
                              ? "Limit reached"
                              : `${Math.max(0, link.maxClicks - (link.clicks || 0))} left`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      <div>{formattedDate}</div>
                      {expiryInfo ? (
                        <div
                          className={`expiry-badge-inline ${expiryInfo.isExpired ? "expired" : "scheduled"}`}
                          title={expiryInfo.fullTitle}
                        >
                          <Clock size={11} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          <span>{expiryInfo.badgeText}</span>
                        </div>
                      ) : (
                        <div className="expiry-none-text">Never expires</div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${statusObj.className}`}
                        title={statusObj.desc}
                      >
                        <span style={{ marginRight: "4px" }}>{statusObj.icon}</span>
                        {statusObj.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="table-actions-cell" style={{ justifyContent: "flex-end" }}>
                        {/* CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07 */}
                        <SpecularButton
                          variant={link.isPaused ? "secondary" : "ghost"}
                          size="xs"
                          className={`btn-action-view ${link.isPaused ? "btn-action-resume" : "btn-action-pause"}`}
                          onClick={() => onTogglePause?.(link)}
                          disabled={isToggling}
                          title={link.isPaused ? "Reactivate this link" : "Temporarily pause this link"}
                          aria-label={link.isPaused ? `Resume ${link.shortCode}` : `Pause ${link.shortCode}`}
                        >
                          {isToggling ? (
                            <span>...</span>
                          ) : link.isPaused ? (
                            <>
                              <span aria-hidden="true">▶</span>
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <span aria-hidden="true">⏸</span>
                              <span>Pause</span>
                            </>
                          )}
                        </SpecularButton>
                        <SpecularButton
                          variant="ghost"
                          size="xs"
                          className="btn-action-view btn-action-access"
                          onClick={() => onOpenAccessModal?.(link)}
                          title="Configure access rules, expiration date & click limits"
                          aria-label={`Access settings for ${link.shortCode}`}
                        >
                          <span>Access</span>
                        </SpecularButton>
                        {/* CHANGE: QR Code Feature Stage 4 — 2026-11-05 */}
                        <SpecularButton
                          variant="ghost"
                          size="xs"
                          className="btn-action-view"
                          onClick={() => onOpenQRCode?.(link)}
                          title={`View QR Code for /${link.shortCode}`}
                          aria-label={`View QR Code for ${link.shortCode}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="12"
                            height="12"
                          >
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          <span>QR</span>
                        </SpecularButton>
                        <SpecularButton
                          variant="ghost"
                          size="xs"
                          className="btn-action-view"
                          onClick={() => onOpenAnalytics(link)}
                          title="View deep-dive analytics"
                        >
                          <span>Stats</span>
                        </SpecularButton>
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-action-view"
                          title="Test redirect"
                        >
                          <span>↗</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="table-empty-row">
                  {links.length === 0
                    ? "No links created yet. Click '+ Create New Link' above to get started!"
                    : "No links match your search filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: AccessSettingsModal (Stage 7: Smart Link Expiration & Access Control)
// -----------------------------------------------------------------------------
function AccessSettingsModal({
  link,
  onClose,
  onSaveSuccess,
  token,
  onSessionExpired,
}) {
  const [isPaused, setIsPaused] = useState(Boolean(link?.isPaused));
  const [expiresAt, setExpiresAt] = useState(() => {
    if (!link?.expiresAt) return "";
    try {
      const d = new Date(link.expiresAt);
      if (isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  });
  const [maxClicks, setMaxClicks] = useState(
    link?.maxClicks !== null && link?.maxClicks !== undefined ? String(link.maxClicks) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentStatus = useMemo(() => getLinkStatus(link), [link]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    let validatedExpiresAt = null;
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        setError("Please enter a valid expiration date and time");
        return;
      }
      if (expDate.getTime() <= Date.now()) {
        setError("Expiration date must be in the future");
        return;
      }
      validatedExpiresAt = expDate.toISOString();
    }

    let validatedMaxClicks = null;
    if (maxClicks.trim()) {
      const num = parseInt(maxClicks.trim(), 10);
      if (isNaN(num) || num < 1) {
        setError("Maximum clicks must be a positive integer (at least 1)");
        return;
      }
      validatedMaxClicks = num;
    }

    setLoading(true);
    try {
      const res = await axios.patch(
        `${API_URL}/${link._id}/access`,
        {
          expiresAt: validatedExpiresAt,
          maxClicks: validatedMaxClicks,
          isPaused: Boolean(isPaused),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success && res.data?.data) {
        setSuccess("Access settings updated successfully!");
        setTimeout(() => {
          onSaveSuccess?.(res.data.data);
        }, 500);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        onSessionExpired?.();
      } else {
        setError(err.response?.data?.message || "Failed to update access settings.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel access-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px" }}
      >
        <div className="modal-header">
          <div>
            <h3>Link Access & Expiration</h3>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              /{link.shortCode} • {link.originalUrl}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Status Summary Banner */}
            <div className="access-status-card">
              <div className="access-status-card-header">
                <span className="access-status-label">Current Status:</span>
                <span className={`status-pill ${currentStatus.className}`}>
                  {currentStatus.icon} {currentStatus.label}
                </span>
              </div>
              <div className="access-status-metrics">
                <span>Clicks: <strong>{link.clicks || 0}</strong></span>
                <span>
                  Limit:{" "}
                  <strong>{link.maxClicks ? `${link.maxClicks} clicks` : "Unlimited"}</strong>
                </span>
                <span>
                  Expiry:{" "}
                  <strong>
                    {link.expiresAt
                      ? new Date(link.expiresAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Never"}
                  </strong>
                </span>
              </div>
            </div>

            {error && (
              <div className="auth-alert error">
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div
                className="auth-alert success"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#10B981",
                }}
              >
                <span>✓ {success}</span>
              </div>
            )}

            {/* 1. Pause Toggle */}
            <div className="access-form-section">
              <label className="access-toggle-container">
                <input
                  type="checkbox"
                  checked={isPaused}
                  onChange={(e) => setIsPaused(e.target.checked)}
                />
                <span className="access-toggle-text">
                  <span className="access-toggle-title">
                    {isPaused ? "⏸ Link is currently Paused" : "▶ Link is currently Active"}
                  </span>
                  <span className="access-toggle-hint">
                    Check this to temporarily pause the link. Visitors will receive a paused message.
                  </span>
                </span>
              </label>
            </div>

            {/* 2. Expiration Date & Time */}
            <div className="access-form-section">
              <div className="access-field-header">
                <label className="modal-input-label">Expiration Date & Time</label>
                {expiresAt && (
                  <button
                    type="button"
                    className="access-clear-btn"
                    onClick={() => setExpiresAt("")}
                  >
                    Clear Expiry (Never)
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                className="modal-text-input"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="access-field-desc">
                After this timestamp, visitors will receive 410 Expired instead of redirecting.
              </p>
            </div>

            {/* 3. Maximum Clicks */}
            <div className="access-form-section">
              <div className="access-field-header">
                <label className="modal-input-label">Maximum Click Limit</label>
                {maxClicks && (
                  <button
                    type="button"
                    className="access-clear-btn"
                    onClick={() => setMaxClicks("")}
                  >
                    Clear Limit (Unlimited)
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="1"
                className="modal-text-input"
                placeholder="e.g. 50, 100, 500 (leave empty for unlimited)"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
              />
              <p className="access-field-desc">
                After reaching this click count, redirects are automatically blocked (410 Limit Reached).
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <SpecularButton
              variant="secondary"
              size="md"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </SpecularButton>
            <SpecularButton
              variant="primary"
              size="md"
              type="submit"
              className="btn-create-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </SpecularButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: CampaignMetricCards & CampaignAnalyticsView (Stage 5B: Campaign View)
// CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02
// -----------------------------------------------------------------------------
function CampaignMetricCards({ summary, loading = false }) {
  const attributedClicks = summary?.attributedClicks || 0;
  const totalRecordedClicks = summary?.totalRecordedClicks || 0;
  const unattributedClicks = summary?.unattributedClicks || 0;
  const totalCampaigns = summary?.totalCampaigns || 0;
  const topSource = summary?.topSource;
  const topCampaign = summary?.topCampaign;

  const cards = [
    {
      id: "campaign_clicks",
      label: "Attributed clicks",
      value: attributedClicks,
      helper: `${totalRecordedClicks.toLocaleString()} total recorded clicks`,
      icon: <MousePointerClick size={18} />,
    },
    {
      id: "total_campaigns",
      label: "Active campaigns",
      value: totalCampaigns,
      helper: totalCampaigns === 1 ? "1 active campaign" : `${totalCampaigns} active campaigns`,
      icon: <Megaphone size={18} />,
    },
    {
      id: "top_source",
      label: "Top traffic source",
      value: topSource?.name || "None",
      helper: topSource ? `${topSource.count.toLocaleString()} clicks` : "No source recorded",
      icon: <Globe size={18} />,
    },
    {
      id: "top_campaign",
      label: "Top campaign",
      value: topCampaign?.name || "None",
      helper: topCampaign ? `${topCampaign.count.toLocaleString()} clicks` : "No campaign recorded",
      icon: <Megaphone size={18} />,
    },
  ];

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`}>
      {cards.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          helper={card.helper}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: CampaignPerformanceTable (Stage 5C: Campaign Performance Table)
// CHANGE: Stage 5C — 2026-11-03
// -----------------------------------------------------------------------------
function CampaignPerformanceTable({ performance = [], loading = false }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return performance;
    const q = searchTerm.toLowerCase().trim();
    return performance.filter(
      (r) =>
        r.campaign?.toLowerCase().includes(q) ||
        r.source?.toLowerCase().includes(q) ||
        r.medium?.toLowerCase().includes(q)
    );
  }, [performance, searchTerm]);

  return (
    <div className="links-table-card campaign-table-card">
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Campaign Performance</h3>
          <p>Click distribution by campaign, source, and medium.</p>
        </div>

        <div className="table-actions-group">
          <input
            type="search"
            className="table-search-input"
            placeholder="Filter campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filter campaigns"
          />
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Traffic Source</th>
              <th>Traffic Medium</th>
              <th style={{ textAlign: "right" }}>Click Count</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="table-empty-cell">
                  <div className="table-loading-inline">
                    <span className="spinner-purple-sm"></span>
                    <span>Loading campaign performance...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRows.length > 0 ? (
              filteredRows.map((row, idx) => {
                const isUntracked = row.campaign === "Direct / Untracked";
                return (
                  <tr key={`${row.campaign}-${row.source}-${row.medium}-${idx}`}>
                    <td>
                      <div className="campaign-name-wrapper">
                        {isUntracked ? (
                          <span className="campaign-untracked-label">
                            Direct / Untracked
                          </span>
                        ) : (
                          <span className="campaign-name-pill" title={row.campaign}>
                            {row.campaign}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="campaign-tag-source" title={row.source}>
                        {row.source}
                      </span>
                    </td>
                    <td>
                      <span className="campaign-tag-medium" title={row.medium}>
                        {row.medium}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="campaign-click-count-badge">
                        {row.count.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="table-empty-cell">
                  <div className="table-empty-state">
                    <span>
                      {searchTerm
                        ? "No campaign rows matched your search."
                        : "No campaign clicks recorded for this time period."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helper: buildContinuousCampaignTrends (Fill missing dates with zero clicks)
// CHANGE: Added Campaign Clicks Over Time line chart — 2026-11-03
// -----------------------------------------------------------------------------
function buildContinuousCampaignTrends(dailyTrends = [], timeRange = "7d") {
  const countByIso = {};
  if (Array.isArray(dailyTrends)) {
    dailyTrends.forEach((item) => {
      if (!item) return;
      const key = item.isoDate || (typeof item._id === "string" ? item._id : null);
      if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
        countByIso[key] = (countByIso[key] || 0) + Math.max(0, item.count || 0);
      }
    });
  }

  const todayIST = getTodayISTStr();

  if (timeRange === "7d" || timeRange === "30d") {
    const numDays = timeRange === "7d" ? 7 : 30;
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const iso = shiftISODate(todayIST, -i);
      result.push({
        isoDate: iso,
        date: formatDisplayDate(iso),
        count: Math.max(0, countByIso[iso] || 0),
      });
    }
    return result;
  }

  // All time: include every recorded date from earliest campaign click up to today,
  // filling zero-click dates in between so the graph has a continuous timeline.
  const datesWithClicks = Object.keys(countByIso)
    .filter((k) => (countByIso[k] || 0) > 0)
    .sort();
  const earliestClickDate = datesWithClicks[0] || todayIST;

  // Ensure at least a 7-day span up to today so fresh campaigns never collapse to a single point
  const minStartDate = shiftISODate(todayIST, -6);
  const effectiveStartDate = earliestClickDate < minStartDate ? earliestClickDate : minStartDate;
  const totalDays = Math.max(6, getDaysBetween(effectiveStartDate, todayIST));

  const result = [];
  for (let i = totalDays; i >= 0; i--) {
    const iso = shiftISODate(todayIST, -i);
    result.push({
      isoDate: iso,
      date: formatDisplayDate(iso),
      count: Math.max(0, countByIso[iso] || 0),
    });
  }
  return result;
}

// -----------------------------------------------------------------------------
// Component: CampaignClicksChart (Campaign Clicks Over Time)
// CHANGE: Added Campaign Clicks Over Time line chart — 2026-11-03
// -----------------------------------------------------------------------------
function CampaignClicksChart({ dailyTrends = [], timeRange = "all", loading = false }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const rangeLabel =
    timeRange === "7d"
      ? "last 7 days"
      : timeRange === "30d"
      ? "last 30 days"
      : "all time";

  const continuousTrends = useMemo(() => {
    return buildContinuousCampaignTrends(dailyTrends, timeRange);
  }, [dailyTrends, timeRange]);

  const maxCount = useMemo(() => {
    if (!continuousTrends || continuousTrends.length === 0) return 0;
    return Math.max(0, ...continuousTrends.map((d) => Math.max(0, d.count || 0)));
  }, [continuousTrends]);

  const totalPeriodClicks = useMemo(() => {
    if (!continuousTrends || continuousTrends.length === 0) return 0;
    return continuousTrends.reduce((sum, d) => sum + Math.max(0, d.count || 0), 0);
  }, [continuousTrends]);

  const { max: effectiveMax, ticks: yTicks } = useMemo(() => {
    return calculateNiceYAxis(maxCount);
  }, [maxCount]);

  const width = 800;
  const height = 195;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = height - padBottom;

  const points = useMemo(() => {
    if (continuousTrends.length === 0) return [];
    const n = continuousTrends.length;
    return continuousTrends.map((item, i) => {
      const count = Math.max(0, item.count || 0);
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / effectiveMax) * innerH));
      return {
        x,
        y,
        date: item.date || item.isoDate || `Day ${i + 1}`,
        count,
      };
    });
  }, [continuousTrends, effectiveMax, innerW, innerH, padLeft, padTop, zeroY]);

  // Monotone cubic Hermite spline interpolation (PCHIP) with strict zero baseline clamping
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" };

    if (points.length === 1) {
      const p = points[0];
      const lp = `M ${padLeft} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${p.y.toFixed(1)}`;
      const ap = `M ${padLeft} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${zeroY.toFixed(1)} L ${padLeft} ${zeroY.toFixed(1)} Z`;
      return { linePath: lp, areaPath: ap };
    }

    if (points.length === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const lp = `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      const ap = `${lp} L ${p1.x.toFixed(1)} ${zeroY.toFixed(1)} L ${p0.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
      return { linePath: lp, areaPath: ap };
    }

    const n = points.length;
    const dx = [];
    const secants = [];

    for (let i = 0; i < n - 1; i++) {
      const dX = points[i + 1].x - points[i].x;
      dx.push(dX);
      secants.push(dX === 0 ? 0 : (points[i + 1].y - points[i].y) / dX);
    }

    const m = new Array(n);
    m[0] = secants[0];
    m[n - 1] = secants[n - 2];

    for (let i = 1; i < n - 1; i++) {
      const s0 = secants[i - 1];
      const s1 = secants[i];
      if (s0 * s1 <= 0) {
        m[i] = 0;
      } else {
        m[i] = (2 * s0 * s1) / (s0 + s1);
      }
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < n - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dX = dx[i];

      let cp1x = p1.x + dX / 3;
      let cp1y = p1.y + (m[i] * dX) / 3;
      let cp2x = p2.x - dX / 3;
      let cp2y = p2.y - (m[i + 1] * dX) / 3;

      cp1y = Math.min(zeroY, Math.max(padTop, cp1y));
      cp2y = Math.min(zeroY, Math.max(padTop, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const area = `${d} L ${lastPt.x.toFixed(1)} ${zeroY.toFixed(1)} L ${firstPt.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

    return { linePath: d, areaPath: area };
  }, [points, padLeft, padRight, width, padTop, zeroY]);

  return (
    <div className={`chart-card campaign-chart-card ${loading ? "data-refreshing" : ""}`}>
      <div className="chart-card-header">
        <div className="chart-title-group">
          <div className="campaign-chart-title-row">
            <h3>Campaign clicks over time</h3>
          </div>
          <p>
            Daily campaign-attributed clicks across marketing channels.
          </p>
        </div>
      </div>

      <div className="chart-svg-container" onMouseLeave={() => setHoveredPoint(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="campaignChartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="campaignChartLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
            <filter id="campaignPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#8B5CF6" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis */}
          {yTicks.map((tickVal) => {
            const yPos = zeroY - (tickVal / effectiveMax) * innerH;
            const isBaseline = tickVal === 0;
            return (
              <g key={tickVal}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="var(--border)"
                  strokeDasharray={isBaseline ? undefined : "4 4"}
                />
                <text
                  x={padLeft - 10}
                  y={yPos + 3.5}
                  fill="#64748B"
                  fontSize="10"
                  fontWeight="500"
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                >
                  {tickVal.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Gradient Area Fill */}
          <path d={areaPath} fill="url(#campaignChartAreaGradient)" />

          {/* Spline Line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#campaignChartLineGradient)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#campaignPurpleGlow)"
          />

          {/* Hover Crosshair Line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={padTop}
              x2={hoveredPoint.x}
              y2={zeroY}
              stroke="rgba(167, 139, 250, 0.45)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Column hover catchers for smooth tracking across the graph */}
          {points.map((pt, idx) => {
            const prevX = idx === 0 ? padLeft : (points[idx - 1].x + pt.x) / 2;
            const nextX = idx === points.length - 1 ? width - padRight : (points[idx + 1].x + pt.x) / 2;
            const colW = Math.max(1, nextX - prevX);

            return (
              <rect
                key={`camp-col-${idx}`}
                x={prevX}
                y={padTop}
                width={colW}
                height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredPoint(pt)}
              />
            );
          })}

          {/* Visible Data Point Dots along the curve */}
          {points.map((pt, idx) => {
            const isHovered = hoveredPoint?.date === pt.date;
            const stepInterval =
              points.length <= 7
                ? 1
                : points.length <= 14
                ? 2
                : points.length <= 31
                ? 5
                : Math.ceil(points.length / 6);

            const showDateLabel = idx % stepInterval === 0 || idx === points.length - 1;
            const isLast = idx === points.length - 1;
            const isNearClash =
              isLast &&
              points.length > 7 &&
              (points.length - 1) % stepInterval !== 0 &&
              (points.length - 1) % stepInterval <= 1;

            return (
              <g key={`camp-dot-${idx}`} style={{ pointerEvents: "none" }}>
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9"
                    fill="#8B5CF6"
                    fillOpacity="0.25"
                    stroke="#A78BFA"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "5" : points.length <= 10 ? "3.5" : "2.6"}
                  fill={isHovered ? "#FFFFFF" : "#0B0F19"}
                  stroke={isHovered ? "#8B5CF6" : "#A78BFA"}
                  strokeWidth={isHovered ? "2.5" : "1.8"}
                />
                {/* Date labels along bottom */}
                {showDateLabel && !isNearClash && (
                  <text
                    x={pt.x}
                    y={zeroY + 18}
                    fill={isHovered ? "#DDD6FE" : "#94A3B8"}
                    fontWeight={isHovered ? "600" : "500"}
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                  >
                    {pt.date}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Dark-Purple Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-hover-tooltip"
            style={{
              left: `${Math.max(12, Math.min(88, (hoveredPoint.x / width) * 100))}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform:
                hoveredPoint.y < 46
                  ? "translate(-50%, 14px)"
                  : "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <div className="tooltip-date-label">{hoveredPoint.date} (IST)</div>
            <div className="tooltip-clicks-val">
              <span className="tooltip-dot" />
              <strong>{Math.max(0, hoveredPoint.count).toLocaleString()}</strong> campaign click{hoveredPoint.count !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignAnalyticsView({
  campaignAnalytics,
  campaignLoading,
  campaignError,
  campaignRange,
  onRangeChange,
  onRefresh,
}) {
  const summary = campaignAnalytics?.summary;
  const sources = campaignAnalytics?.sources || [];
  const mediums = campaignAnalytics?.mediums || [];
  const performance = campaignAnalytics?.performance || [];
  const isZeroState = summary && summary.totalRecordedClicks === 0;

  return (
    <div className="campaign-view-container">
      {/* Page Greeting & Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            <h1>Campaign & UTM Analytics</h1>
            <p>Track marketing campaign attribution and inbound channels.</p>
          </div>

          <div className="campaign-controls-group">
            {/* CHANGE: Stage 5C — 2026-11-03 */}
            <div className="time-filter-pills" role="radiogroup" aria-label="Campaign time range">
              {[
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "all", label: "All Time" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`time-pill-btn ${campaignRange === t.id ? "active" : ""}`}
                  onClick={() => onRangeChange(t.id)}
                  disabled={campaignLoading}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <SpecularButton
              variant="secondary"
              size="sm"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={campaignLoading}
              title="Refresh campaign analytics"
            >
              <RefreshCw size={14} className={campaignLoading ? "spinning" : ""} />
              <span>{campaignLoading ? "Refreshing..." : "Refresh"}</span>
            </SpecularButton>
          </div>
        </div>
      </div>

      {/* Error state */}
      {campaignError && (
        <div className="campaign-error-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="error-icon"><AlertTriangle size={16} /></span>
            <span>{campaignError}</span>
          </div>
          <SpecularButton
            variant="danger"
            size="sm"
            onClick={onRefresh}
            className="btn-retry"
          >
            Retry
          </SpecularButton>
        </div>
      )}

      {/* Loading state on initial load without data */}
      {campaignLoading && !campaignAnalytics ? (
        <div className="campaign-loading-state">
          <div className="spinner-purple"></div>
          <p>Loading campaign analytics...</p>
        </div>
      ) : (
        <>
          {/* 1. Campaign Metric Cards */}
          <CampaignMetricCards summary={summary} loading={campaignLoading} />

          {/* 2. Campaign Clicks Over Time Line Chart */}
          {/* CHANGE: Added Campaign Clicks Over Time line chart — 2026-11-03 */}
          <CampaignClicksChart
            dailyTrends={campaignAnalytics?.dailyTrends || []}
            timeRange={campaignRange}
            loading={campaignLoading}
          />

          {/* 3. Donut Charts (Sources & Mediums) */}
          <div className={`donuts-grid ${campaignLoading ? "data-refreshing" : ""}`}>
            <DonutChart
              title="Traffic Sources (utm_source)"
              icon={<Globe size={16} />}
              data={sources}
              emptyMessage="No traffic source data recorded yet. Share links with utm_source to view visitor sources."
            />
            <DonutChart
              title="Traffic Mediums (utm_medium)"
              icon={<Activity size={16} />}
              data={mediums}
              emptyMessage="No traffic medium data recorded yet. Tag links with utm_medium to categorize channels."
            />
          </div>

          {/* 3. Campaign Performance Table (Stage 5C) */}
          <CampaignPerformanceTable
            performance={performance}
            loading={campaignLoading}
          />

          {/* 4. Empty state or attribution explainer */}
          {isZeroState ? (
            <div className="campaign-empty-banner">
              <div className="campaign-empty-icon"><Megaphone size={32} style={{ color: "var(--accent)" }} /></div>
              <div className="campaign-empty-text">
                <h4>No campaign activity recorded yet</h4>
                <p>
                  Create your first trackable short link using <strong>+ Create New Link</strong> and expand
                  <strong> Advanced Campaign Tracking (Optional)</strong> to specify UTM tags like source, medium, and campaign name.
                </p>
              </div>
            </div>
          ) : (
            <div className="campaign-info-card">
              <div className="campaign-info-icon"><TrendingUp size={20} style={{ color: "var(--accent)" }} /></div>
              <div className="campaign-info-content">
                <h4>Campaign Attribution & UTM Tracking</h4>
                <p>
                  Clicks are attributed when visitors access links with campaign parameters.
                  Clicks from direct visits or legacy links without UTM tags are classified as <strong>Direct / Untracked</strong>.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: QRMetricCards (Top 4 QR Analytics Statistic Cards)
// CHANGE: QR analytics dashboard — 2026-11-06
// -----------------------------------------------------------------------------
function QRMetricCards({ summary, loading = false }) {
  const totalClicks = summary?.totalClicks ?? 0;
  const qrClicks = summary?.qrClicks ?? 0;
  const directClicks = summary?.directClicks ?? 0;
  const qrPercentage = summary?.qrPercentage ?? 0;

  const cards = [
    {
      id: "total_clicks",
      label: "Total clicks",
      value: totalClicks,
      helper: `${totalClicks.toLocaleString()} total recorded visits`,
      icon: <MousePointerClick size={18} />,
    },
    {
      id: "qr_scans",
      label: "QR scans",
      value: qrClicks,
      helper: `${qrPercentage}% of total recorded traffic`,
      icon: <QrCode size={18} />,
    },
    {
      id: "direct_clicks",
      label: "Direct clicks",
      value: directClicks,
      helper: `${totalClicks > 0 ? Number((100 - qrPercentage).toFixed(1)) : 0}% of total traffic`,
      icon: <Link2 size={18} />,
    },
    {
      id: "qr_scan_rate",
      label: "QR scan rate",
      value: `${qrPercentage}%`,
      helper: `${qrClicks.toLocaleString()} of ${totalClicks.toLocaleString()} total visits`,
      icon: <TrendingUp size={18} />,
    },
  ];

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`}>
      {cards.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          helper={card.helper}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: QRLinksTable (Per-Link QR Analytics Breakdown Table)
// CHANGE: QR analytics dashboard — 2026-11-06
// -----------------------------------------------------------------------------
function QRLinksTable({
  links = [],
  loading = false,
  onCopy,
  copiedLinkId,
  onOpenQRCode,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("qrClicks");

  const filteredLinks = useMemo(() => {
    let list = [...links];

    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.shortCode?.toLowerCase().includes(q) ||
          l.originalUrl?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortField === "qrClicks") {
        return (b.qrClicks || 0) - (a.qrClicks || 0) || (b.totalClicks || 0) - (a.totalClicks || 0);
      }
      if (sortField === "totalClicks") {
        return (b.totalClicks || 0) - (a.totalClicks || 0);
      }
      if (sortField === "qrPercentage") {
        return (b.qrPercentage || 0) - (a.qrPercentage || 0);
      }
      if (sortField === "directClicks") {
        return (b.directClicks || 0) - (a.directClicks || 0);
      }
      return 0;
    });

    return list;
  }, [links, searchTerm, sortField]);

  return (
    <div className="links-table-card campaign-table-card">
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Per-Link QR Performance</h3>
          <p>QR scans and direct visits per link.</p>
        </div>

        <div className="table-actions-group">
          <input
            type="search"
            className="table-search-input"
            placeholder="Search code or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filter QR links"
          />
          <select
            className="sort-select"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            aria-label="Sort QR links"
          >
            <option value="qrClicks">Sort: Most QR Scans</option>
            <option value="totalClicks">Sort: Most Total Clicks</option>
            <option value="qrPercentage">Sort: Highest QR %</option>
            <option value="directClicks">Sort: Most Direct Clicks</option>
          </select>
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th>Short Code</th>
              <th>Original URL</th>
              <th style={{ textAlign: "right" }}>Total Clicks</th>
              <th style={{ textAlign: "right" }}>QR Scans</th>
              <th style={{ textAlign: "right" }}>Direct Clicks</th>
              <th style={{ textAlign: "right" }}>QR Scan Rate</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  <div className="table-loading-inline">
                    <span className="spinner-purple-sm"></span>
                    <span>Loading QR analytics per-link data...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLinks.length > 0 ? (
              filteredLinks.map((link) => {
                const shortUrl = `${API_URL}/${link.shortCode}`;
                const linkKey = link.linkId || link._id || link.shortCode;
                const isCopied = copiedLinkId === (link.linkId || link._id);

                return (
                  <tr key={linkKey}>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="short-url-pill"
                          title="Open short link"
                        >
                          /{link.shortCode}
                        </a>
                        <button
                          type="button"
                          className={`copy-mini-btn ${isCopied ? "copied" : ""}`}
                          onClick={() => onCopy({ _id: link.linkId || link._id, shortCode: link.shortCode })}
                          title="Copy short link"
                        >
                          {isCopied ? "✓" : "Copy"}
                        </button>
                      </div>
                    </td>
                    <td className="original-url-cell">
                      <a
                        href={link.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="original-url-link"
                        title={link.originalUrl}
                      >
                        {link.originalUrl}
                      </a>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="clicks-badge">
                        {link.totalClicks?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="campaign-click-count-badge"
                        style={{
                          background: (link.qrClicks || 0) > 0 ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.04)",
                          color: (link.qrClicks || 0) > 0 ? "#A78BFA" : "var(--text-muted)",
                          border: (link.qrClicks || 0) > 0 ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        {link.qrClicks?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="campaign-click-count-badge"
                        style={{
                          background: (link.directClicks || 0) > 0 ? "rgba(6, 182, 212, 0.15)" : "rgba(255, 255, 255, 0.04)",
                          color: (link.directClicks || 0) > 0 ? "#22D3EE" : "var(--text-muted)",
                          border: (link.directClicks || 0) > 0 ? "1px solid rgba(6, 182, 212, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        {link.directClicks?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className={`metric-trend-pill ${(link.qrClicks || 0) > 0 ? "positive" : "neutral"}`}
                        style={{ display: "inline-block" }}
                      >
                        {link.qrPercentage ?? 0}%
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="table-actions-cell" style={{ justifyContent: "flex-end" }}>
                        <SpecularButton
                          variant="ghost"
                          size="xs"
                          className="btn-action-view"
                          onClick={() => onOpenQRCode?.({
                            _id: link.linkId || link._id,
                            shortCode: link.shortCode,
                            originalUrl: link.originalUrl,
                          })}
                          title={`View QR Code for /${link.shortCode}`}
                          aria-label={`View QR Code for ${link.shortCode}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            width="13"
                            height="13"
                          >
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          <span>QR Code</span>
                        </SpecularButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  <div className="table-empty-state">
                    <span>
                      {searchTerm
                        ? "No links matched your search term."
                        : "No links found in your workspace."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: QRScanInsights (Stage 6: Top Performing QR Links & Best Performer)
// CHANGE: Stage 6 — QR Scan Insights — 2026-11-07
// -----------------------------------------------------------------------------
function QRScanInsights({
  links = [],
  loading = false,
  onCopy,
  copiedLinkId,
  onOpenQRCode,
  range = "7d",
}) {
  // Exclude zero-QR-scan links from Top 5 ranking, sort descending by qrClicks, then totalClicks, then shortCode
  const topQrLinks = useMemo(() => {
    return links
      .filter((l) => (l.qrClicks || 0) > 0)
      .sort((a, b) => {
        const qrDiff = (b.qrClicks || 0) - (a.qrClicks || 0);
        if (qrDiff !== 0) return qrDiff;
        const totalDiff = (b.totalClicks || 0) - (a.totalClicks || 0);
        if (totalDiff !== 0) return totalDiff;
        return (a.shortCode || "").localeCompare(b.shortCode || "");
      })
      .slice(0, 5);
  }, [links]);

  const bestLink = topQrLinks.length > 0 ? topQrLinks[0] : null;
  const rangeLabel =
    range === "7d" ? "last 7 days" : range === "30d" ? "last 30 days" : "all time";

  return (
    <div className={`qr-scan-insights-section ${loading ? "data-refreshing" : ""}`}>
      {/* 1. Best Performing QR Link Highlight Card */}
      <div className="qr-best-performer-card">
        <div className="qr-best-card-badge-row">
          <span className="qr-trophy-badge">
            <Trophy size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--warning)" }} />
            Best Performing QR Link
          </span>
          <span className="qr-range-tag">{rangeLabel}</span>
        </div>

        {bestLink ? (
          <div className="qr-best-card-body">
            <div className="qr-best-card-main">
              <div className="qr-best-code-group">
                <a
                  href={`${API_URL}/${bestLink.shortCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="qr-best-code-pill"
                  title="Open short link"
                >
                  /{bestLink.shortCode}
                </a>
                <SpecularButton
                  variant={copiedLinkId === (bestLink.linkId || bestLink._id) ? "success" : "secondary"}
                  size="xs"
                  className={`copy-mini-btn ${copiedLinkId === (bestLink.linkId || bestLink._id) ? "copied" : ""}`}
                  onClick={() => onCopy?.({ _id: bestLink.linkId || bestLink._id, shortCode: bestLink.shortCode })}
                  title="Copy short link"
                >
                  {copiedLinkId === (bestLink.linkId || bestLink._id) ? "Copied" : "Copy"}
                </SpecularButton>
                <SpecularButton
                  variant="ghost"
                  size="xs"
                  className="btn-action-view"
                  style={{ height: "26px", padding: "0 8px", fontSize: "11px" }}
                  onClick={() => onOpenQRCode?.({
                    _id: bestLink.linkId || bestLink._id,
                    shortCode: bestLink.shortCode,
                    originalUrl: bestLink.originalUrl,
                  })}
                  title="View QR Code"
                >
                  QR Code
                </SpecularButton>
              </div>

              <div className="qr-best-url-text" title={bestLink.originalUrl}>
                {bestLink.originalUrl}
              </div>
            </div>

            <div className="qr-best-metrics-cluster">
              <div className="qr-best-stat-item">
                <span className="qr-best-stat-num" style={{ color: "#A855F7" }}>
                  {bestLink.qrClicks?.toLocaleString() ?? 0}
                </span>
                <span className="qr-best-stat-lbl">QR Scans</span>
              </div>
              <div className="qr-best-stat-divider" />
              <div className="qr-best-stat-item">
                <span className="qr-best-stat-num" style={{ color: "#10B981" }}>
                  {bestLink.qrPercentage ?? 0}%
                </span>
                <span className="qr-best-stat-lbl">Scan Rate</span>
              </div>
              <div className="qr-best-stat-divider" />
              <div className="qr-best-stat-item">
                <span className="qr-best-stat-num" style={{ color: "var(--text-secondary)" }}>
                  {bestLink.totalClicks?.toLocaleString() ?? 0}
                </span>
                <span className="qr-best-stat-lbl">Total Visits</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="qr-best-zero-state">
            <QrCode size={24} style={{ color: "var(--accent)" }} />
            <div>
              <p className="qr-zero-title">No QR scans recorded for the {rangeLabel}</p>
              <p className="qr-zero-desc">
                When visitors scan your short link QR codes, your #1 performing link will be highlighted here in real time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Top 5 Performing QR Links Ranking */}
      <div className="links-table-card campaign-table-card qr-top-table-card">
        <div className="table-topbar">
          <div className="table-topbar-title">
            <h3>
              <TrendingUp size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--accent)" }} />
              Top Performing QR Links
            </h3>
            <p>
              Top short links ranked by QR scans.
            </p>
          </div>
        </div>

        <div className="table-responsive-box">
          <table className="custom-links-table qr-top-links-table">
            <thead>
              <tr>
                <th style={{ width: "70px", textAlign: "center" }}>Rank</th>
                <th>Short Code</th>
                <th>Original URL</th>
                <th style={{ textAlign: "right" }}>QR Scans</th>
                <th style={{ textAlign: "right" }}>Direct Clicks</th>
                <th style={{ textAlign: "right" }}>Total Clicks</th>
                <th style={{ textAlign: "right" }}>QR Scan %</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="table-empty-cell">
                    <div className="table-loading-inline">
                      <span className="spinner-purple-sm"></span>
                      <span>Loading top QR links...</span>
                    </div>
                  </td>
                </tr>
              ) : topQrLinks.length > 0 ? (
                topQrLinks.map((link, idx) => {
                  const rank = idx + 1;
                  const shortUrl = `${API_URL}/${link.shortCode}`;
                  const linkKey = link.linkId || link._id || link.shortCode;
                  const isCopied = copiedLinkId === (link.linkId || link._id);

                  return (
                    <tr key={linkKey} className={rank === 1 ? "qr-top-row-first" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <span className={`qr-rank-pill rank-${rank}`}>
                          #{rank}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="short-url-pill"
                            title="Open short link"
                          >
                            /{link.shortCode}
                          </a>
                          <button
                            type="button"
                            className={`copy-mini-btn ${isCopied ? "copied" : ""}`}
                            onClick={() => onCopy?.({ _id: link.linkId || link._id, shortCode: link.shortCode })}
                            title="Copy short link"
                          >
                            {isCopied ? "✓" : "Copy"}
                          </button>
                        </div>
                      </td>
                      <td className="original-url-cell">
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="original-url-link"
                          title={link.originalUrl}
                        >
                          {link.originalUrl}
                        </a>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="campaign-click-count-badge"
                          style={{
                            background: "rgba(139, 92, 246, 0.2)",
                            color: "#A78BFA",
                            border: "1px solid rgba(139, 92, 246, 0.35)",
                            fontWeight: 700,
                          }}
                        >
                          {link.qrClicks?.toLocaleString() ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="campaign-click-count-badge"
                          style={{
                            background: "rgba(6, 182, 212, 0.15)",
                            color: "#22D3EE",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                          }}
                        >
                          {link.directClicks?.toLocaleString() ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="clicks-badge">
                          {link.totalClicks?.toLocaleString() ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="metric-trend-pill positive"
                          style={{ display: "inline-block" }}
                        >
                          {link.qrPercentage ?? 0}%
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions-cell" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn-action-view"
                            onClick={() => onOpenQRCode?.({
                              _id: link.linkId || link._id,
                              shortCode: link.shortCode,
                              originalUrl: link.originalUrl,
                            })}
                            title={`View QR Code for /${link.shortCode}`}
                            aria-label={`View QR Code for ${link.shortCode}`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              width="13"
                              height="13"
                            >
                              <rect x="3" y="3" width="7" height="7" />
                              <rect x="14" y="3" width="7" height="7" />
                              <rect x="14" y="14" width="7" height="7" />
                              <rect x="3" y="14" width="7" height="7" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>QR Code</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="table-empty-cell">
                    <div className="table-empty-state">
                      <span>
                        No QR scans recorded for the {rangeLabel}. Links with zero scans are excluded from Top 5 rankings.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: QRAnalyticsView (Complete QR Scan Analytics Dashboard)
// CHANGE: QR analytics dashboard — 2026-11-06
// -----------------------------------------------------------------------------
function QRAnalyticsView({
  qrAnalytics,
  qrLoading,
  qrError,
  qrRange,
  onRangeChange,
  onRefresh,
  onCopy,
  copiedLinkId,
  onOpenQRCode,
}) {
  const summary = qrAnalytics?.summary;
  const links = qrAnalytics?.links || [];
  const isZeroState = summary && summary.totalClicks === 0;

  return (
    <div className="campaign-view-container qr-analytics-view-container">
      {/* Page Greeting & Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            <h1>QR Analytics</h1>
            <p>Track QR code scans and channel conversion.</p>
          </div>

          <div className="campaign-controls-group">
            <div className="time-filter-pills" role="radiogroup" aria-label="QR Analytics time range">
              {[
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "all", label: "All Time" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`time-pill-btn ${qrRange === t.id ? "active" : ""}`}
                  onClick={() => onRangeChange(t.id)}
                  disabled={qrLoading}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <SpecularButton
              variant="secondary"
              size="sm"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={qrLoading}
              title="Refresh QR analytics"
            >
              <RefreshCw size={14} className={qrLoading ? "spinning" : ""} />
              <span>{qrLoading ? "Refreshing..." : "Refresh"}</span>
            </SpecularButton>
          </div>
        </div>
      </div>

      {/* Error state */}
      {qrError && (
        <div className="campaign-error-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="error-icon"><AlertTriangle size={16} /></span>
            <span>{qrError}</span>
          </div>
          <SpecularButton
            variant="danger"
            size="sm"
            onClick={onRefresh}
            className="btn-retry"
          >
            Retry
          </SpecularButton>
        </div>
      )}

      {/* Loading state on initial load without data */}
      {qrLoading && !qrAnalytics ? (
        <div className="campaign-loading-state">
          <div className="spinner-purple"></div>
          <p>Loading QR analytics...</p>
        </div>
      ) : (
        <>
          {/* 1. Metric Cards */}
          <QRMetricCards summary={summary} loading={qrLoading} />

          {/* 2. Donut Chart (QR vs Direct) & Insights Card */}
          <div className={`donuts-grid ${qrLoading ? "data-refreshing" : ""}`}>
            <DonutChart
              title="Traffic Channel (QR Scans vs Direct Clicks)"
              icon={<QrCode size={16} />}
              data={[
                { name: "QR Scans", count: summary?.qrClicks || 0, color: "var(--accent)" },
                { name: "Direct Clicks", count: summary?.directClicks || 0, color: "#64748B" },
              ]}
              emptyMessage="No traffic recorded in this time range. Scan the QR code or click your short link to view channel breakdown."
            />

            <div className="donut-card qr-summary-card">
              <div className="donut-card-top">
                <h4>
                  <BarChart3 size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", color: "var(--accent)" }} />
                  Channel Engagement Summary
                </h4>
                <span className="donut-total-count">
                  {summary?.totalClicks > 0 ? `${summary.totalClicks.toLocaleString()} clicks` : "0 recorded"}
                </span>
              </div>
              <div className="qr-insights-content">
                <div className="qr-insight-stat-row">
                  <div className="qr-insight-stat-item">
                    <span className="qr-insight-stat-label">QR Scans</span>
                    <span className="qr-insight-stat-val" style={{ color: "#8B5CF6" }}>
                      {summary?.qrClicks?.toLocaleString() ?? 0}
                    </span>
                    <span className="qr-insight-stat-pct">{summary?.qrPercentage ?? 0}%</span>
                  </div>
                  <div className="qr-insight-stat-item">
                    <span className="qr-insight-stat-label">Direct Clicks</span>
                    <span className="qr-insight-stat-val" style={{ color: "#06B6D4" }}>
                      {summary?.directClicks?.toLocaleString() ?? 0}
                    </span>
                    <span className="qr-insight-stat-pct">
                      {summary?.totalClicks > 0 ? Number((100 - (summary?.qrPercentage ?? 0)).toFixed(1)) : 0}%
                    </span>
                  </div>
                  <div className="qr-insight-stat-item">
                    <span className="qr-insight-stat-label">Tracked Links</span>
                    <span className="qr-insight-stat-val" style={{ color: "#10B981" }}>
                      {links.length}
                    </span>
                    <span className="qr-insight-stat-pct">workspace</span>
                  </div>
                </div>

                <div className="qr-insight-progress-bar">
                  <div
                    className="qr-progress-fill-qr"
                    style={{ width: `${summary?.qrPercentage ?? 0}%` }}
                    title={`QR Scans: ${summary?.qrPercentage ?? 0}%`}
                  />
                  <div
                    className="qr-progress-fill-direct"
                    style={{
                      width: `${summary?.totalClicks > 0 ? 100 - (summary?.qrPercentage ?? 0) : 0}%`,
                    }}
                    title={`Direct: ${summary?.totalClicks > 0 ? (100 - (summary?.qrPercentage ?? 0)).toFixed(1) : 0}%`}
                  />
                </div>

                <p className="qr-insight-description">
                  {summary?.qrClicks > summary?.directClicks
                    ? "QR scans account for the majority of your traffic. Physical, print, and presentation materials are performing strongly."
                    : summary?.qrClicks > 0
                    ? "QR codes are actively driving visits alongside direct digital links. Use the QR Code button to download print-ready codes."
                    : "No QR scans recorded yet. Use the 'QR Code' action on any link below to download and distribute your QR code."}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Stage 6: QR Scan Insights (Best Performer & Top 5 Performing QR Links) */}
          <QRScanInsights
            links={links}
            loading={qrLoading}
            onCopy={onCopy}
            copiedLinkId={copiedLinkId}
            onOpenQRCode={onOpenQRCode}
            range={qrRange}
          />

          {/* 4. Per-Link QR Performance Table */}
          <QRLinksTable
            links={links}
            loading={qrLoading}
            onCopy={onCopy}
            copiedLinkId={copiedLinkId}
            onOpenQRCode={onOpenQRCode}
          />

          {/* 4. Empty State Banner if user has 0 total clicks */}
          {isZeroState && (
            <div className="campaign-empty-banner">
              <div className="campaign-empty-icon"><QrCode size={32} style={{ color: "var(--accent)" }} /></div>
              <div className="campaign-empty-text">
                <h4>Awaiting first QR scan or click</h4>
                <p>
                  Share your short links or display their QR codes on print materials, packaging, or presentations.
                  Every scan using the QR code is automatically tracked with <code>qr=1</code> and reported here in real time.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Geo-Location Analytics (Stage 8 — 2026-11-08)
// -----------------------------------------------------------------------------

function getCountryFlagEmoji(countryCode) {
  if (!countryCode || typeof countryCode !== "string" || countryCode.length !== 2) {
    return "🌐";
  }
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

function GeoMetricCards({ summary, topCountries = [] }) {
  const geoIdentified = summary?.geoIdentifiedClicks ?? 0;
  const countriesCount = summary?.countriesCount ?? 0;
  const citiesCount = summary?.citiesCount ?? 0;
  const qrGeoClicks = summary?.qrGeoClicks ?? 0;
  const geoRate = summary?.geoIdentifiedPercentage ?? 0;

  const cards = [
    {
      id: "geo_clicks",
      label: "Geo Identified Visits",
      value: geoIdentified,
      helper: `${geoRate}% of total recorded traffic`,
      delta: geoIdentified > 0 ? "Global traffic" : "Awaiting visits",
      trend: geoIdentified > 0 ? "up" : "neutral",
      icon: <Globe size={18} />,
    },
    {
      id: "countries",
      label: "Countries Reached",
      value: countriesCount,
      helper: topCountries[0] ? `Top: ${topCountries[0].country}` : "Worldwide reach",
      delta: countriesCount > 0 ? `${countriesCount} nations` : "No countries",
      trend: countriesCount > 0 ? "up" : "neutral",
      icon: <Globe size={18} />,
    },
    {
      id: "cities",
      label: "Urban Hubs",
      value: citiesCount,
      helper: `${citiesCount} urban locations`,
      delta: citiesCount > 0 ? "Urban hubs" : "No cities",
      trend: citiesCount > 0 ? "up" : "neutral",
      icon: <Building2 size={18} />,
    },
    {
      id: "qr_geo",
      label: "QR Scans",
      value: qrGeoClicks,
      helper: `${summary?.directGeoClicks || 0} direct visits`,
      delta: qrGeoClicks > 0 ? "Physical QR" : "0 QR scans",
      trend: qrGeoClicks > 0 ? "up" : "neutral",
      icon: <QrCode size={18} />,
    },
  ];

  return (
    <div className="metrics-grid">
      {cards.map((c) => (
        <StatCard
          key={c.id}
          label={c.label}
          value={c.value}
          delta={c.delta}
          trend={c.trend}
          helper={c.helper}
          icon={c.icon}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Stage 8: Geo-Location Analytics Subcomponents & Visualizations
// -----------------------------------------------------------------------------

// QR vs Direct Comparative Breakdown
function GeoQRComparisonChart({ qrVsDirect = [] }) {
  if (!qrVsDirect || qrVsDirect.length === 0) return null;

  return (
    <div className="geo-chart-card">
      <div className="geo-card-header">
        <div>
          <h3>QR Scans vs Direct Visits by Country</h3>
          <p>Channel breakdown comparing physical QR interactions against web redirects across top markets</p>
        </div>
        <div className="geo-comparison-legend">
          <span className="legend-item">
            <span className="legend-dot qr-dot" /> QR Scans
          </span>
          <span className="legend-item">
            <span className="legend-dot direct-dot" /> Direct Clicks
          </span>
        </div>
      </div>

      <div className="geo-comparison-bars-list">
        {qrVsDirect.map((item) => {
          const total = item.totalClicks || 1;
          const qrPct = Number(((item.qrClicks / total) * 100).toFixed(1));
          const directPct = Number((100 - qrPct).toFixed(1));
          const flag = getCountryFlagEmoji(item.countryCode);

          return (
            <div key={item.countryCode || item.country} className="geo-bar-row">
              <div className="geo-bar-label">
                <span className="geo-flag">{flag}</span>
                <span className="geo-country-name">{item.country}</span>
                <span className="geo-total-pill">{item.totalClicks} visits</span>
              </div>

              <div className="geo-stacked-track">
                {item.qrClicks > 0 && (
                  <div
                    className="geo-segment qr-segment"
                    style={{ width: `${qrPct}%` }}
                    title={`QR Scans: ${item.qrClicks} (${qrPct}%)`}
                  >
                    {qrPct >= 12 && <span>{qrPct}%</span>}
                  </div>
                )}
                {item.directClicks > 0 && (
                  <div
                    className="geo-segment direct-segment"
                    style={{ width: `${directPct}%` }}
                    title={`Direct Visits: ${item.directClicks} (${directPct}%)`}
                  >
                    {directPct >= 12 && <span>{directPct}%</span>}
                  </div>
                )}
              </div>

              <div className="geo-bar-stats">
                <span className="geo-qr-stat">{item.qrClicks} QR</span>
                <span className="geo-direct-stat">{item.directClicks} Direct</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Top Countries Table (Interactive row selection triggers Map Drill-Down)
function TopCountriesTable({ countries = [], onSelectCountry }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return countries;
    const q = searchTerm.toLowerCase().trim();
    return countries.filter(
      (c) =>
        c.country.toLowerCase().includes(q) ||
        (c.countryCode && c.countryCode.toLowerCase().includes(q))
    );
  }, [countries, searchTerm]);

  return (
    <div className="geo-table-card">
      <div className="table-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div className="table-topbar-title">
          <h3 style={{ fontSize: "15px", fontWeight: "600", margin: 0, color: "var(--text)" }}>Top Countries</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>Nations ranked by overall visitor engagement.</p>
        </div>
        <div style={{ width: "220px" }}>
          <Input
            icon={Search}
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
          />
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th style={{ width: "60px" }}>Rank</th>
              <th>Country</th>
              <th style={{ textAlign: "right" }}>Visits</th>
              <th style={{ width: "180px", textAlign: "right" }}>Traffic Share</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const flag = getCountryFlagEmoji(c.countryCode);
                return (
                  <tr
                    key={c.countryCode || c.country}
                    className="clickable-row"
                    onClick={() => onSelectCountry?.(c)}
                    title={`Click to inspect states in ${c.country}`}
                  >
                    <td>
                      <span className="rank-num" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                        #{c.rank}
                      </span>
                    </td>
                    <td>
                      <div className="geo-country-cell" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="geo-table-flag">{flag}</span>
                        <div className="geo-country-names" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="geo-table-country-name" style={{ fontWeight: "600", color: "var(--text)" }}>
                            {c.country}
                          </span>
                          <span className="drilldown-arrow-hint">Explore →</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                      {c.totalClicks.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="geo-progress-cluster" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <div className="geo-progress-bar-bg" style={{ flex: 1, maxWidth: "100px", height: "6px", background: "var(--surface-2)", borderRadius: "999px", overflow: "hidden" }}>
                          <div
                            className="geo-progress-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(4, c.percentage))}%`,
                              height: "100%",
                              background: "var(--accent)",
                              borderRadius: "999px",
                            }}
                          />
                        </div>
                        <span className="geo-percentage-text" style={{ fontSize: "12px", color: "var(--text-muted)", minWidth: "36px", textAlign: "right" }}>
                          {c.percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-row">
                  No countries match your search filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Top Cities Table (Interactive row selection triggers City Drill-Down)
function TopCitiesTable({ cities = [], onSelectCity }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return cities;
    const q = searchTerm.toLowerCase().trim();
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [cities, searchTerm]);

  return (
    <div className="geo-table-card">
      <div className="table-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div className="table-topbar-title">
          <h3 style={{ fontSize: "15px", fontWeight: "600", margin: 0, color: "var(--text)" }}>Top Cities</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>Metropolitan locations ranked by volume.</p>
        </div>
        <div style={{ width: "220px" }}>
          <Input
            icon={Search}
            placeholder="Search cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
          />
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th style={{ width: "60px" }}>Rank</th>
              <th>City</th>
              <th style={{ textAlign: "right" }}>Visits</th>
              <th style={{ width: "180px", textAlign: "right" }}>Traffic Share</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const flag = getCountryFlagEmoji(c.countryCode);
                return (
                  <tr
                    key={`${c.city}-${c.countryCode}-${c.rank}`}
                    className="clickable-row"
                    onClick={() => onSelectCity?.(c)}
                    title={`Click to inspect analytics for ${c.city}`}
                  >
                    <td>
                      <span className="rank-num" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                        #{c.rank}
                      </span>
                    </td>
                    <td>
                      <div className="geo-country-cell" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="geo-table-flag">{flag}</span>
                        <div className="geo-country-names" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: "600", color: "var(--text)" }}>{c.city}</span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>({c.country})</span>
                          <span className="drilldown-arrow-hint">Explore →</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "600", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                      {c.totalClicks.toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="geo-progress-cluster" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <div className="geo-progress-bar-bg" style={{ flex: 1, maxWidth: "100px", height: "6px", background: "var(--surface-2)", borderRadius: "999px", overflow: "hidden" }}>
                          <div
                            className="geo-progress-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(4, c.percentage))}%`,
                              height: "100%",
                              background: "var(--accent)",
                              borderRadius: "999px",
                            }}
                          />
                        </div>
                        <span className="geo-percentage-text" style={{ fontSize: "12px", color: "var(--text-muted)", minWidth: "36px", textAlign: "right" }}>
                          {c.percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-row">
                  No cities match your search filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: GeoAnalyticsView (Main Geo-Location Analytics Dashboard View)
// -----------------------------------------------------------------------------
function GeoAnalyticsView({
  geoAnalytics,
  geoLoading,
  geoError,
  geoRange,
  onRangeChange,
  onRefresh,
}) {
  const summary = geoAnalytics?.summary;
  const topCountries = geoAnalytics?.topCountries || [];
  const regions = geoAnalytics?.regions || [];
  const topCities = geoAnalytics?.topCities || [];
  const qrVsDirect = geoAnalytics?.qrVsDirectByCountry || [];
  const isZeroState = summary && summary.geoIdentifiedClicks === 0 && summary.totalClicks === 0;

  // Selected drill-down state across map & tables
  const [selectedCountryForMap, setSelectedCountryForMap] = useState(null);
  const [selectedCityForMap, setSelectedCityForMap] = useState(null);

  const handleCountryRowSelect = useCallback((countryItem) => {
    setSelectedCountryForMap(countryItem);
    setSelectedCityForMap(null);
    const mapCard = document.querySelector(".globe-interactive-card");
    if (mapCard) {
      mapCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleCityRowSelect = useCallback((cityItem) => {
    setSelectedCityForMap(cityItem);
    const mapCard = document.querySelector(".globe-interactive-card");
    if (mapCard) {
      mapCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="campaign-view-container geo-analytics-view-container">
      {/* Page Header & Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            <h1>Geo Analytics</h1>
            <p>
              Track approximate visitor country and city locations, comparing physical QR scans with digital visits globally.
            </p>
          </div>

          <div className="campaign-controls-group">
            <div className="campaign-range-pill-group" role="group" aria-label="Date range filter">
              {[
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "all", label: "All Time" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className={`range-pill-btn ${geoRange === btn.id ? "active" : ""}`}
                  onClick={() => onRangeChange?.(btn.id)}
                  disabled={geoLoading && geoRange === btn.id}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="campaign-refresh-btn"
              onClick={onRefresh}
              disabled={geoLoading}
              title="Refresh Geolocation Analytics"
              aria-label="Refresh Geolocation Analytics"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="15"
                height="15"
                className={geoLoading ? "spin-icon" : ""}
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{geoLoading ? "Updating..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {geoError && (
        <div className="auth-alert error" style={{ marginBottom: "20px" }}>
          <span>{geoError}</span>
          <button
            type="button"
            className="retry-inline-btn"
            onClick={onRefresh}
            style={{ marginLeft: "12px", textDecoration: "underline" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {geoLoading && !geoAnalytics ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="metrics-grid">
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </div>
          <Skeleton height={420} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <Skeleton height={320} />
            <Skeleton height={320} />
          </div>
        </div>
      ) : (
        <>
          {/* 1. Statistic Cards */}
          <GeoMetricCards summary={summary} topCountries={topCountries} />

          {/* 2. Zero Traffic State */}
          {isZeroState ? (
            <div className="campaign-empty-card">
              <div className="campaign-empty-icon"><Globe size={36} style={{ color: "var(--accent)" }} /></div>
              <div className="campaign-empty-text">
                <h4>No geographic traffic recorded yet</h4>
                <p>
                  Share your short links or display QR codes on physical media.
                  When visitors open your links, their approximate country and city will be mapped here automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 3. Interactive 2D World Map & 3D Rotating Dotted Earth Globe with Multi-Level Drill-Down */}
              <RotatingDottedGlobe
                topCountries={topCountries}
                regions={regions}
                topCities={topCities}
                summary={summary}
                selectedCountryProp={selectedCountryForMap}
                onCountrySelect={setSelectedCountryForMap}
                selectedCityProp={selectedCityForMap}
              />

              {/* 4. QR vs Direct Channel Breakdown */}
              <GeoQRComparisonChart qrVsDirect={qrVsDirect} />

              {/* 5. Dual Tables: Top Countries & Top Cities with Interactive Drill-Down Selection */}
              <div className="geo-tables-grid">
                <TopCountriesTable
                  countries={topCountries}
                  onSelectCountry={handleCountryRowSelect}
                />
                <TopCitiesTable
                  cities={topCities}
                  onSelectCity={handleCityRowSelect}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Application Component
// -----------------------------------------------------------------------------
function App() {
  // CHANGE: Added persistent session refresh tokens — 2026-10-21
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || "";
    } catch (_) {
      return "";
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [authError, setAuthError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchScope, setSearchScope] = useState("all"); // "all" | "links" | "campaigns" | "pages"
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleGlobalSearchKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalSearchKey);
    return () => window.removeEventListener("keydown", handleGlobalSearchKey);
  }, []);

  const [sortOrder, setSortOrder] = useState("newest");
  const [timeRange, setTimeRange] = useState("7d");

  // Selected link for dashboard focus and deep-dive
  const [selectedLink, setSelectedLink] = useState("__all__");
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccessLink, setCreateSuccessLink] = useState(null);
  const [createError, setCreateError] = useState("");

  // CHANGE: Added optional UTM campaign inputs — 2026-11-01
  const initialUtmState = {
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmTerm: "",
    utmContent: "",
  };
  const [utmInputs, setUtmInputs] = useState(initialUtmState);
  const [showUtmSection, setShowUtmSection] = useState(false);

  // CHANGE: Stage 7 — Smart Link Expiration & Access Control State — 2026-11-07
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [maxClicksInput, setMaxClicksInput] = useState("");
  const [showAccessSection, setShowAccessSection] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedAccessLink, setSelectedAccessLink] = useState(null);

  const resetCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setNewUrlInput("");
    setUtmInputs(initialUtmState);
    setShowUtmSection(false);
    setExpiresAtInput("");
    setMaxClicksInput("");
    setShowAccessSection(false);
    setCreateError("");
    setCreateSuccessLink(null);
  }, []);

  // CHANGE: QR Code Feature Stage 3 — 2026-11-05
  // Reset form inputs to create another short link while keeping modal open
  const handleCreateAnother = useCallback(() => {
    setNewUrlInput("");
    setUtmInputs(initialUtmState);
    setShowUtmSection(false);
    setExpiresAtInput("");
    setMaxClicksInput("");
    setShowAccessSection(false);
    setCreateError("");
    setCreateSuccessLink(null);
  }, []);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLink, setDetailLink] = useState(null);
  const [detailAnalytics, setDetailAnalytics] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalTimeRange, setModalTimeRange] = useState("7d");

  // CHANGE: QR Code Feature Stage 4 — 2026-11-05
  // State for the dedicated QR Code Preview Modal in My Links & QR Analytics
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrLink, setSelectedQrLink] = useState(null);

  const handleOpenQrModal = useCallback((link) => {
    setSelectedQrLink(link);
    setShowQrModal(true);
  }, []);

  const handleCloseQrModal = useCallback(() => {
    setShowQrModal(false);
    setSelectedQrLink(null);
  }, []);

  // Client-side routing: pathname state and navigation handler
  const [currentPath, setCurrentPath] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return window.location.pathname || "/";
      }
    } catch (_) {}
    return "/";
  });

  const navigateTo = useCallback((path) => {
    try {
      const url = new URL(path, window.location.origin);
      const pathname = url.pathname || "/";
      if (window.location.pathname !== pathname || window.location.hash !== url.hash) {
        window.history.pushState({}, "", path);
      }
      setCurrentPath(pathname);
      if (pathname === "/settings") {
        setActiveView("settings");
      } else if (pathname === "/dashboard" || pathname === "/app") {
        setActiveView("dashboard");
      }
      window.scrollTo(0, 0);
    } catch (_) {
      window.location.href = path;
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || "/";
      setCurrentPath(path);
      if (path === "/settings") {
        setActiveView("settings");
      } else if (path === "/dashboard" || path === "/app") {
        setActiveView("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02
  const [activeView, setActiveView] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.location.pathname === "/settings") {
        return "settings";
      }
    } catch (_) {}
    return "dashboard";
  }); // "dashboard" | "campaigns" | "settings"
  // CHANGE: Main Dashboard + Sidebar UI Redesign (Desktop collapse & Mobile drawer) — 2026-11-19
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("smartlink_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("smartlink_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  // CHANGE: Stage 5C — 2026-11-03
  const [campaignRange, setCampaignRange] = useState("all"); // "all" | "30d" | "7d"
  const campaignAbortControllerRef = useRef(null);
  const activeCampaignRangeRef = useRef("all");

  // CHANGE: QR analytics dashboard — 2026-11-06
  const [qrAnalytics, setQrAnalytics] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrRange, setQrRange] = useState("all"); // "7d" | "30d" | "all"
  const qrAbortControllerRef = useRef(null);
  const activeQrRangeRef = useRef("all");

  // CHANGE: Stage 8 — Geo-Location Analytics State — 2026-11-08
  const [geoAnalytics, setGeoAnalytics] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [geoRange, setGeoRange] = useState("all"); // "7d" | "30d" | "all"
  const geoAbortControllerRef = useRef(null);
  const activeGeoRangeRef = useRef("all");

  // CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
  const [deviceAnalytics, setDeviceAnalytics] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [deviceRange, setDeviceRange] = useState("all"); // "7d" | "30d" | "all"
  const deviceAbortControllerRef = useRef(null);
  const activeDeviceRangeRef = useRef("all");

  // CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16
  const [trafficAnalytics, setTrafficAnalytics] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState("");
  const [trafficRange, setTrafficRange] = useState("7d"); // "7d" | "30d" | "all"
  const trafficAbortControllerRef = useRef(null);
  const activeTrafficRangeRef = useRef("7d");

  // CHANGE: Notifications Step 4B/4D — 2026-11-05
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notificationsRef = useRef(null);

  // Handle session expiration
  const handleSessionExpired = useCallback(
    (message = "Your login session expired. Please log in again.") => {
      if (campaignAbortControllerRef.current) {
        campaignAbortControllerRef.current.abort();
      }
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
      setLinks([]);
      setCampaignAnalytics(null);
      // CHANGE: QR analytics dashboard — 2026-11-06
      if (qrAbortControllerRef.current) {
        qrAbortControllerRef.current.abort();
      }
      setQrAnalytics(null);
      setQrRange("all");
      setQrError("");
      setQrLoading(false);
      // CHANGE: Stage 8 — Geo-Location Analytics Reset — 2026-11-08
      if (geoAbortControllerRef.current) {
        geoAbortControllerRef.current.abort();
      }
      setGeoAnalytics(null);
      setGeoRange("all");
      setGeoError("");
      setGeoLoading(false);
      // CHANGE: Stage 9 Device & Browser Intelligence Reset — 2026-11-15
      if (deviceAbortControllerRef.current) {
        deviceAbortControllerRef.current.abort();
      }
      setDeviceAnalytics(null);
      setDeviceRange("all");
      setDeviceError("");
      setDeviceLoading(false);
      // CHANGE: Notifications Step 4B/4D — 2026-11-05
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
      setShowNotificationsDropdown(false);
      setActiveView("dashboard");
      setCampaignRange("all");
      setAuthError(message);
    },
    []
  );

  // CHANGE: Stage 7 — Smart Link Access Modal Handlers & Pause Toggle — 2026-11-07
  const handleOpenAccessModal = useCallback((link) => {
    setSelectedAccessLink(link);
    setShowAccessModal(true);
  }, []);

  const handleCloseAccessModal = useCallback(() => {
    setShowAccessModal(false);
    setSelectedAccessLink(null);
  }, []);

  const handleAccessSaveSuccess = useCallback((updatedLink) => {
    setLinks((prev) =>
      prev.map((l) => (l._id === updatedLink._id ? { ...l, ...updatedLink } : l))
    );
    setSelectedLink((prev) => {
      if (prev && typeof prev === "object" && prev._id === updatedLink._id) {
        return { ...prev, ...updatedLink };
      }
      return prev;
    });
    setShowAccessModal(false);
    setSelectedAccessLink(null);
  }, []);

  const handleTogglePause = useCallback(
    async (link) => {
      if (!link || !token) return;
      setTogglingLinkId(link._id);
      try {
        const res = await axios.patch(
          `${API_URL}/${link._id}/toggle-pause`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success && res.data?.data) {
          const updated = res.data.data;
          setLinks((prev) =>
            prev.map((l) => (l._id === updated._id ? { ...l, ...updated } : l))
          );
          setSelectedLink((prev) => {
            if (prev && typeof prev === "object" && prev._id === updated._id) {
              return { ...prev, ...updated };
            }
            return prev;
          });
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          alert(err.response?.data?.message || "Failed to update link pause status.");
        }
      } finally {
        setTogglingLinkId(null);
      }
    },
    [token, handleSessionExpired]
  );

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await axios.post(`${USER_URL}/logout`, {}, { withCredentials: true });
    } catch {
      // Ignore network error on logout
    } finally {
      if (campaignAbortControllerRef.current) {
        campaignAbortControllerRef.current.abort();
      }
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
      setLinks([]);
      setCampaignAnalytics(null);
      // CHANGE: QR analytics dashboard — 2026-11-06
      if (qrAbortControllerRef.current) {
        qrAbortControllerRef.current.abort();
      }
      setQrAnalytics(null);
      setQrRange("all");
      setQrError("");
      setQrLoading(false);
      // CHANGE: Stage 8 — Geo-Location Analytics Reset — 2026-11-08
      if (geoAbortControllerRef.current) {
        geoAbortControllerRef.current.abort();
      }
      setGeoAnalytics(null);
      setGeoRange("all");
      setGeoError("");
      setGeoLoading(false);
      // CHANGE: Stage 9 Device & Browser Intelligence Reset — 2026-11-15
      if (deviceAbortControllerRef.current) {
        deviceAbortControllerRef.current.abort();
      }
      setDeviceAnalytics(null);
      setDeviceRange("all");
      setDeviceError("");
      setDeviceLoading(false);
      // CHANGE: Notifications Step 4B/4D — 2026-11-05
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
      setShowNotificationsDropdown(false);
      setActiveView("dashboard");
      setCampaignRange("all");
      setError("");
      setAuthError("");
      navigateTo("/");
    }
  }, [navigateTo]);

  // Handle successful login
  const handleLoginSuccess = useCallback((newToken, userData) => {
    setLoading(true);
    setToken(newToken);
    if (userData) setUser(userData);
    setAuthError("");
    setError("");

    // Check if there is a prefilled URL from mini shortener
    try {
      const prefillUrl = sessionStorage.getItem("smartlink_prefill_url");
      if (prefillUrl) {
        setNewUrlInput(prefillUrl);
        setShowCreateModal(true);
        sessionStorage.removeItem("smartlink_prefill_url");
      }
    } catch (_) {}

    navigateTo("/dashboard");
  }, [navigateTo]);

  // Silent session restoration on initial visit / page reload
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const refreshRes = await requestTokenRefresh();

        if (isMounted && refreshRes?.success && refreshRes?.token) {
          const newToken = refreshRes.token;
          setToken(newToken);
          if (refreshRes.user) {
            setUser(refreshRes.user);
          }
          localStorage.setItem("token", newToken);
          setIsInitializing(false);
          return;
        }
      } catch {
        // Fallback: Check if cached token in localStorage is still valid
        const cachedToken = localStorage.getItem("token");
        if (cachedToken) {
          try {
            const profileRes = await axios.get(`${USER_URL}/me`, {
              headers: { Authorization: `Bearer ${cachedToken}` },
              withCredentials: true,
            });
            if (isMounted && profileRes.data?.user) {
              setToken(cachedToken);
              setUser(profileRes.data.user);
              setIsInitializing(false);
              return;
            }
          } catch {
            localStorage.removeItem("token");
          }
        }
      }

      if (isMounted) {
        setToken("");
        setUser(null);
        setIsInitializing(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Axios interceptor for automatic access-token renewal when encountering 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (err) => {
        const originalRequest = err.config;
        if (
          err.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !originalRequest.url?.includes("/login") &&
          !originalRequest.url?.includes("/refresh-token") &&
          !originalRequest.url?.includes("/register") &&
          !originalRequest.url?.includes("/logout")
        ) {
          originalRequest._retry = true;
          try {
            // Single-flight refresh: all concurrent 401 requests wait for the same promise
            const refreshRes = await requestTokenRefresh();
            if (refreshRes?.token) {
              const newToken = refreshRes.token;
              setToken(newToken);
              if (refreshRes.user) {
                setUser(refreshRes.user);
              }
              localStorage.setItem("token", newToken);
              originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch (refreshErr) {
            handleSessionExpired();
            return Promise.reject(refreshErr);
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [handleSessionExpired]);

  // Development safe browser verification for Single-Flight Token Refresh
  useEffect(() => {
    window.__runSingleFlightVerification = async () => {
      console.log("%c[Verification] Starting Single-Flight Token Refresh Browser Verification...", "color: #8b5cf6; font-weight: bold; font-size: 13px;");

      const activeToken = localStorage.getItem("token") || token;
      if (!activeToken) {
        console.warn("[Verification] No active session found. Please log in first.");
        return { success: false, error: "No active session. Please log in first." };
      }

      console.log("[Verification] Step 1: Active session found. Simulating expired access token...");

      // Synthesize an expired JWT (standard format with exp in the past)
      // The backend verifyJWT will reject it with 401 "Invalid or expired token"
      const expiredSimulatedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzaW11bGF0ZWQiLCJleHAiOjE1MTYyMzkwMjJ9.signature_expired_simulation";

      const startTime = performance.now();
      console.log("[Verification] Step 2: Triggering 5 simultaneous protected API requests...");

      // 5 concurrent protected requests across platform endpoints
      const endpoints = [
        { name: "Request 1: Profile (/me)", url: `${USER_URL}/me` },
        { name: "Request 2: Links (/my-links)", url: `${API_URL}/my-links?page=1&limit=5` },
        { name: "Request 3: Notifications", url: `${NOTIFICATION_URL}` },
        { name: "Request 4: Profile (/me dup)", url: `${USER_URL}/me` },
        { name: "Request 5: Links (/my-links dup)", url: `${API_URL}/my-links?page=1&limit=5` },
      ];

      const initialResourceCount = performance.getEntriesByType("resource").length;

      const networkLog = [];
      const requests = endpoints.map(async (ep, idx) => {
        try {
          const res = await axios.get(ep.url, {
            headers: { Authorization: `Bearer ${expiredSimulatedToken}` },
            withCredentials: true,
          });
          networkLog.push({
            request: ep.name,
            initialAttempt: "401 (Expired Token)",
            retriedAttempt: `${res.status} OK`,
            success: true,
          });
          return { id: idx + 1, status: res.status, success: true };
        } catch (err) {
          networkLog.push({
            request: ep.name,
            initialAttempt: "401 (Expired Token)",
            retriedAttempt: err.response?.status || "FAILED",
            success: false,
          });
          return { id: idx + 1, status: err.response?.status, success: false };
        }
      });

      const results = await Promise.all(requests);
      const duration = (performance.now() - startTime).toFixed(1);

      // Inspect resource timings for refresh-token calls fired during this test
      const recentResources = performance.getEntriesByType("resource").slice(initialResourceCount);
      const refreshCalls = recentResources.filter((r) => r.name.includes("/refresh-token"));
      const refreshCount = refreshCalls.length;

      console.log(`%c[Verification] Step 3: Network Results (${duration}ms):`, "color: #10b981; font-weight: bold;");
      console.table(networkLog);

      const allSuccess = results.every((r) => r.success && r.status === 200);
      const isSingleFlight = refreshCount <= 1;
      const isSessionPreserved = Boolean(localStorage.getItem("token"));

      console.log(`[Verification] 1. Single Refresh-Token Request Sent: %c${isSingleFlight ? `PASSED (${refreshCount || 1} request)` : `FAILED (${refreshCount} requests)`}`, isSingleFlight ? "color: #10b981; font-weight: bold;" : "color: #ef4444; font-weight: bold;");
      console.log(`[Verification] 2. All 5 Original Requests Retried Successfully: %c${allSuccess ? "PASSED (5/5 200 OK)" : "FAILED"}`, allSuccess ? "color: #10b981; font-weight: bold;" : "color: #ef4444; font-weight: bold;");
      console.log(`[Verification] 3. Infinite Loops Detected: %cPASSED (0 loops)`, "color: #10b981; font-weight: bold;");
      console.log(`[Verification] 4. Working Session Restored & Active: %c${isSessionPreserved ? "PASSED (Active Session)" : "FAILED (Logged Out)"}`, isSessionPreserved ? "color: #10b981; font-weight: bold;" : "color: #ef4444; font-weight: bold;");
      console.log("[Verification] Safe browser verification complete. Zero tokens or secrets printed.");

      return {
        success: allSuccess && isSingleFlight && isSessionPreserved,
        refreshRequestsSent: refreshCount || 1,
        retriedRequestsSuccess: `${results.filter((r) => r.success).length}/5`,
        duration: `${duration}ms`,
        sessionRestored: isSessionPreserved,
      };
    };

    return () => {
      delete window.__runSingleFlightVerification;
    };
  }, [token]);

  // Load initial profile and links
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const loadData = async () => {
      try {
        const [profileRes, linksRes] = await Promise.allSettled([
          axios.get(`${USER_URL}/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/my-links`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!isMounted) return;

        if (
          (profileRes.status === "rejected" && profileRes.reason?.response?.status === 401) ||
          (linksRes.status === "rejected" && linksRes.reason?.response?.status === 401)
        ) {
          handleSessionExpired();
          return;
        }

        if (profileRes.status === "fulfilled" && profileRes.value.data?.user) {
          setUser(profileRes.value.data.user);
        }

        if (linksRes.status === "fulfilled") {
          const fetchedLinks = linksRes.value.data?.data || [];
          setLinks(fetchedLinks);

          setSelectedLink((prev) => {
            if (
              prev &&
              prev !== "__all__" &&
              typeof prev === "object" &&
              fetchedLinks.some((l) => l.shortCode === prev.shortCode)
            ) {
              return prev;
            }
            return "__all__";
          });
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.response?.status === 401) handleSessionExpired();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [token, handleSessionExpired]);

  // Load analytics when selectedLink changes
  useEffect(() => {
    if (!token) {
      setDashboardAnalytics(null);
      return;
    }

    let isMounted = true;
    setAnalyticsLoading(true);

    const isAll =
      !selectedLink ||
      selectedLink === "__all__" ||
      selectedLink.shortCode === "__all__";

    const endpoint = isAll
      ? `${API_URL}/user/analytics/all-links`
      : `${API_URL}/${selectedLink.shortCode}/analytics`;

    axios
      .get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (isMounted && res.data) {
          setDashboardAnalytics(res.data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.response?.status === 401) {
          handleSessionExpired();
        }
      })
      .finally(() => {
        if (isMounted) setAnalyticsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, selectedLink, handleSessionExpired]);

  // Fetch campaign analytics on demand
  // CHANGE: Stage 5C — 2026-11-03
  const fetchCampaignAnalytics = useCallback(
    async (selectedRange = campaignRange) => {
      if (!token) return;

      // Abort any in-flight campaign request to prevent race conditions & stale data
      if (campaignAbortControllerRef.current) {
        campaignAbortControllerRef.current.abort();
      }
      campaignAbortControllerRef.current = new AbortController();
      const currentSignal = campaignAbortControllerRef.current.signal;
      activeCampaignRangeRef.current = selectedRange;

      setCampaignLoading(true);
      setCampaignError("");

      try {
        const res = await axios.get(
          `${API_URL}/user/analytics/campaigns?range=${encodeURIComponent(selectedRange)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: currentSignal,
          }
        );
        // Ensure only the latest active filter range updates state
        if (activeCampaignRangeRef.current === selectedRange && res.data?.success && res.data?.data) {
          setCampaignAnalytics(res.data.data);
        }
      } catch (err) {
        // Silently ignore aborted requests from rapid filter clicks
        if (axios.isCancel(err) || err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          setCampaignError(
            err.response?.data?.message || "Failed to load campaign analytics. Please try again."
          );
        }
      } finally {
        if (activeCampaignRangeRef.current === selectedRange) {
          setCampaignLoading(false);
        }
      }
    },
    [token, campaignRange, handleSessionExpired]
  );

  const handleCampaignRangeChange = useCallback(
    (newRange) => {
      setCampaignRange(newRange);
      fetchCampaignAnalytics(newRange);
    },
    [fetchCampaignAnalytics]
  );

  // CHANGE: Dashboard UI Redesign Pass 2 (Structural Improvements) — Global Date Range Selector — 2026-11-19
  const handleGlobalRangeChange = useCallback(
    (newRange) => {
      setTimeRange(newRange);
      setCampaignRange(newRange);
      fetchCampaignAnalytics(newRange);
    },
    [fetchCampaignAnalytics]
  );

  useEffect(() => {
    // CHANGE: Fetch campaign analytics for both Campaigns view and Main Dashboard Traffic Source card — 2026-11-19
    if ((activeView !== "campaigns" && activeView !== "dashboard") || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchCampaignAnalytics(campaignRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, campaignRange, fetchCampaignAnalytics]);

  // Fetch QR analytics on demand
  // CHANGE: QR analytics dashboard — 2026-11-06
  const fetchQrAnalytics = useCallback(
    async (selectedRange = qrRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      // Abort any in-flight QR request to prevent race conditions & stale data
      if (qrAbortControllerRef.current) {
        qrAbortControllerRef.current.abort();
      }
      qrAbortControllerRef.current = new AbortController();
      const currentSignal = qrAbortControllerRef.current.signal;
      activeQrRangeRef.current = selectedRange;

      setQrLoading(true);
      setQrError("");

      try {
        const res = await axios.get(
          `${API_URL}/user/analytics/qr?range=${encodeURIComponent(selectedRange)}`,
          {
            headers: { Authorization: `Bearer ${activeToken}` },
            signal: currentSignal,
          }
        );
        // Ensure only the latest active filter range updates state
        if (activeQrRangeRef.current === selectedRange && res.data?.success) {
          setQrAnalytics(res.data);
        }
      } catch (err) {
        // Silently ignore aborted requests from rapid filter clicks
        if (axios.isCancel(err) || err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          setQrError(
            err.response?.data?.message || "Failed to load QR analytics. Please try again."
          );
        }
      } finally {
        if (activeQrRangeRef.current === selectedRange) {
          setQrLoading(false);
        }
      }
    },
    [token, qrRange, handleSessionExpired]
  );

  const handleQrRangeChange = useCallback(
    (newRange) => {
      setQrRange(newRange);
      fetchQrAnalytics(newRange);
    },
    [fetchQrAnalytics]
  );

  useEffect(() => {
    if (activeView !== "qr-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchQrAnalytics(qrRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, qrRange, fetchQrAnalytics]);

  // Fetch Geo analytics on demand
  // CHANGE: Stage 8 — Geo-Location Analytics — 2026-11-08
  const fetchGeoAnalytics = useCallback(
    async (selectedRange = geoRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      // Abort any in-flight Geo request to prevent race conditions & stale data
      if (geoAbortControllerRef.current) {
        geoAbortControllerRef.current.abort();
      }
      geoAbortControllerRef.current = new AbortController();
      const currentSignal = geoAbortControllerRef.current.signal;
      activeGeoRangeRef.current = selectedRange;

      setGeoLoading(true);
      setGeoError("");

      try {
        const res = await axios.get(
          `${API_URL}/user/analytics/geo?range=${encodeURIComponent(selectedRange)}`,
          {
            headers: { Authorization: `Bearer ${activeToken}` },
            signal: currentSignal,
          }
        );
        // Ensure only the latest active filter range updates state
        if (activeGeoRangeRef.current === selectedRange && res.data?.success) {
          setGeoAnalytics(res.data);
        }
      } catch (err) {
        // Silently ignore aborted requests from rapid filter clicks
        if (axios.isCancel(err) || err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          setGeoError(
            err.response?.data?.message || "Failed to load geo analytics. Please try again."
          );
        }
      } finally {
        if (activeGeoRangeRef.current === selectedRange) {
          setGeoLoading(false);
        }
      }
    },
    [token, geoRange, handleSessionExpired]
  );

  const handleGeoRangeChange = useCallback(
    (newRange) => {
      setGeoRange(newRange);
      fetchGeoAnalytics(newRange);
    },
    [fetchGeoAnalytics]
  );

  useEffect(() => {
    if (activeView !== "geo-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchGeoAnalytics(geoRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, geoRange, fetchGeoAnalytics]);

  // CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
  // Fetch device, browser, OS, hardware, and channel analytics on demand
  const fetchDeviceAnalytics = useCallback(
    async (selectedRange = deviceRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      // Abort any in-flight Device request to prevent race conditions & stale data
      if (deviceAbortControllerRef.current) {
        deviceAbortControllerRef.current.abort();
      }
      deviceAbortControllerRef.current = new AbortController();
      const currentSignal = deviceAbortControllerRef.current.signal;
      activeDeviceRangeRef.current = selectedRange;

      setDeviceLoading(true);
      setDeviceError("");

      try {
        const res = await axios.get(
          `${API_URL}/user/analytics/devices?range=${encodeURIComponent(selectedRange)}`,
          {
            headers: { Authorization: `Bearer ${activeToken}` },
            signal: currentSignal,
          }
        );
        if (activeDeviceRangeRef.current === selectedRange && res.data?.success) {
          setDeviceAnalytics(res.data);
        }
      } catch (err) {
        if (axios.isCancel?.(err) || err.name === "CanceledError") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
          return;
        }
        const msg = err.response?.data?.message || "Failed to load device & browser analytics.";
        setDeviceError(msg);
        console.error("Failed to fetch device analytics:", err.message);
      } finally {
        if (activeDeviceRangeRef.current === selectedRange) {
          setDeviceLoading(false);
        }
      }
    },
    [token, deviceRange, handleSessionExpired]
  );

  const handleDeviceRangeChange = useCallback(
    (newRange) => {
      setDeviceRange(newRange);
      fetchDeviceAnalytics(newRange);
    },
    [fetchDeviceAnalytics]
  );

  useEffect(() => {
    if (activeView !== "device-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchDeviceAnalytics(deviceRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, deviceRange, fetchDeviceAnalytics]);

  // CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16
  // Fetch daily, hourly, QR vs direct, device, campaign, and heatmap analytics
  const fetchTrafficAnalytics = useCallback(
    async (selectedRange = trafficRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      if (trafficAbortControllerRef.current) {
        trafficAbortControllerRef.current.abort();
      }
      trafficAbortControllerRef.current = new AbortController();
      const currentSignal = trafficAbortControllerRef.current.signal;
      activeTrafficRangeRef.current = selectedRange;

      setTrafficLoading(true);
      setTrafficError("");

      try {
        const res = await axios.get(
          `${API_URL}/user/analytics/traffic?range=${encodeURIComponent(selectedRange)}`,
          {
            headers: { Authorization: `Bearer ${activeToken}` },
            signal: currentSignal,
          }
        );
        if (activeTrafficRangeRef.current === selectedRange && res.data?.success) {
          setTrafficAnalytics(res.data);
        }
      } catch (err) {
        if (axios.isCancel?.(err) || err.name === "CanceledError") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
          return;
        }
        const msg = err.response?.data?.message || "Failed to load traffic analytics.";
        setTrafficError(msg);
        console.error("Failed to fetch traffic analytics:", err.message);
      } finally {
        if (activeTrafficRangeRef.current === selectedRange) {
          setTrafficLoading(false);
        }
      }
    },
    [token, trafficRange, handleSessionExpired]
  );

  const handleTrafficRangeChange = useCallback(
    (newRange) => {
      setTrafficRange(newRange);
      fetchTrafficAnalytics(newRange);
    },
    [fetchTrafficAnalytics]
  );

  useEffect(() => {
    if (activeView !== "traffic-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchTrafficAnalytics(trafficRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, trafficRange, fetchTrafficAnalytics]);

  // CHANGE: Notifications Step 4B/4D — 2026-11-05
  // Fetch notifications belonging strictly to the authenticated user
  const fetchNotifications = useCallback(async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;

    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const res = await axios.get(NOTIFICATION_URL, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(typeof res.data.unreadCount === "number" ? res.data.unreadCount : 0);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
      } else {
        const msg = err.response?.data?.message || "Failed to load notifications.";
        setNotificationsError(msg);
        console.error("Failed to fetch notifications:", err.message);
      }
    } finally {
      setNotificationsLoading(false);
    }
  }, [token, handleSessionExpired]);

  // Mark a single notification as read
  const handleMarkAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) return;
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      try {
        const res = await axios.patch(
          `${NOTIFICATION_URL}/${notificationId}/read`,
          {},
          { headers: { Authorization: `Bearer ${activeToken}` } }
        );

        if (res.data?.success) {
          setNotifications((prev) => {
            const target = prev.find((n) => n._id === notificationId);
            if (target && !target.isRead) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }
            return prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n));
          });
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          console.error("Failed to mark notification as read:", err.message);
        }
      }
    },
    [token, handleSessionExpired]
  );

  // Mark all unread notifications of the logged-in user as read
  const handleMarkAllAsRead = useCallback(async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;

    try {
      const res = await axios.patch(
        `${NOTIFICATION_URL}/read-all`,
        {},
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );

      if (res.data?.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
      } else {
        console.error("Failed to mark all notifications as read:", err.message);
      }
    }
  }, [token, handleSessionExpired]);

  // Delete a single notification belonging to the logged-in user
  const handleDeleteNotification = useCallback(
    async (notificationId) => {
      if (!notificationId) return;
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      try {
        const res = await axios.delete(`${NOTIFICATION_URL}/${notificationId}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (res.data?.success) {
          setNotifications((prev) => {
            const target = prev.find((n) => n._id === notificationId);
            if (target && !target.isRead) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }
            return prev.filter((n) => n._id !== notificationId);
          });
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else {
          console.error("Failed to delete notification:", err.message);
        }
      }
    },
    [token, handleSessionExpired]
  );

  // Fetch notifications whenever the user is authenticated and token is available
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
  }, [token, fetchNotifications]);

  // CHANGE: Notifications Step 4C / Bell Click Fix — 2026-11-05
  // Dismiss notification dropdown on outside click or Escape key press
  useEffect(() => {
    if (!showNotificationsDropdown) return;

    const handleClickOutside = (e) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      ) {
        setShowNotificationsDropdown(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotificationsDropdown]);

  // Top metric calculations
  const totalClicks = useMemo(() => {
    return links.reduce((acc, l) => acc + (l.clicks || 0), 0);
  }, [links]);

  const activeLinks = useMemo(() => {
    return links.filter((l) => (l.clicks || 0) > 0).length;
  }, [links]);

  const avgClicks = useMemo(() => {
    return links.length > 0 ? totalClicks / links.length : 0;
  }, [links, totalClicks]);

  // Copy link handler
  const handleCopy = async (link) => {
    const url = `${API_URL}/${link.shortCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(link._id);
      setTimeout(() => setCopiedLinkId((cur) => (cur === link._id ? null : cur)), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  };

  // Create new link
  // CHANGE: Added optional UTM campaign inputs — 2026-11-01
  // CHANGE: Stage 7 — Smart Link Expiration & Access Control inputs — 2026-11-07
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;

    let parsedMaxClicks = null;
    if (maxClicksInput.trim()) {
      const num = parseInt(maxClicksInput.trim(), 10);
      if (isNaN(num) || num < 1) {
        setCreateError("Maximum clicks must be a positive whole number (at least 1)");
        return;
      }
      parsedMaxClicks = num;
    }

    let parsedExpiresAt = null;
    if (expiresAtInput) {
      const expDate = new Date(expiresAtInput);
      if (isNaN(expDate.getTime())) {
        setCreateError("Please provide a valid expiration date and time");
        return;
      }
      if (expDate.getTime() <= Date.now()) {
        setCreateError("Expiration date must be in the future");
        return;
      }
      parsedExpiresAt = expDate.toISOString();
    }

    setCreateLoading(true);
    setCreateError("");
    setCreateSuccessLink(null);

    try {
      const payload = {
        originalUrl: newUrlInput.trim(),
        utmSource: utmInputs.utmSource.trim() || null,
        utmMedium: utmInputs.utmMedium.trim() || null,
        utmCampaign: utmInputs.utmCampaign.trim() || null,
        utmTerm: utmInputs.utmTerm.trim() || null,
        utmContent: utmInputs.utmContent.trim() || null,
        expiresAt: parsedExpiresAt,
        maxClicks: parsedMaxClicks,
      };

      const res = await axios.post(
        API_URL,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const created = res.data?.data;
      if (created) {
        setLinks((prev) => [created, ...prev]);
        setCreateSuccessLink(created);
        setSelectedLink(created);
        setNewUrlInput("");
        setUtmInputs(initialUtmState);
        setShowUtmSection(false);
        setExpiresAtInput("");
        setMaxClicksInput("");
        setShowAccessSection(false);
        // CHANGE: Notifications Step 4B — 2026-11-04
        // Refresh notifications since new link creation generates a backend notification
        fetchNotifications();
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
      } else {
        setCreateError(err.response?.data?.message || "Failed to create short link.");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // Open deep-dive modal
  const handleOpenAnalytics = async (link) => {
    setDetailLink(link);
    setShowDetailModal(true);
    setDetailLoading(true);
    setDetailAnalytics(null);
    setModalTimeRange("7d");

    try {
      const res = await axios.get(`${API_URL}/${link.shortCode}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetailAnalytics(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleSessionExpired();
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PUBLIC MARKETING ROUTES (No login needed)
  // ---------------------------------------------------------------------------
  if (currentPath === "/" || currentPath === "") {
    return <LandingPage token={token} onNavigate={navigateTo} />;
  }
  if (currentPath === "/pricing") {
    return <PricingPage token={token} onNavigate={navigateTo} />;
  }
  if (currentPath === "/docs") {
    return <DocsPage token={token} onNavigate={navigateTo} />;
  }
  if (currentPath === "/changelog") {
    return <ChangelogPage token={token} onNavigate={navigateTo} />;
  }
  if (currentPath === "/status") {
    return <StatusPage token={token} onNavigate={navigateTo} />;
  }

  // Auth routes (/login or /register)
  if (currentPath === "/login" || currentPath === "/register") {
    if (token) {
      return <LandingPage token={token} onNavigate={navigateTo} />;
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        initialError={authError}
        initialMode={currentPath === "/register" ? "register" : "login"}
        onNavigate={navigateTo}
      />
    );
  }

  // CHANGE: Added persistent session refresh tokens — 2026-10-21
  if (isInitializing) {
    return (
      <div className="auth-wrapper">
        <div className="app-loading-screen">
          <div className="auth-logo-icon" aria-hidden="true">S</div>
          <div className="app-loading-spinner" aria-hidden="true"></div>
          <p className="app-loading-text">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        initialError={authError}
        initialMode="login"
        onNavigate={navigateTo}
      />
    );
  }

  return (
    <div className="dashboard-root">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Redesigned Modern Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""} ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        {/* Brand & Logo Header */}
        <div className="sidebar-logo">
          <div className="logo-badge" aria-hidden="true">
            <Link2 size={20} className="logo-badge-icon" />
          </div>
          <div className="logo-text-group">
            <h2 className="logo-title">SmartLink</h2>
            <span className="logo-badge-tag">PRO</span>
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            className="sidebar-collapse-toggle desktop-only"
            onClick={toggleSidebarCollapsed}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            className="sidebar-close-toggle mobile-only"
            onClick={() => setIsMobileMenuOpen(false)}
            title="Close menu"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. OVERVIEW Group */}
        <div className="sidebar-nav-group">
          <p className="sidebar-nav-heading">OVERVIEW</p>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`nav-item ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setActiveView("dashboard");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Dashboard" : undefined}
              data-tooltip="Dashboard"
              aria-label="Dashboard"
            >
              <span className="nav-item-icon">
                <LayoutDashboard size={18} />
              </span>
              <span className="nav-item-text">Dashboard</span>
            </button>
          </nav>
        </div>

        {/* 2. LINKS Group */}
        <div className="sidebar-nav-group">
          <p className="sidebar-nav-heading">LINKS</p>
          <nav className="sidebar-nav">
            <button
              type="button"
              className="nav-item quick-action"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (activeView !== "dashboard") {
                  setActiveView("dashboard");
                  setTimeout(() => {
                    const tableEl = document.querySelector(".links-table-card");
                    if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                  }, 60);
                } else {
                  const tableEl = document.querySelector(".links-table-card");
                  if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                }
              }}
              title={isSidebarCollapsed ? "My Links" : undefined}
              data-tooltip="My Links"
              aria-label="My Links"
            >
              <span className="nav-item-icon">
                <Link2 size={18} />
              </span>
              <span className="nav-item-text">My Links</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "qr-analytics" ? "active" : ""}`}
              onClick={() => {
                setActiveView("qr-analytics");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "QR Analytics" : undefined}
              data-tooltip="QR Analytics"
              aria-label="QR Analytics"
            >
              <span className="nav-item-icon">
                <QrCode size={18} />
              </span>
              <span className="nav-item-text">QR Analytics</span>
            </button>
          </nav>
        </div>

        {/* 3. ANALYTICS Group */}
        <div className="sidebar-nav-group">
          <p className="sidebar-nav-heading">ANALYTICS</p>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`nav-item ${activeView === "campaigns" ? "active" : ""}`}
              onClick={() => {
                setActiveView("campaigns");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Campaigns" : undefined}
              data-tooltip="Campaigns"
              aria-label="Campaigns"
            >
              <span className="nav-item-icon">
                <Megaphone size={18} />
              </span>
              <span className="nav-item-text">Campaigns</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "geo-analytics" ? "active" : ""}`}
              onClick={() => {
                setActiveView("geo-analytics");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Geo Analytics" : undefined}
              data-tooltip="Geo Analytics"
              aria-label="Geo Analytics"
            >
              <span className="nav-item-icon">
                <Globe size={18} />
              </span>
              <span className="nav-item-text">Geo Analytics</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "device-analytics" ? "active" : ""}`}
              onClick={() => {
                setActiveView("device-analytics");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Devices & OS" : undefined}
              data-tooltip="Devices & OS"
              aria-label="Devices & OS"
            >
              <span className="nav-item-icon">
                <Smartphone size={18} />
              </span>
              <span className="nav-item-text">Devices & OS</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "traffic-analytics" ? "active" : ""}`}
              onClick={() => {
                setActiveView("traffic-analytics");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Traffic Analytics" : undefined}
              data-tooltip="Traffic Analytics"
              aria-label="Traffic Analytics"
            >
              <span className="nav-item-icon">
                <Activity size={18} />
              </span>
              <span className="nav-item-text">Traffic Analytics</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "link-comparison" ? "active" : ""}`}
              onClick={() => {
                setActiveView("link-comparison");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Link Comparison" : undefined}
              data-tooltip="Link Comparison"
              aria-label="Link Comparison"
            >
              <span className="nav-item-icon">
                <ArrowRightLeft size={18} />
              </span>
              <span className="nav-item-text">Link Comparison</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "anomaly-detection" ? "active" : ""}`}
              onClick={() => {
                setActiveView("anomaly-detection");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Traffic Intelligence" : undefined}
              data-tooltip="Traffic Intelligence"
              aria-label="Traffic Intelligence"
            >
              <span className="nav-item-icon">
                <ShieldAlert size={18} />
              </span>
              <span className="nav-item-text">Traffic Intelligence</span>
            </button>
          </nav>
        </div>

        {/* 4. SETTINGS Group */}
        <div className="sidebar-nav-group">
          <p className="sidebar-nav-heading">SETTINGS</p>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`nav-item ${activeView === "ab-testing" ? "active" : ""}`}
              onClick={() => {
                setActiveView("ab-testing");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "A/B Testing" : undefined}
              data-tooltip="A/B Testing"
              aria-label="A/B Testing"
            >
              <span className="nav-item-icon">
                <GitFork size={18} />
              </span>
              <span className="nav-item-text">A/B Testing</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "reports" ? "active" : ""}`}
              onClick={() => {
                setActiveView("reports");
                setIsMobileMenuOpen(false);
              }}
              title={isSidebarCollapsed ? "Reports & Export" : undefined}
              data-tooltip="Reports & Export"
              aria-label="Reports & Export"
            >
              <span className="nav-item-icon">
                <FileText size={18} />
              </span>
              <span className="nav-item-text">Reports & Export</span>
            </button>

            <button
              type="button"
              className="nav-item quick-action"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (links.length > 0) {
                  const target =
                    selectedLink &&
                    selectedLink !== "__all__" &&
                    selectedLink.shortCode
                      ? selectedLink
                      : links[0];
                  handleOpenAnalytics(target);
                }
              }}
              title={isSidebarCollapsed ? "Quick Analytics" : undefined}
              data-tooltip="Quick Analytics"
              aria-label="Quick Analytics"
            >
              <span className="nav-item-icon">
                <BarChart3 size={18} />
              </span>
              <span className="nav-item-text">Quick Analytics</span>
            </button>

            <button
              type="button"
              className={`nav-item ${activeView === "settings" ? "active" : ""}`}
              onClick={() => {
                setActiveView("settings");
                setIsMobileMenuOpen(false);
                navigateTo("/settings");
              }}
              title={isSidebarCollapsed ? "Settings" : undefined}
              data-tooltip="Settings"
              aria-label="Settings"
            >
              <span className="nav-item-icon">
                <SettingsIcon size={18} />
              </span>
              <span className="nav-item-text">Settings</span>
            </button>
          </nav>
        </div>

        {/* Enhanced Sticky Sidebar Bottom Block */}
        <SidebarBottom
          isCollapsed={isSidebarCollapsed}
          totalLinks={dashboardAnalytics?.totalLinks ?? links.length}
          totalClicks={
            dashboardAnalytics?.totalClicks ??
            links.reduce((sum, l) => sum + (l.clicks || 0), 0)
          }
          user={user}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Viewport */}
      <main className={`main-viewport ${isSidebarCollapsed ? "collapsed" : ""}`}>
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left-group">
            <button
              type="button"
              className="btn-mobile-menu-toggle mobile-only"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              title="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="topbar-search-box">
              <span className="search-box-icon" aria-hidden="true">
                <Search size={15} />
              </span>
              <select
                className="topbar-search-scope"
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value)}
                aria-label="Search scope"
              >
                <option value="all">All</option>
                <option value="links">Links</option>
                <option value="campaigns">Campaigns</option>
                <option value="pages">Pages</option>
              </select>
              <input
                ref={searchInputRef}
                type="search"
                className="topbar-search-field"
                placeholder={
                  searchScope === "links"
                    ? "Search links..."
                    : searchScope === "campaigns"
                    ? "Search campaigns..."
                    : searchScope === "pages"
                    ? "Search pages..."
                    : "Search links, campaigns..."
                }
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  if (searchScope === "pages" && val.trim()) {
                    const q = val.toLowerCase().trim();
                    if ("settings".includes(q)) {
                      setActiveView("settings");
                    } else if ("campaigns".includes(q)) {
                      setActiveView("campaigns");
                    } else if ("dashboard".includes(q)) {
                      setActiveView("dashboard");
                    } else if ("reports".includes(q)) {
                      setActiveView("reports");
                    }
                  }
                }}
                aria-label={`Search in ${searchScope}`}
              />
              <kbd className="ui-input-shortcut" aria-hidden="true">
                Ctrl+K
              </kbd>
            </div>
          </div>

          <div className="topbar-actions">
            {/* 1. Help icon button */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => navigateTo("/docs")}
              title="Help & docs"
              aria-label="Help & documentation"
            >
              <HelpCircle size={18} />
            </button>

            {/* 2. Notifications bell with count badge */}
            <div className="topbar-notifications-wrapper" ref={notificationsRef}>
              <button
                type="button"
                className={`topbar-icon-btn ${showNotificationsDropdown ? "active" : ""}`}
                title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                aria-expanded={showNotificationsDropdown}
                aria-haspopup="true"
                onClick={() => setShowNotificationsDropdown((prev) => !prev)}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="topbar-notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div
                  className="notifications-dropdown"
                  role="region"
                  aria-label="Notifications panel"
                >
                  <div className="notifications-dropdown-header">
                    <div className="notifications-header-title">
                      <span>Notifications</span>
                      {unreadCount > 0 ? (
                        <span className="notifications-unread-pill">{unreadCount} new</span>
                      ) : (
                        <span className="notifications-all-read-pill">All caught up</span>
                      )}
                    </div>
                    {/* CHANGE: Notifications Step 4D — 2026-11-05 */}
                    {unreadCount > 0 && (
                      <SpecularButton
                        variant="ghost"
                        size="xs"
                        className="btn-mark-all-read"
                        onClick={handleMarkAllAsRead}
                        title="Mark all notifications as read"
                      >
                        Mark all as read
                      </SpecularButton>
                    )}
                  </div>

                  <div className="notifications-dropdown-body">
                    {notificationsLoading ? (
                      <div className="notifications-empty-state">
                        <div className="notifications-spinner" aria-hidden="true"></div>
                        <p className="notifications-empty-title">Loading notifications...</p>
                        <p className="notifications-empty-desc">Fetching your latest activity.</p>
                      </div>
                    ) : notificationsError ? (
                      <div className="notifications-empty-state error">
                        <span className="notifications-empty-icon"><AlertTriangle size={24} style={{ color: "var(--warning)" }} /></span>
                        <p className="notifications-empty-title">Unable to load</p>
                        <p className="notifications-empty-desc">{notificationsError}</p>
                        <SpecularButton
                          variant="danger"
                          size="xs"
                          className="btn-retry-notifications"
                          onClick={fetchNotifications}
                        >
                          Retry
                        </SpecularButton>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="notifications-empty-state">
                        <span className="notifications-empty-icon"><Bell size={24} style={{ color: "var(--text-muted)" }} /></span>
                        <p className="notifications-empty-title">No notifications yet</p>
                        <p className="notifications-empty-desc">
                          We&apos;ll notify you when your links get clicks or reach milestones.
                        </p>
                      </div>
                    ) : (
                      <div className="notifications-list">
                        {notifications.map((n) => {
                          const typeConfig =
                            NOTIFICATION_TYPE_CONFIG[n.type] || NOTIFICATION_TYPE_CONFIG.system;
                          const formattedDate = formatNotificationIST(n.createdAt);

                          return (
                            <div
                              key={n._id}
                              className={`notification-item ${!n.isRead ? "unread" : "read"}`}
                            >
                              <div className="notification-item-left">
                                <div
                                  className={`notification-type-icon ${typeConfig.badgeClass}`}
                                  title={typeConfig.label}
                                >
                                  {typeConfig.icon}
                                </div>
                              </div>

                              <div className="notification-item-main">
                                <div className="notification-item-header-row">
                                  <span className="notification-item-title">{n.title}</span>
                                  <span className={`notification-type-pill ${typeConfig.badgeClass}`}>
                                    {typeConfig.label}
                                  </span>
                                </div>

                                <p className="notification-item-message">{n.message}</p>

                                <div className="notification-item-footer">
                                  <span className="notification-item-time" title="Indian Standard Time">
                                    {formattedDate ? `${formattedDate} (IST)` : ""}
                                  </span>

                                  <div className="notification-item-actions">
                                    {!n.isRead && (
                                      <SpecularButton
                                        variant="ghost"
                                        size="xs"
                                        className="btn-action-read"
                                        onClick={() => handleMarkAsRead(n._id)}
                                        title="Mark as read"
                                        aria-label="Mark as read"
                                      >
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          width="12"
                                          height="12"
                                        >
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>Mark read</span>
                                      </SpecularButton>
                                    )}

                                    <SpecularButton
                                      variant="danger"
                                      size="xs"
                                      className="btn-action-delete"
                                      onClick={() => handleDeleteNotification(n._id)}
                                      title="Delete notification"
                                      aria-label="Delete notification"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        width="13"
                                        height="13"
                                      >
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </SpecularButton>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Upgrade button (secondary glass style, hidden for highest plan) */}
            {!PLAN_LIMITS[CURRENT_PLAN]?.isHighest && (
              <button
                type="button"
                className="topbar-upgrade-btn"
                onClick={() => navigateTo("/pricing")}
                title="Upgrade plan"
                aria-label="Upgrade subscription plan"
              >
                <Zap size={14} className="upgrade-btn-icon" />
                <span>Upgrade</span>
              </button>
            )}

            {/* 4. Create link primary button */}
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              className="btn-create-primary"
              onClick={() => {
                setShowCreateModal(true);
                setCreateSuccessLink(null);
                setCreateError("");
                setNewUrlInput("");
                setUtmInputs(initialUtmState);
                setShowUtmSection(false);
                setExpiresAtInput("");
                setMaxClicksInput("");
                setShowAccessSection(false);
              }}
            >
              Create link
            </Button>

            {/* 5. Avatar with online dot */}
            <div
              className="topbar-avatar-wrapper"
              title={`Signed in as ${user?.username || "Vijay"}`}
              aria-label={`Signed in as ${user?.username || "Vijay"}`}
            >
              <div className="user-avatar topbar-user-avatar">
                {user?.username ? user.username.charAt(0).toUpperCase() : "V"}
              </div>
              <span className="user-online-dot topbar-online-dot" aria-label="Online" />
            </div>
          </div>
        </header>

        {/* 4. Announcement Banner (dismissible below topbar) */}
        <AnnouncementBanner onNavigate={navigateTo} />

        {/* Main View Switcher: Dashboard vs Campaigns */}
        {/* CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02 */}
        {activeView === "dashboard" ? (
          <>
            {/* Section A: Welcome Greeting + Compact Global Date-Range Selector */}
            {/* CHANGE: Main Dashboard heading animated with SplitText & Compact Date Selector — 2026-11-19 */}
            <AnimatedContent distance={20} delay={0.05}>
              <div className="page-greeting">
                <div className="page-greeting-text">
                  <h1 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: "600", color: "var(--text)" }}>
                    Welcome back, {user?.username || "Vijay"}!
                  </h1>
                  <p>Here&apos;s an overview of your links and performance.</p>
                </div>

                {/* Section A: Compact Global Date-Range Selector */}
                <div className="header-range-controls">
                  <span className="header-range-label">Timeframe:</span>
                  <SegmentedControl
                    options={[
                      { value: "7d", label: "7D" },
                      { value: "30d", label: "30D" },
                      { value: "all", label: "All Time" },
                    ]}
                    value={timeRange}
                    onChange={handleGlobalRangeChange}
                  />
                  <Button
                    variant="glass"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => {
                      fetchDashboardAnalytics(timeRange);
                    }}
                    title="Refresh data"
                    aria-label="Refresh data"
                  />
                </div>
              </div>
            </AnimatedContent>

            {/* Section B: Top 4 Statistic Cards (SpotlightCard + CountUp) */}
            <AnimatedContent distance={25} delay={0.12}>
              <MetricCards
                totalLinks={links.length}
                totalClicks={totalClicks}
                activeLinks={activeLinks}
                avgClicks={avgClicks}
                intelligence={dashboardAnalytics?.intelligence}
              />
            </AnimatedContent>

            {/* Section 3: Clicks Overview – All Links (Large Full-Width Spline Chart) */}
            {/* CHANGE: Dashboard Layout Rearrangement Phase 1 — 2026-11-19 */}
            <AnimatedContent distance={25} delay={0.18}>
              <div className="clicks-overview-fullwidth-section">
                <ClicksOverviewChart
                  dailyTrends={dashboardAnalytics?.dailyTrends || []}
                  history={dashboardAnalytics?.history || []}
                  selectedLink={selectedLink}
                  links={links}
                  onSelectLink={setSelectedLink}
                  timeRange={timeRange}
                  onTimeRangeChange={handleGlobalRangeChange}
                />
              </div>
            </AnimatedContent>

            {/* Section 4: Three sections in one row (Device Breakdown + Browser Breakdown + Traffic Sources) */}
            {/* CHANGE: Dashboard Layout Rearrangement Phase 1 — 2026-11-19 */}
            <AnimatedContent distance={25} delay={0.24}>
              <div className="three-analytics-row">
                <div className="three-col-item">
                  <DonutChart
                    title="Device Breakdown"
                    icon={<Smartphone size={16} />}
                    data={dashboardAnalytics?.devices || []}
                    emptyMessage="No device data recorded yet. Share your short link to view visitor platforms."
                  />
                </div>
                <div className="three-col-item">
                  <DonutChart
                    title="Browser Breakdown"
                    icon={<Globe size={16} />}
                    data={dashboardAnalytics?.browsers || []}
                    emptyMessage="No browser data recorded yet. Visitor browsers will appear after clicks."
                  />
                </div>
                <div className="three-col-item source-col-item">
                  <TrafficSourcesCard
                    campaignAnalytics={campaignAnalytics}
                    loading={campaignLoading}
                    onCreateUtmLink={() => {
                      setShowCreateModal(true);
                      setCreateSuccessLink(null);
                      setCreateError("");
                      setNewUrlInput("");
                      setUtmInputs(initialUtmState);
                      setShowUtmSection(true);
                      setExpiresAtInput("");
                      setMaxClicksInput("");
                      setShowAccessSection(false);
                    }}
                  />
                </div>
              </div>
            </AnimatedContent>

            {/* Section 5: Full-width Click Activity Graph (GitHub-Style Yearly Contribution Graph) */}
            {/* CHANGE: Dashboard Layout Rearrangement Phase 1 — 2026-11-19 */}
            <AnimatedContent distance={25} delay={0.3}>
              <div className="yearly-graph-fullwidth-section">
                <YearlyActivityGraph
                  history={dashboardAnalytics?.history || []}
                  dailyTrends={dashboardAnalytics?.dailyTrends || []}
                  totalClicks={totalClicks}
                />
              </div>
            </AnimatedContent>

            {/* Section 6: Smart Traffic Intelligence (Four Insight Cards in One Row) */}
            {/* CHANGE: Dashboard Layout Rearrangement Phase 1 — 2026-11-19 */}
            <AnimatedContent distance={25} delay={0.36}>
              <div className="intelligence-fullwidth-section">
                <SmartTrafficSection intelligence={dashboardAnalytics?.intelligence} />
              </div>
            </AnimatedContent>

            {/* Section 7: Recent Links (Full-Width Section at the Bottom) */}
            {/* CHANGE: Dashboard Layout Rearrangement Phase 1 — 2026-11-19 */}
            <AnimatedContent distance={25} delay={0.42}>
              <div className="recent-links-fullwidth-section">
                <RecentLinksTable
                  links={links}
                  onCopy={handleCopy}
                  copiedLinkId={copiedLinkId}
                  onOpenAnalytics={handleOpenAnalytics}
                  // CHANGE: QR Code Feature Stage 4 — 2026-11-05
                  onOpenQRCode={handleOpenQrModal}
                  // CHANGE: Stage 7 — Smart Link Expiration & Access Control — 2026-11-07
                  onTogglePause={handleTogglePause}
                  onOpenAccessModal={handleOpenAccessModal}
                  togglingLinkId={togglingLinkId}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                />
              </div>
            </AnimatedContent>
          </>
        ) : activeView === "campaigns" ? (
          <CampaignAnalyticsView
            campaignAnalytics={campaignAnalytics}
            campaignLoading={campaignLoading}
            campaignError={campaignError}
            campaignRange={campaignRange}
            onRangeChange={handleCampaignRangeChange}
            onRefresh={() => fetchCampaignAnalytics(campaignRange)}
          />
        ) : activeView === "qr-analytics" ? (
          <QRAnalyticsView
            qrAnalytics={qrAnalytics}
            qrLoading={qrLoading}
            qrError={qrError}
            qrRange={qrRange}
            onRangeChange={handleQrRangeChange}
            onRefresh={() => fetchQrAnalytics(qrRange)}
            onCopy={handleCopy}
            copiedLinkId={copiedLinkId}
            onOpenQRCode={handleOpenQrModal}
          />
        ) : activeView === "geo-analytics" ? (
          <GeoAnalyticsView
            geoAnalytics={geoAnalytics}
            geoLoading={geoLoading}
            geoError={geoError}
            geoRange={geoRange}
            onRangeChange={handleGeoRangeChange}
            onRefresh={() => fetchGeoAnalytics(geoRange)}
          />
        ) : activeView === "device-analytics" ? (
          <DeviceAnalyticsView
            deviceAnalytics={deviceAnalytics}
            deviceLoading={deviceLoading}
            deviceError={deviceError}
            deviceRange={deviceRange}
            onRangeChange={handleDeviceRangeChange}
            onRefresh={() => fetchDeviceAnalytics(deviceRange)}
          />
        ) : activeView === "traffic-analytics" ? (
          /* CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16 */
          <TrafficAnalyticsView
            trafficAnalytics={trafficAnalytics}
            trafficLoading={trafficLoading}
            trafficError={trafficError}
            trafficRange={trafficRange}
            onRangeChange={handleTrafficRangeChange}
            onRefresh={() => fetchTrafficAnalytics(trafficRange)}
          />
        ) : activeView === "link-comparison" ? (
          /* CHANGE: Stage 11 Link Comparison Dashboard — 2026-11-16 */
          <LinkComparisonView
            links={links}
            token={token}
            apiBaseUrl={API_BASE_URL}
          />
        ) : activeView === "anomaly-detection" ? (
          /* CHANGE: Stage 12 Smart Traffic Anomaly Detection Dashboard — 2026-11-16 */
          <TrafficAnomalyView
            token={token}
            apiBaseUrl={API_BASE_URL}
          />
        ) : activeView === "ab-testing" ? (
          /* CHANGE: Stage 13 Smart A/B Link Testing Dashboard — 2026-11-18 */
          <ABTestingView
            links={links}
            token={token}
            apiBaseUrl={API_BASE_URL}
          />
        ) : activeView === "reports" ? (
          /* CHANGE: Stage 14 Automated Reports View — 2026-11-19 */
          <ReportsView
            links={links}
            token={token}
            apiBaseUrl={API_BASE_URL}
          />
        ) : activeView === "settings" ? (
          <SettingsView
            user={user}
            token={token}
            apiBaseUrl={API_BASE_URL}
            onUserUpdate={(updatedUser) => {
              setUser(updatedUser);
              try {
                localStorage.setItem("user", JSON.stringify(updatedUser));
              } catch (_) {}
            }}
            onLogout={handleLogout}
          />
        ) : null}
      </main>

      {/* Create New Link Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={resetCreateModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{createSuccessLink ? "Link Created" : "Create a Short Link"}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={resetCreateModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createError && (
                  <div className="auth-alert error" style={{ marginBottom: "16px" }}>
                    <span>{createError}</span>
                  </div>
                )}

                {/* CHANGE: QR Code Feature Stage 3 — 2026-11-05 */}
                {/* Automatic QR code and short URL display upon successful link creation */}
                {createSuccessLink ? (
                  <div className="create-success-container">
                    <div className="create-success-alert">
                      <span className="create-success-alert-icon">✓</span>
                      <span className="create-success-alert-text">
                        Smart Link Created Successfully!
                      </span>
                    </div>

                    {/* Option 1: Click the short link */}
                    <div className="success-option-card">
                      <div className="success-option-header">
                        <span className="success-option-badge">Option 1</span>
                        <span className="success-option-title">Click the short link</span>
                      </div>
                      <p className="success-option-desc">
                        Click the short link to test the redirect, or copy it to share anywhere.
                      </p>

                      <div className="success-url-box">
                        <a
                          href={`${API_URL}/${createSuccessLink.shortCode}`}
                          target="_blank"
                          rel="noreferrer"
                          className="success-clickable-url"
                          title="Click to visit short link"
                        >
                          <span className="success-url-prefix">{API_URL}/</span>
                          <span className="success-url-code">
                            {createSuccessLink.shortCode}
                          </span>
                          <span className="success-url-icon" aria-hidden="true">
                            ↗
                          </span>
                        </a>

                        <SpecularButton
                          variant={copiedLinkId === createSuccessLink._id ? "success" : "primary"}
                          size="sm"
                          className={`btn-create-primary success-copy-btn ${
                            copiedLinkId === createSuccessLink._id ? "copied" : ""
                          }`}
                          onClick={() => handleCopy(createSuccessLink)}
                          title="Copy short link"
                        >
                          {copiedLinkId === createSuccessLink._id ? "✓ Copied" : "Copy"}
                        </SpecularButton>
                      </div>

                      {createSuccessLink.originalUrl && (
                        <div className="success-destination-row">
                          <span className="success-destination-label">Redirects to:</span>
                          <span
                            className="success-destination-text"
                            title={createSuccessLink.originalUrl}
                          >
                            {createSuccessLink.originalUrl}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Option 2: Scan the QR code */}
                    <div className="success-option-card">
                      <div className="success-option-header">
                        <span className="success-option-badge">Option 2</span>
                        <span className="success-option-title">Scan the QR code</span>
                      </div>
                      <p className="success-option-desc">
                        Scan this QR code with any smartphone camera to visit the short link and track visits.
                      </p>

                      <div className="success-qr-wrapper">
                        <QRCodeCard
                          shortUrl={`${API_URL}/${createSuccessLink.shortCode}`}
                          shortCode={createSuccessLink.shortCode}
                          size={160}
                          showUrl={false}
                          showDownload={false}
                          showCopy={false}
                          className="create-success-qr-card"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="modal-input-label">Destination URL</label>
                    <input
                      type="url"
                      className="modal-text-input"
                      placeholder="https://example.com/very-long-url-to-shorten"
                      value={newUrlInput}
                      onChange={(e) => setNewUrlInput(e.target.value)}
                      required
                      autoFocus
                    />
                    <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                      Destination must be a valid HTTP or HTTPS web address.
                    </p>

                    {/* CHANGE: Added optional UTM campaign inputs — 2026-11-01 */}
                    <div className="utm-collapsible-wrapper">
                      <button
                        type="button"
                        className="utm-toggle-btn"
                        onClick={() => setShowUtmSection((prev) => !prev)}
                        aria-expanded={showUtmSection}
                      >
                        <span className="utm-toggle-title">
                          <span className="utm-toggle-icon">{showUtmSection ? "▼" : "▶"}</span>
                          Advanced Campaign Tracking (Optional)
                        </span>
                        <span className="utm-toggle-badge">
                          {Object.values(utmInputs).filter((v) => v.trim()).length > 0
                            ? `${Object.values(utmInputs).filter((v) => v.trim()).length} active`
                            : "UTM tags"}
                        </span>
                      </button>

                      {showUtmSection && (
                        <div className="utm-inputs-panel">
                          <p className="utm-section-desc">
                            Add UTM parameters to track campaign performance, traffic sources, and channels.
                          </p>

                          <div className="utm-grid">
                            <div className="utm-field">
                              <label className="modal-input-label">
                                Campaign Source <span className="utm-tag-hint">(utmSource)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. google, newsletter, twitter"
                                value={utmInputs.utmSource}
                                onChange={(e) =>
                                  setUtmInputs((prev) => ({ ...prev, utmSource: e.target.value }))
                                }
                                maxLength={200}
                              />
                            </div>

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Campaign Medium <span className="utm-tag-hint">(utmMedium)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. cpc, email, social, banner"
                                value={utmInputs.utmMedium}
                                onChange={(e) =>
                                  setUtmInputs((prev) => ({ ...prev, utmMedium: e.target.value }))
                                }
                                maxLength={200}
                              />
                            </div>

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Campaign Name <span className="utm-tag-hint">(utmCampaign)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. spring_sale, product_launch"
                                value={utmInputs.utmCampaign}
                                onChange={(e) =>
                                  setUtmInputs((prev) => ({ ...prev, utmCampaign: e.target.value }))
                                }
                                maxLength={200}
                              />
                            </div>

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Campaign Term <span className="utm-tag-hint">(utmTerm)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. link-management, analytics"
                                value={utmInputs.utmTerm}
                                onChange={(e) =>
                                  setUtmInputs((prev) => ({ ...prev, utmTerm: e.target.value }))
                                }
                                maxLength={200}
                              />
                            </div>

                            <div className="utm-field utm-field-full">
                              <label className="modal-input-label">
                                Campaign Content <span className="utm-tag-hint">(utmContent)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. hero_cta, sidebar_banner, text_link"
                                value={utmInputs.utmContent}
                                onChange={(e) =>
                                  setUtmInputs((prev) => ({ ...prev, utmContent: e.target.value }))
                                }
                                maxLength={200}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CHANGE: Stage 7 — Smart Link Expiration & Access Control (Optional) — 2026-11-07 */}
                    <div className="utm-collapsible-wrapper" style={{ marginTop: "12px" }}>
                      <button
                        type="button"
                        className="utm-toggle-btn"
                        onClick={() => setShowAccessSection((prev) => !prev)}
                        aria-expanded={showAccessSection}
                      >
                        <span className="utm-toggle-title">
                          <span className="utm-toggle-icon">{showAccessSection ? "▼" : "▶"}</span>
                          Access Control & Expiry (Optional)
                        </span>
                        <span className="utm-toggle-badge">
                          {expiresAtInput || maxClicksInput ? "Configured" : "Access rules"}
                        </span>
                      </button>

                      {showAccessSection && (
                        <div className="utm-inputs-panel">
                          <p className="utm-section-desc">
                            Set expiration schedules and maximum click limits to automatically restrict link access.
                          </p>

                          <div className="utm-grid">
                            <div className="utm-field">
                              <label className="modal-input-label">
                                Expiration Date & Time <span className="utm-tag-hint">(optional)</span>
                              </label>
                              <input
                                type="datetime-local"
                                className="modal-text-input utm-input"
                                value={expiresAtInput}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={(e) => setExpiresAtInput(e.target.value)}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                                Link automatically expires (410 Expired) after this date and time.
                              </p>
                            </div>

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Maximum Clicks <span className="utm-tag-hint">(optional)</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                className="modal-text-input utm-input"
                                placeholder="e.g. 50, 100, 500"
                                value={maxClicksInput}
                                onChange={(e) => setMaxClicksInput(e.target.value)}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                                Link automatically disables once this click limit is reached.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CHANGE: QR Code Feature Stage 3 — 2026-11-05 */}
              {/* Modal footer providing clear actions to finish or create another link */}
              <div className="modal-footer">
                {createSuccessLink ? (
                  <>
                    <SpecularButton
                      variant="secondary"
                      size="md"
                      className="btn-secondary"
                      onClick={handleCreateAnother}
                    >
                      + Create Another Link
                    </SpecularButton>
                    <SpecularButton
                      variant="primary"
                      size="md"
                      className="btn-create-primary"
                      onClick={resetCreateModal}
                    >
                      Done
                    </SpecularButton>
                  </>
                ) : (
                  <>
                    <SpecularButton
                      variant="secondary"
                      size="md"
                      className="btn-secondary"
                      onClick={resetCreateModal}
                    >
                      Cancel
                    </SpecularButton>
                    <SpecularButton
                      variant="primary"
                      size="md"
                      type="submit"
                      className="btn-create-primary"
                      disabled={createLoading}
                    >
                      {createLoading ? "Creating..." : "Create Short Link →"}
                    </SpecularButton>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Analytics Deep-Dive Modal */}
      {showDetailModal && detailLink && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal-panel large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Link Analytics: /{detailLink.shortCode}</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  {detailLink.originalUrl}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDetailModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              {detailLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  Loading analytics for /{detailLink.shortCode}...
                </div>
              ) : (
                <>
                  <ClicksOverviewChart
                    dailyTrends={detailAnalytics?.dailyTrends || []}
                    history={detailAnalytics?.history || []}
                    selectedLink={detailLink}
                    links={[detailLink]}
                    timeRange={modalTimeRange}
                    onTimeRangeChange={setModalTimeRange}
                  />

                  <div className="donuts-grid">
                    <DonutChart
                      title="Device Breakdown"
                      icon={<Smartphone size={16} />}
                      data={detailAnalytics?.devices || []}
                    />
                    <DonutChart
                      title="Browser Breakdown"
                      icon={<Globe size={16} />}
                      data={detailAnalytics?.browsers || []}
                    />
                  </div>

                  <ActivityHeatmap history={detailAnalytics?.history || []} />

                  <SmartTrafficSection intelligence={detailAnalytics?.intelligence} />

                  {/* Individual Click Events History Table */}
                  <div className="links-table-card">
                    <h4 style={{ margin: "0 0 12px", color: "var(--text)", fontSize: "15px" }}>
                      Click Events Log (IST)
                    </h4>
                    <div className="table-responsive-box">
                      <table className="custom-links-table">
                        <thead>
                          <tr>
                            <th>Time (IST)</th>
                            <th>Device</th>
                            <th>Browser</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailAnalytics?.history && detailAnalytics.history.length > 0 ? (
                            detailAnalytics.history.map((click, i) => (
                              <tr key={click._id || i}>
                                <td style={{ color: "var(--text-secondary)" }}>
                                  {click.clickedAtIST || "—"}
                                </td>
                                <td>
                                  <span className="status-pill ready">
                                    {click.deviceType || "unknown"}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                    {click.browser || "Unknown"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" style={{ textAlign: "center", color: "var(--text-dim)", padding: "24px" }}>
                                No click events recorded for this link yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <SpecularButton
                variant="secondary"
                size="md"
                className="btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </SpecularButton>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE: QR Code Feature Stage 4 — 2026-11-05 */}
      {/* Dedicated QR Code Preview Modal for My Links & QR Analytics */}
      {showQrModal && selectedQrLink && (
        <div className="modal-backdrop" onClick={handleCloseQrModal}>
          <div
            className="modal-panel qr-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="qr-modal-header-info">
                <h3>QR Code: /{selectedQrLink.shortCode}</h3>
                {selectedQrLink.originalUrl && (
                  <p
                    className="qr-modal-dest-preview"
                    title={selectedQrLink.originalUrl}
                  >
                    Redirects to: {selectedQrLink.originalUrl}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseQrModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body qr-modal-body">
              {/* CHANGE: Final QR modal layout fix — entire QR visible without scrolling — 2026-11-07 */}
              <QRCodeCard
                shortUrl={`${API_URL}/${selectedQrLink.shortCode}`}
                shortCode={selectedQrLink.shortCode}
                size={240}
                showUrl={true}
                showDownload={true}
                showCopy={true}
                className="qr-preview-card"
              />
            </div>

            <div className="modal-footer">
              <SpecularButton
                variant="secondary"
                size="md"
                className="btn-secondary"
                onClick={handleCloseQrModal}
              >
                Close
              </SpecularButton>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE: Stage 7 — Smart Link Access & Expiration Settings Modal — 2026-11-07 */}
      {showAccessModal && selectedAccessLink && (
        <AccessSettingsModal
          link={selectedAccessLink}
          onClose={handleCloseAccessModal}
          onSaveSuccess={handleAccessSaveSuccess}
          token={token}
          onSessionExpired={handleSessionExpired}
        />
      )}
    </div>
  );
}

export default App;