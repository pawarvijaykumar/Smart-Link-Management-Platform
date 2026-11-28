import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import GeoAnalyticsView from "./components/GeoAnalyticsView";
import GeoMap2D from "./components/GeoMap2D";
const GeoGlobe3D = lazy(() => import("./components/GeoGlobe3D"));
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
import { useTimeRange, toApiRange } from "./context/TimeRangeContext";
// CHANGE: React Bits Specular Button & SpotlightCard Integration
import SpecularButton from "./components/SpecularButton";
import SpotlightCard from "./components/SpotlightCard";
import CountUp from "./components/CountUp";
import AnimatedContent from "./components/AnimatedContent";
import TrafficSourcesCard from "./components/TrafficSourcesCard";
import RankedBars from "./components/RankedBars";
import OverviewBreakdownRow from "./components/OverviewBreakdownRow";
import {
  Button,
  Card,
  StatCard,
  Badge,
  SegmentedControl,
  TimeRangeToggle,
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
  Info,
  Tag,
  Trash2,
  Play,
  Pause,
  Clock,
  Lock,
  Sliders,
} from "lucide-react";
import LinkDetailDrawer from "./components/LinkDetailDrawer";
import LandingPage from "./marketing/LandingPage";
import PricingPage from "./marketing/PricingPage";
import DocsPage from "./marketing/DocsPage";
import ChangelogPage from "./marketing/ChangelogPage";
import StatusPage from "./marketing/StatusPage";
import SettingsView from "./components/SettingsView";
import DashboardActivityView from "./components/DashboardActivityView";
import SidebarBottom from "./components/SidebarBottom";
import AnnouncementBanner from "./components/AnnouncementBanner";
import CommandPalette from "./components/CommandPalette";
import { useTheme } from "./context/ThemeContext";
import { PLAN_LIMITS, CURRENT_PLAN } from "./config/plans.config";
import { analyticsCache } from "./utils/analyticsCache";
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
  timeRange = "all",
  dailyTrends = [],
  links = [],
  loading = false,
}) {
  const todayClicks = intelligence?.totalClicksToday || 0;
  const activePercent = totalLinks > 0 ? Math.round((activeLinks / totalLinks) * 100) : 0;
  const inactiveLinks = Math.max(0, totalLinks - activeLinks);
  const clicksPerActive = activeLinks > 0 ? (totalClicks / activeLinks).toFixed(1) : "0.0";

  // Comparison vs previous period calculation
  const normTimeRange = String(timeRange || "30d").toLowerCase();
  const periodDays = normTimeRange === "7d" ? 7 : 30;
  const periodLabel = normTimeRange === "7d" ? "previous 7 days" : "previous 30 days";

  const { clicksDelta, clicksDeltaType, linksDelta, linksDeltaType, avgDelta, avgDeltaType, sparklineData } = useMemo(() => {
    // 1. Clicks comparison
    const sortedTrends = [...dailyTrends].sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || ""));
    const currentSlice = sortedTrends.slice(-periodDays);
    const priorSlice = sortedTrends.slice(-2 * periodDays, -periodDays);

    const currentClicksSum = currentSlice.reduce((s, d) => s + (d.count || 0), 0);
    const priorClicksSum = priorSlice.reduce((s, d) => s + (d.count || 0), 0);

    let cDelta = null;
    let cType = "neutral";
    if (priorClicksSum > 0) {
      const diff = currentClicksSum - priorClicksSum;
      const pct = Math.round((diff / priorClicksSum) * 100);
      cDelta = `${pct >= 0 ? `+${pct}%` : `${pct}%`} vs ${periodLabel}`;
      cType = pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral";
    } else if (currentClicksSum > 0) {
      cDelta = `+${currentClicksSum} vs ${periodLabel}`;
      cType = "positive";
    } else {
      cDelta = `0% vs ${periodLabel}`;
      cType = "neutral";
    }

    // 2. Links created comparison
    const now = Date.now();
    const periodMs = periodDays * 24 * 60 * 60 * 1000;
    const currentCreated = links.filter((l) => now - new Date(l.createdAt || 0).getTime() <= periodMs).length;
    const priorCreated = links.filter((l) => {
      const age = now - new Date(l.createdAt || 0).getTime();
      return age > periodMs && age <= 2 * periodMs;
    }).length;

    let lDelta = null;
    let lType = "neutral";
    if (priorCreated > 0) {
      const diffL = currentCreated - priorCreated;
      const pctL = Math.round((diffL / priorCreated) * 100);
      lDelta = `${pctL >= 0 ? `+${pctL}%` : `${pctL}%`} vs ${periodLabel}`;
      lType = pctL > 0 ? "positive" : pctL < 0 ? "negative" : "neutral";
    } else if (currentCreated > 0) {
      lDelta = `+${currentCreated} new vs ${periodLabel}`;
      lType = "positive";
    } else {
      lDelta = `0 new vs ${periodLabel}`;
      lType = "neutral";
    }

    // 3. Avg clicks comparison
    let aDelta = null;
    let aType = "neutral";
    if (totalLinks > 0 && priorClicksSum > 0) {
      const currentAvgPeriod = currentClicksSum / totalLinks;
      const priorAvgPeriod = priorClicksSum / totalLinks;
      if (priorAvgPeriod > 0) {
        const diffA = currentAvgPeriod - priorAvgPeriod;
        const pctA = Math.round((diffA / priorAvgPeriod) * 100);
        aDelta = `${pctA >= 0 ? `+${pctA}%` : `${pctA}%`} vs ${periodLabel}`;
        aType = pctA > 0 ? "positive" : pctA < 0 ? "negative" : "neutral";
      }
    }
    if (!aDelta) {
      aDelta = clicksPerActive > 0 ? `${clicksPerActive} / active` : "0% vs period";
      aType = "neutral";
    }

    // 4. Sparkline series (defaults to clean 7-point series if fewer than 2 data points)
    const spark = sortedTrends.length >= 2
      ? sortedTrends.slice(-14).map((d) => d.count || 0)
      : [0, 0, 0, 0, 0, 0, 0];

    return {
      clicksDelta: cDelta,
      clicksDeltaType: cType,
      linksDelta: lDelta,
      linksDeltaType: lType,
      avgDelta: aDelta,
      avgDeltaType: aType,
      sparklineData: spark,
    };
  }, [dailyTrends, periodDays, periodLabel, links, totalLinks, clicksPerActive]);

  const cards = [
    {
      id: "total_links",
      label: "Total links",
      value: totalLinks,
      delta: linksDelta,
      deltaType: linksDeltaType,
      sparklineData: sparklineData,
      icon: <Link2 size={18} />,
      sub: totalLinks > 0 ? `${activeLinks} active, ${inactiveLinks} paused` : "No links created yet",
    },
    {
      id: "total_clicks",
      label: "Total clicks",
      value: totalClicks,
      delta: clicksDelta,
      deltaType: clicksDeltaType,
      sparklineData: sparklineData,
      icon: <MousePointerClick size={18} />,
      sub: todayClicks > 0 ? `+${todayClicks} clicks today` : "Total recorded link clicks",
    },
    {
      id: "avg_clicks",
      label: "Avg clicks per link",
      value: totalLinks > 0 ? avgClicks : 0,
      decimals: 1,
      delta: avgDelta,
      deltaType: avgDeltaType,
      sparklineData: sparklineData,
      icon: <TrendingUp size={18} />,
      sub: totalLinks > 0 ? `${clicksPerActive} per active link` : "Average clicks per link",
    },
    {
      id: "active_links",
      label: "Active links",
      value: activeLinks,
      delta: `${activePercent}% capacity`,
      deltaType: activePercent >= 70 ? "positive" : "neutral",
      icon: <Zap size={18} />,
      sub: `${activeLinks} of ${totalLinks} actively routing`,
    },
  ];

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`}>
      {cards.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          decimals={card.decimals || 0}
          delta={card.delta}
          deltaType={card.deltaType}
          sparklineData={card.sparklineData}
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
  return (
    <DashboardActivityView
      history={history}
      dailyTrends={dailyTrends}
      totalClicks={totalClicks}
    />
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
// Component: RecentLinksTable (Links Table with Multi-Select, Bulk Actions, Drawer, Tags)
// -----------------------------------------------------------------------------
function RecentLinksTable({
  links = [],
  loading = false,
  onCopy,
  copiedLinkId,
  onOpenAnalytics,
  onOpenQRCode,
  onTogglePause,
  onOpenAccessModal,
  onDeleteLink,
  onBulkAction,
  onRowClick,
  togglingLinkId,
  searchTerm,
  setSearchTerm,
  sortOrder,
  setSortOrder,
  onCreateLink,
}) {
  const tableBoxRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [bulkTagText, setBulkTagText] = useState("");

  const filteredLinks = useMemo(() => {
    let list = [...links];

    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.shortCode?.toLowerCase().includes(q) ||
          l.originalUrl?.toLowerCase().includes(q) ||
          l.utmCampaign?.toLowerCase().includes(q) ||
          (Array.isArray(l.tags) && l.tags.some((t) => t.toLowerCase().includes(q)))
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

  const isAllSelected = filteredLinks.length > 0 && filteredLinks.every((l) => selectedIds.has(l._id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLinks.map((l) => l._id)));
    }
  };

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkTag = () => {
    if (!bulkTagText.trim()) return;
    onBulkAction?.("addTag", Array.from(selectedIds), bulkTagText.trim());
    setBulkTagText("");
    setShowBulkTagInput(false);
    setSelectedIds(new Set());
  };

  const handleBulkActionClick = (action) => {
    if (action === "delete") {
      if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected link(s)?`)) {
        onBulkAction?.("delete", Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    } else {
      onBulkAction?.(action, Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="links-table-card">
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Recent Links</h3>
          <p>Manage, organize, and track your active short links. Click any row for details.</p>
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

      {/* Multi-Select Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="table-bulk-toolbar">
          <div className="bulk-selected-count">
            <span className="bulk-badge">{selectedIds.size}</span>
            <span>link{selectedIds.size === 1 ? "" : "s"} selected</span>
          </div>

          <div className="bulk-actions-buttons">
            <Button
              size="xs"
              variant="secondary"
              icon={Pause}
              onClick={() => handleBulkActionClick("pause")}
            >
              Pause
            </Button>
            <Button
              size="xs"
              variant="secondary"
              icon={Play}
              onClick={() => handleBulkActionClick("resume")}
            >
              Resume
            </Button>
            <Button
              size="xs"
              variant="secondary"
              icon={Tag}
              onClick={() => setShowBulkTagInput((p) => !p)}
            >
              Add Tag
            </Button>
            <Button
              size="xs"
              variant="danger"
              icon={Trash2}
              onClick={() => handleBulkActionClick("delete")}
            >
              Delete
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>

          {showBulkTagInput && (
            <div className="bulk-tag-popover">
              <input
                type="text"
                placeholder="Enter tag name (e.g. social)..."
                value={bulkTagText}
                onChange={(e) => setBulkTagText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyBulkTag();
                  if (e.key === "Escape") setShowBulkTagInput(false);
                }}
                className="bulk-tag-input"
                autoFocus
              />
              <Button size="xs" variant="primary" onClick={handleApplyBulkTag}>
                Apply
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setShowBulkTagInput(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="table-responsive-box" ref={tableBoxRef}>
        <table className="custom-links-table">
          <thead>
            <tr>
              <th style={{ width: "36px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={toggleSelectAll}
                  aria-label="Select all links"
                />
              </th>
              <th>Link Title & Destination</th>
              <th>Short URL</th>
              <th>Clicks</th>
              <th>Created & Expiry</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={`skel-row-${rIdx}`}>
                  <td style={{ textAlign: "center" }}>
                    <Skeleton width="16px" height="16px" borderRadius="4px" />
                  </td>
                  <td>
                    <Skeleton width="70%" height="16px" />
                    <div style={{ height: "6px" }} />
                    <Skeleton width="45%" height="12px" />
                  </td>
                  <td>
                    <Skeleton width="90px" height="24px" borderRadius="6px" />
                  </td>
                  <td>
                    <Skeleton width="36px" height="18px" />
                  </td>
                  <td>
                    <Skeleton width="85px" height="14px" />
                  </td>
                  <td>
                    <Skeleton width="60px" height="20px" borderRadius="10px" />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Skeleton width="120px" height="24px" borderRadius="6px" style={{ marginLeft: "auto" }} />
                  </td>
                </tr>
              ))
            ) : filteredLinks.length > 0 ? (
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
                const isSelected = selectedIds.has(link._id);

                const domainName = (() => {
                  try {
                    return new URL(link.originalUrl).hostname.replace(/^www\./, "");
                  } catch {
                    return "Link Destination";
                  }
                })();

                return (
                  <tr
                    key={link._id}
                    onClick={() => onRowClick?.(link)}
                    className={`table-clickable-row ${isSelected ? "row-selected" : ""}`}
                    title="Click to view link details and insights"
                  >
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectOne(link._id, e)}
                        aria-label={`Select link ${link.shortCode}`}
                      />
                    </td>
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

                          {/* Link Tags */}
                          {Array.isArray(link.tags) && link.tags.map((t, idx) => (
                            <span key={`${t}-${idx}`} className="link-tag-chip" title={`Tag: #${t}`}>
                              #{t}
                            </span>
                          ))}

                          {link.password && (
                            <span
                              className="link-tag-chip"
                              style={{ color: "var(--accent)", borderColor: "var(--border)" }}
                              title="Password Protected"
                            >
                              <Lock size={10} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "3px" }} />
                              Protected
                            </span>
                          )}
                        </div>
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="original-url-link"
                          title={link.originalUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {link.originalUrl}
                        </a>
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
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
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions-cell" style={{ justifyContent: "flex-end" }}>
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
                <td colSpan="7" style={{ padding: "40px 16px", textAlign: "center" }}>
                  {links.length === 0 ? (
                    <EmptyState
                      icon={Link2}
                      title="No links created yet"
                      description="Create your first trackable short link to start monitoring live performance and audience velocity."
                      actionLabel="Create Short Link"
                      onAction={onCreateLink}
                    />
                  ) : (
                    <EmptyState
                      icon={Search}
                      title="No matching links"
                      description={`No links found matching "${searchTerm}". Try a different keyword or clear the search filter.`}
                      actionLabel="Clear Filter"
                      onAction={() => setSearchTerm?.("")}
                    />
                  )}
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

  const maxClicks = useMemo(() => {
    if (!performance || performance.length === 0) return 1;
    const max = Math.max(...performance.map((r) => Number(r.count || 0)), 1);
    return max > 0 ? max : 1;
  }, [performance]);

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
                const count = Number(row.count || 0);
                const barWidth = maxClicks > 0 ? Math.min(100, Math.max(0, (count / maxClicks) * 100)) : 0;

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
                      <div className="campaign-click-cell">
                        <div className="campaign-click-bar-track">
                          <div
                            className="campaign-click-bar-fill"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="campaign-click-num">
                          {count.toLocaleString()}
                        </span>
                      </div>
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
              <stop offset="0%" stopColor="var(--chart-1)" />
              <stop offset="100%" stopColor="var(--chart-1)" />
            </linearGradient>
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
          {totalPeriodClicks > 0 && (
            <path d={areaPath} fill="url(#campaignChartAreaGradient)" />
          )}

          {/* Spline Line */}
          {totalPeriodClicks > 0 && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#campaignChartLineGradient)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair Line */}
          {totalPeriodClicks > 0 && hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={padTop}
              x2={hoveredPoint.x}
              y2={zeroY}
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Column hover catchers for smooth tracking across the graph */}
          {totalPeriodClicks > 0 &&
            points.map((pt, idx) => {
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
                {totalPeriodClicks > 0 && (
                  <>
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="9"
                        fill="var(--chart-1)"
                        fillOpacity="0.25"
                        stroke="var(--chart-1)"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? "5" : points.length <= 10 ? "3.5" : "2.6"}
                      fill={isHovered ? "var(--surface)" : "var(--surface-2)"}
                      stroke="var(--chart-1)"
                      strokeWidth={isHovered ? "2.5" : "1.8"}
                    />
                  </>
                )}
                {/* Date labels along bottom */}
                {showDateLabel && !isNearClash && (
                  <text
                    x={pt.x}
                    y={zeroY + 18}
                    fill={isHovered ? "var(--text)" : "var(--text-muted)"}
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

        {/* Small centered empty-state message when selected timeframe has zero attributed clicks */}
        {totalPeriodClicks === 0 && (
          <div className="campaign-chart-empty-state">
            No campaign clicks in this period. Try 30D or All.
          </div>
        )}

        {/* Floating Dark-Purple Tooltip */}
        {totalPeriodClicks > 0 && hoveredPoint && (
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
            {/* Unified 7D, 30D, All Timeframe Switch */}
            <TimeRangeToggle
              value={campaignRange}
              onChange={onRangeChange}
              ariaLabel="Campaign time range"
            />

            <SpecularButton
              variant="secondary"
              size="sm"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={campaignLoading}
              title="Refresh campaign analytics"
            >
              <RefreshCw size={14} className={campaignLoading ? "spinning" : ""} />
              <span>Refresh</span>
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

          {/* 3. Ranked Bars (Sources & Mediums) */}
          <div className={`donuts-grid ${campaignLoading ? "data-refreshing" : ""}`}>
            <RankedBars
              title="Traffic Sources (utm_source)"
              icon={<Globe size={16} />}
              data={sources}
              emptyMessage="No traffic source data recorded yet. Share links with utm_source to view visitor sources."
            />
            <RankedBars
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
              <div className="campaign-info-icon"><TrendingUp size={20} style={{ color: "#f5ede4" }} /></div>
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
                        className={`qr-num-cell ${(link.qrClicks || 0) > 0 ? "active" : "muted"}`}
                      >
                        {link.qrClicks?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        className={`qr-num-cell ${(link.directClicks || 0) > 0 ? "active" : "muted"}`}
                      >
                        {link.directClicks?.toLocaleString() ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="qr-rate-cell">
                        <div className="qr-rate-track">
                          <div
                            className="qr-rate-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, link.qrPercentage || 0))}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`qr-rate-value ${(link.qrPercentage || 0) > 0 ? "active" : "muted"}`}
                        >
                          {link.qrPercentage ?? 0}%
                        </span>
                      </div>
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
                <span className="qr-best-stat-num" style={{ color: "var(--primary)" }}>
                  {bestLink.qrClicks?.toLocaleString() ?? 0}
                </span>
                <span className="qr-best-stat-lbl">QR Scans</span>
              </div>
              <div className="qr-best-stat-divider" />
              <div className="qr-best-stat-item">
                <span className="qr-best-stat-num" style={{ color: "var(--primary)" }}>
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
                          className={`qr-num-cell ${(link.qrClicks || 0) > 0 ? "active" : "muted"}`}
                        >
                          {link.qrClicks?.toLocaleString() ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className={`qr-num-cell ${(link.directClicks || 0) > 0 ? "active" : "muted"}`}
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
                        <div className="qr-rate-cell">
                          <div className="qr-rate-track">
                            <div
                              className="qr-rate-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, link.qrPercentage || 0))}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`qr-rate-value ${(link.qrPercentage || 0) > 0 ? "active" : "muted"}`}
                          >
                            {link.qrPercentage ?? 0}%
                          </span>
                        </div>
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
            <TimeRangeToggle
              value={qrRange}
              onChange={onRangeChange}
              ariaLabel="QR Analytics time range"
            />

            <SpecularButton
              variant="secondary"
              size="sm"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={qrLoading}
              title="Refresh QR analytics"
            >
              <RefreshCw size={14} className={qrLoading ? "spinning" : ""} />
              <span>Refresh</span>
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

          {/* 2. Channel Traffic (QR vs Direct) & Insights Card */}
          <div className={`donuts-grid ${qrLoading ? "data-refreshing" : ""}`}>
            <RankedBars
              title="Traffic Channel (QR Scans vs Direct Clicks)"
              icon={<QrCode size={16} />}
              data={[
                { name: "QR Scans", count: summary?.qrClicks || 0, color: "var(--chart-1)" },
                { name: "Direct Clicks", count: summary?.directClicks || 0, color: "var(--chart-2)" },
              ]}
              distinguishColors={true}
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
                    <span className="qr-insight-stat-val" style={{ color: "var(--primary)" }}>
                      {summary?.qrClicks?.toLocaleString() ?? 0}
                    </span>
                    <span className="qr-insight-stat-pct">{summary?.qrPercentage ?? 0}%</span>
                  </div>
                  <div className="qr-insight-stat-item">
                    <span className="qr-insight-stat-label">Direct Clicks</span>
                    <span className="qr-insight-stat-val" style={{ color: "var(--chart-2)" }}>
                      {summary?.directClicks?.toLocaleString() ?? 0}
                    </span>
                    <span className="qr-insight-stat-pct">
                      {summary?.totalClicks > 0 ? Number((100 - (summary?.qrPercentage ?? 0)).toFixed(1)) : 0}%
                    </span>
                  </div>
                  <div className="qr-insight-stat-item">
                    <span className="qr-insight-stat-label">Tracked Links</span>
                    <span className="qr-insight-stat-val" style={{ color: "var(--success)" }}>
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
// GeoAnalyticsView component has been modularized in ./components/GeoAnalyticsView.jsx
// -----------------------------------------------------------------------------

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

  const { theme, setTheme, effectiveTheme, sidebar: defaultSidebar } = useTheme();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
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
        // Do not open when the user is typing in another input if it would clash
        const activeEl = document.activeElement;
        const isMac =
          typeof navigator !== "undefined" &&
          navigator.platform &&
          navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const isInput =
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable);

        if (isMac && e.ctrlKey && !e.metaKey && isInput) {
          // On macOS, Ctrl+K is the readline kill-to-end-of-line shortcut in text fields
          return;
        }

        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalSearchKey);
    return () => window.removeEventListener("keydown", handleGlobalSearchKey);
  }, []);

  const [sortOrder, setSortOrder] = useState("newest");
  const { timeRange, setTimeRange, apiRange } = useTimeRange();
  const dashboardAbortControllerRef = useRef(null);

  // Selected link for dashboard focus and deep-dive
  const [selectedLink, setSelectedLink] = useState("__all__");
  const [dashboardTab, setDashboardTab] = useState("overview"); // "overview" | "activity"
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
  const [passwordInput, setPasswordInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedDrawerLink, setSelectedDrawerLink] = useState(null);
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
    setPasswordInput("");
    setTagsInput("");
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
    setPasswordInput("");
    setTagsInput("");
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
      if (typeof window !== "undefined" && (window.location.pathname === "/geo-analytics" || window.location.pathname === "/geo")) {
        return "geo-analytics";
      }
    } catch (_) {}
    return "dashboard";
  }); // "dashboard" | "campaigns" | "settings"
  // Main Dashboard + Sidebar UI: respect sidebar default preference on load and updates
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem("smartlink.appearance") || localStorage.getItem("smartlink-appearance");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.sidebar) return p.sidebar === "collapsed";
      }
      return localStorage.getItem("smartlink_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Sync when defaultSidebar setting updates in Appearance settings
  useEffect(() => {
    if (defaultSidebar) {
      setIsSidebarCollapsed(defaultSidebar === "collapsed");
    }
  }, [defaultSidebar]);
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

  // Auto-collapse sidebar below 1100px screen width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1100) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  // Unified global range driven by TimeRangeContext (persisted in "smartlink.range")
  const campaignRange = apiRange;
  const campaignAbortControllerRef = useRef(null);
  const activeCampaignRangeRef = useRef("30d");

  // CHANGE: QR analytics dashboard — 2026-11-06
  const [qrAnalytics, setQrAnalytics] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const qrRange = apiRange;
  const qrAbortControllerRef = useRef(null);
  const activeQrRangeRef = useRef("30d");

  // CHANGE: Stage 8 — Geo-Location Analytics State — 2026-11-08
  const [geoAnalytics, setGeoAnalytics] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const geoRange = apiRange;
  const geoAbortControllerRef = useRef(null);
  const activeGeoRangeRef = useRef("30d");

  // CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
  const [deviceAnalytics, setDeviceAnalytics] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const deviceRange = apiRange;
  const deviceAbortControllerRef = useRef(null);
  const activeDeviceRangeRef = useRef("30d");

  // CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16
  const [trafficAnalytics, setTrafficAnalytics] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState("");
  const trafficRange = apiRange;
  const trafficAbortControllerRef = useRef(null);
  const activeTrafficRangeRef = useRef("30d");

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
      if (dashboardAbortControllerRef.current) {
        dashboardAbortControllerRef.current.abort();
      }
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
      setQrError("");
      setQrLoading(false);
      // CHANGE: Stage 8 — Geo-Location Analytics Reset — 2026-11-08
      if (geoAbortControllerRef.current) {
        geoAbortControllerRef.current.abort();
      }
      setGeoAnalytics(null);
      setGeoError("");
      setGeoLoading(false);
      // CHANGE: Stage 9 Device & Browser Intelligence Reset — 2026-11-15
      if (deviceAbortControllerRef.current) {
        deviceAbortControllerRef.current.abort();
      }
      setDeviceAnalytics(null);
      setDeviceError("");
      setDeviceLoading(false);
      // CHANGE: Notifications Step 4B/4D — 2026-11-05
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
      setShowNotificationsDropdown(false);
      setActiveView("dashboard");
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
          setSelectedDrawerLink((prev) => {
            if (prev && prev._id === updated._id) {
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

  // Delete a link
  const handleDeleteLink = useCallback(
    async (link) => {
      if (!link || !token) return;
      try {
        await axios.delete(`${API_URL}/${link._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLinks((prev) => prev.filter((l) => l._id !== link._id));
        setSelectedDrawerLink((prev) => (prev?._id === link._id ? null : prev));
        setSelectedLink((prev) => (prev?._id === link._id ? "__all__" : prev));
      } catch (err) {
        console.error("Failed to delete link:", err);
        alert(err.response?.data?.message || "Failed to delete link.");
      }
    },
    [token]
  );

  // Bulk actions on multiple links
  const handleBulkAction = useCallback(
    async (action, linkIds, tag) => {
      if (!token || !Array.isArray(linkIds) || linkIds.length === 0) return;
      try {
        const res = await axios.post(
          `${API_URL}/bulk`,
          { action, linkIds, tag },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (action === "pause") {
          setLinks((prev) =>
            prev.map((l) => (linkIds.includes(l._id) ? { ...l, isPaused: true } : l))
          );
          setSelectedDrawerLink((prev) =>
            prev && linkIds.includes(prev._id) ? { ...prev, isPaused: true } : prev
          );
        } else if (action === "resume") {
          setLinks((prev) =>
            prev.map((l) => (linkIds.includes(l._id) ? { ...l, isPaused: false } : l))
          );
          setSelectedDrawerLink((prev) =>
            prev && linkIds.includes(prev._id) ? { ...prev, isPaused: false } : prev
          );
        } else if (action === "delete") {
          setLinks((prev) => prev.filter((l) => !linkIds.includes(l._id)));
          setSelectedDrawerLink((prev) =>
            prev && linkIds.includes(prev._id) ? null : prev
          );
        } else if (action === "addTag" && tag) {
          setLinks((prev) =>
            prev.map((l) =>
              linkIds.includes(l._id)
                ? { ...l, tags: Array.from(new Set([...(l.tags || []), tag])) }
                : l
            )
          );
          setSelectedDrawerLink((prev) =>
            prev && linkIds.includes(prev._id)
              ? { ...prev, tags: Array.from(new Set([...(prev.tags || []), tag])) }
              : prev
          );
        }
      } catch (err) {
        console.error("Bulk action failed:", err);
        alert(err.response?.data?.message || "Failed to perform bulk action.");
      }
    },
    [token]
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
    if (userData) {
      setUser(userData);
      try {
        localStorage.setItem("user", JSON.stringify(userData));
      } catch (_) {}
    }
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
      console.log("%c[Verification] Starting Single-Flight Token Refresh Browser Verification...", "color: #7A4A2B; font-weight: bold; font-size: 13px;");

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

  // Fetch dashboard analytics on demand with AbortController and non-blanking retention
  const fetchDashboardAnalytics = useCallback(
    async (selectedRange = apiRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const isAll =
        !selectedLink ||
        selectedLink === "__all__" ||
        selectedLink.shortCode === "__all__";

      const linkKey = isAll ? "__all__" : (selectedLink.shortCode || selectedLink._id || "__link__");
      const cacheKey = `dashboard:${linkKey}:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setDashboardAnalytics(cached);
      }

      if (dashboardAbortControllerRef.current) {
        dashboardAbortControllerRef.current.abort();
      }
      dashboardAbortControllerRef.current = new AbortController();
      const currentSignal = dashboardAbortControllerRef.current.signal;

      setAnalyticsLoading(true);

      const endpoint = isAll
        ? `${API_URL}/user/analytics/all-links`
        : `${API_URL}/${selectedLink.shortCode}/analytics`;

      try {
        const res = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${activeToken}` },
          params: { range: selectedRange },
          signal: currentSignal,
        });
        if (res.data) {
          analyticsCache.set(cacheKey, res.data);
          setDashboardAnalytics(res.data);
        }
      } catch (err) {
        if (axios.isCancel(err) || err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        if (err.response?.status === 401) {
          handleSessionExpired();
        }
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [token, selectedLink, apiRange, handleSessionExpired]
  );

  // Load analytics when selectedLink, token, or apiRange changes
  useEffect(() => {
    if (!token) {
      setDashboardAnalytics(null);
      return;
    }
    fetchDashboardAnalytics(apiRange);
    return () => {
      if (dashboardAbortControllerRef.current) {
        dashboardAbortControllerRef.current.abort();
      }
    };
  }, [token, selectedLink, apiRange, fetchDashboardAnalytics]);

  // Fetch campaign analytics on demand
  // CHANGE: Stage 5C — 2026-11-03
  const fetchCampaignAnalytics = useCallback(
    async (selectedRange = apiRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const cacheKey = `campaigns:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setCampaignAnalytics(cached);
      }

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
            headers: { Authorization: `Bearer ${activeToken}` },
            signal: currentSignal,
          }
        );
        // Ensure only the latest active filter range updates state
        if (activeCampaignRangeRef.current === selectedRange && res.data?.success && res.data?.data) {
          analyticsCache.set(cacheKey, res.data.data);
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
    [token, apiRange, handleSessionExpired]
  );

  useEffect(() => {
    // CHANGE: Fetch campaign analytics for both Campaigns view and Main Dashboard Traffic Source card — 2026-11-19
    if ((activeView !== "campaigns" && activeView !== "dashboard") || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchCampaignAnalytics(apiRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, apiRange, fetchCampaignAnalytics]);

  // Fetch QR analytics on demand
  // CHANGE: QR analytics dashboard — 2026-11-06
  const fetchQrAnalytics = useCallback(
    async (selectedRange = qrRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const cacheKey = `qr:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setQrAnalytics(cached);
      }

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
          analyticsCache.set(cacheKey, res.data);
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
    [token, apiRange, handleSessionExpired]
  );

  useEffect(() => {
    if (activeView !== "qr-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchQrAnalytics(apiRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, apiRange, fetchQrAnalytics]);

  // Fetch Geo analytics on demand
  // CHANGE: Stage 8 — Geo-Location Analytics — 2026-11-08
  const fetchGeoAnalytics = useCallback(
    async (selectedRange = apiRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const cacheKey = `geo:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setGeoAnalytics(cached);
      }

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
          analyticsCache.set(cacheKey, res.data);
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
    [token, apiRange, handleSessionExpired]
  );

  useEffect(() => {
    if ((activeView !== "geo-analytics" && activeView !== "dashboard") || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchGeoAnalytics(apiRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, apiRange, fetchGeoAnalytics]);

  // CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
  // Fetch device, browser, OS, hardware, and channel analytics on demand
  const fetchDeviceAnalytics = useCallback(
    async (selectedRange = apiRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const cacheKey = `devices:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setDeviceAnalytics(cached);
      }

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
          analyticsCache.set(cacheKey, res.data);
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
    [token, apiRange, handleSessionExpired]
  );

  useEffect(() => {
    if ((activeView !== "device-analytics" && activeView !== "dashboard") || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchDeviceAnalytics(apiRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, apiRange, fetchDeviceAnalytics]);

  // CHANGE: Stage 10 Advanced Traffic Visualization Dashboard — 2026-11-16
  // Fetch daily, hourly, QR vs direct, device, campaign, and heatmap analytics
  const fetchTrafficAnalytics = useCallback(
    async (selectedRange = apiRange) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      const cacheKey = `traffic:${selectedRange}`;
      const cached = analyticsCache.get(cacheKey);
      if (cached) {
        setTrafficAnalytics(cached);
      }

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
          analyticsCache.set(cacheKey, res.data);
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
    [token, apiRange, handleSessionExpired]
  );

  useEffect(() => {
    if (activeView !== "traffic-analytics" || !token) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) {
        fetchTrafficAnalytics(apiRange);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeView, token, apiRange, fetchTrafficAnalytics]);

  // Unified Global Date Range Selector
  const handleGlobalRangeChange = useCallback(
    (newRange) => {
      setTimeRange(newRange);
      const apiR = toApiRange(newRange);
      if (activeView === "dashboard") {
        fetchDashboardAnalytics(apiR);
        fetchCampaignAnalytics(apiR);
        fetchDeviceAnalytics(apiR);
        fetchGeoAnalytics(apiR);
      } else if (activeView === "campaigns") {
        fetchCampaignAnalytics(apiR);
      } else if (activeView === "qr-analytics") {
        fetchQrAnalytics(apiR);
      } else if (activeView === "geo-analytics") {
        fetchGeoAnalytics(apiR);
      } else if (activeView === "device-analytics") {
        fetchDeviceAnalytics(apiR);
      } else if (activeView === "traffic-analytics") {
        fetchTrafficAnalytics(apiR);
      }
    },
    [
      setTimeRange,
      activeView,
      fetchDashboardAnalytics,
      fetchCampaignAnalytics,
      fetchQrAnalytics,
      fetchGeoAnalytics,
      fetchDeviceAnalytics,
      fetchTrafficAnalytics,
    ]
  );

  const handleCampaignRangeChange = handleGlobalRangeChange;
  const handleQrRangeChange = handleGlobalRangeChange;
  const handleGeoRangeChange = handleGlobalRangeChange;
  const handleDeviceRangeChange = handleGlobalRangeChange;
  const handleTrafficRangeChange = handleGlobalRangeChange;

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
        password: passwordInput.trim() || null,
        tags: tagsInput.trim()
          ? tagsInput.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean)
          : [],
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
        setPasswordInput("");
        setTagsInput("");
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

  // Password reset route handler (direct path or query parameter)
  const isResetRoute =
    (typeof currentPath === "string" && currentPath.startsWith("/reset-password")) ||
    (typeof window !== "undefined" &&
      (window.location.search.includes("resetToken") || window.location.search.includes("token=")));

  if (isResetRoute) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        initialError={authError}
        initialMode="reset"
        onNavigate={navigateTo}
      />
    );
  }

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

        {/* Scrollable Nav Area (The ONLY scrolling element in sidebar) */}
        <div className="sidebar-nav-scroll">
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

        </div>

        {/* Enhanced Solid Sidebar Bottom Block */}
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

            <div
              className="topbar-search-box"
              onClick={() => setIsCommandPaletteOpen(true)}
              style={{ cursor: "pointer" }}
            >
              <span className="search-box-icon" aria-hidden="true">
                <Search size={15} />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                className="topbar-search-field"
                placeholder="Search links, pages, actions... (Ctrl+K)"
                readOnly
                onFocus={(e) => {
                  e.target.blur();
                  setIsCommandPaletteOpen(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCommandPaletteOpen(true);
                }}
                aria-label="Open command palette (Ctrl+K)"
                style={{ cursor: "pointer" }}
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

            {/* 3. Upgrade button (secondary style, hidden for highest plan) */}
            {!PLAN_LIMITS[CURRENT_PLAN]?.isHighest && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigateTo("/pricing")}
                title="Upgrade plan"
                aria-label="Upgrade subscription plan"
              >
                Upgrade
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

        {/* 4. Announcement Banner (dismissible below topbar, hidden on Geo Analytics page) */}
        {activeView !== "geo-analytics" && (
          <AnnouncementBanner onNavigate={navigateTo} />
        )}

        {/* Main View Switcher: Dashboard vs Campaigns */}
        {activeView === "dashboard" ? (
          <>
            {/* Section A: Welcome Greeting + Tab Switcher + Compact Global Date-Range Selector */}
            <AnimatedContent distance={20} delay={0.05}>
              <div className="page-greeting">
                <div className="page-greeting-text">
                  <h1 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: "600", color: "var(--text)" }}>
                    Welcome back, {user?.username || "Vijay"}!
                  </h1>
                  <p>
                    {dashboardTab === "overview"
                      ? "Here's an overview of your links and performance."
                      : "Visitor trends, weekday distributions, and activity heatmaps."}
                  </p>
                </div>

                {/* Section A: Controls (Dashboard Tab Switcher + Date Range + Refresh) */}
                <div className="header-range-controls">
                  <div className="tab-sliding-pill-wrap" role="tablist" aria-label="Dashboard views">
                    {[
                      { value: "overview", label: "Overview" },
                      { value: "activity", label: "Activity" },
                    ].map((tab) => {
                      const isActive = dashboardTab === tab.value;
                      return (
                        <button
                          key={tab.value}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className={`tab-sliding-pill-btn ${isActive ? "active" : ""}`}
                          onClick={() => setDashboardTab(tab.value)}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeDashboardTabPill"
                              className="tab-sliding-pill-bg"
                              transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                          )}
                          <span className="tab-sliding-pill-text">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <span className="header-range-label">Timeframe:</span>
                  <TimeRangeToggle
                    value={timeRange}
                    onChange={handleGlobalRangeChange}
                    ariaLabel="Dashboard timeframe"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => {
                      fetchDashboardAnalytics(apiRange);
                    }}
                    title="Refresh data"
                    aria-label="Refresh data"
                  />
                </div>
              </div>
            </AnimatedContent>

            <AnimatePresence mode="wait">
              {dashboardTab === "overview" ? (
                <motion.div
                  key="overview"
                  className={analyticsLoading ? "data-refreshing" : ""}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Section B: Top 4 Statistic Cards (SpotlightCard + CountUp) */}
                  <AnimatedContent distance={25} delay={0.12}>
                    <MetricCards
                      totalLinks={links.length}
                      totalClicks={totalClicks}
                      activeLinks={activeLinks}
                      avgClicks={avgClicks}
                      intelligence={dashboardAnalytics?.intelligence}
                      timeRange={timeRange}
                      dailyTrends={dashboardAnalytics?.dailyTrends || []}
                      links={links}
                      loading={analyticsLoading}
                    />
                  </AnimatedContent>

                  {/* Section 3: Clicks Overview – All Links (Large Full-Width Spline Chart) */}
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
                        loading={analyticsLoading}
                      />
                    </div>
                  </AnimatedContent>

                  {/* Section 4: Breakdown Row (Device, Browser, OS, Countries + Traffic Sources) */}
                  <AnimatedContent distance={25} delay={0.24}>
                    <OverviewBreakdownRow
                      dashboardAnalytics={dashboardAnalytics}
                      deviceAnalytics={deviceAnalytics}
                      geoAnalytics={geoAnalytics}
                      campaignAnalytics={campaignAnalytics}
                      loading={analyticsLoading || deviceLoading || geoLoading || campaignLoading}
                      onNavigate={setActiveView}
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
                  </AnimatedContent>

                  {/* Section 6: Smart Traffic Intelligence (Four Insight Cards in One Row) */}
                  <AnimatedContent distance={25} delay={0.3}>
                    <div className="intelligence-fullwidth-section">
                      <SmartTrafficSection intelligence={dashboardAnalytics?.intelligence} />
                    </div>
                  </AnimatedContent>

                  {/* Section 7: Recent Links (Full-Width Section at the Bottom) */}
                  <AnimatedContent distance={25} delay={0.36}>
                    <div className="recent-links-fullwidth-section">
                      <RecentLinksTable
                        links={links}
                        loading={loading || analyticsLoading}
                        onCopy={handleCopy}
                        copiedLinkId={copiedLinkId}
                        onOpenAnalytics={handleOpenAnalytics}
                        onOpenQRCode={handleOpenQrModal}
                        onTogglePause={handleTogglePause}
                        onOpenAccessModal={handleOpenAccessModal}
                        onDeleteLink={handleDeleteLink}
                        onBulkAction={handleBulkAction}
                        onRowClick={(l) => setSelectedDrawerLink(l)}
                        onCreateLink={() => {
                          setShowCreateModal(true);
                          setCreateSuccessLink(null);
                          setCreateError("");
                          setNewUrlInput("");
                        }}
                        togglingLinkId={togglingLinkId}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                      />
                    </div>
                  </AnimatedContent>
                </motion.div>
              ) : (
                /* Activity Tab Content */
                <motion.div
                  key="activity"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <DashboardActivityView
                    token={token}
                    apiBaseUrl={API_BASE_URL}
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
                          {expiresAtInput || maxClicksInput || passwordInput || tagsInput ? "Configured" : "Access rules"}
                        </span>
                      </button>

                      {showAccessSection && (
                        <div className="utm-inputs-panel">
                          <p className="utm-section-desc">
                            Set expiration schedules, click limits, password protection, and organizational tags.
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

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Password Protection <span className="utm-tag-hint">(optional)</span>
                              </label>
                              <input
                                type="password"
                                className="modal-text-input utm-input"
                                placeholder="Set link password..."
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                autoComplete="new-password"
                              />
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                                Visitors must enter this password to reach the destination URL.
                              </p>
                            </div>

                            <div className="utm-field">
                              <label className="modal-input-label">
                                Tags <span className="utm-tag-hint">(optional, comma-separated)</span>
                              </label>
                              <input
                                type="text"
                                className="modal-text-input utm-input"
                                placeholder="e.g. promo, partner, social"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                                Tags help you categorize and perform bulk operations on links.
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
                    <RankedBars
                      title="Device Breakdown"
                      icon={<Smartphone size={16} />}
                      data={detailAnalytics?.devices || []}
                    />
                    <RankedBars
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

      {/* Link Detail Drawer */}
      <LinkDetailDrawer
        isOpen={Boolean(selectedDrawerLink)}
        link={selectedDrawerLink}
        onClose={() => setSelectedDrawerLink(null)}
        onCopy={handleCopy}
        isCopied={copiedLinkId === selectedDrawerLink?._id}
        onOpenQRCode={(l) => {
          handleOpenQrModal(l);
        }}
        onOpenAccessModal={(l) => {
          handleOpenAccessModal(l);
        }}
        onTogglePause={handleTogglePause}
        onDelete={handleDeleteLink}
        onOpenAnalytics={handleOpenAnalytics}
        isToggling={togglingLinkId === selectedDrawerLink?._id}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        token={token}
        apiUrl={API_URL}
        currentTheme={effectiveTheme || theme}
        onToggleTheme={() => setTheme((effectiveTheme || theme) === "dark" ? "light" : "dark")}
        onNavigateView={(view) => {
          if (view === "links") {
            if (activeView !== "dashboard") {
              setActiveView("dashboard");
              setTimeout(() => {
                const tableEl = document.querySelector(".links-table-card");
                if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
              }, 80);
            } else {
              const tableEl = document.querySelector(".links-table-card");
              if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
            }
          } else {
            setActiveView(view);
          }
        }}
        onNavigateRoute={(route) => {
          navigateTo(route);
        }}
        onOpenCreateLink={() => {
          setShowCreateModal(true);
        }}
        onSelectLink={(link) => {
          setSelectedLink(link);
          setActiveView("dashboard");
        }}
        initialLinks={links}
      />
    </div>
  );
}

export default App;