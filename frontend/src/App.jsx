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
import "./App.css";

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

// Default Donut Color Palette
const DONUT_COLORS = [
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#6366F1", // Indigo
  "#64748B", // Slate
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
// Component: MetricCards (Top 4 Statistics)
// -----------------------------------------------------------------------------
function MetricCards({ totalLinks = 0, totalClicks = 0, activeLinks = 0, avgClicks = 0 }) {
  const cards = [
    {
      id: "total_links",
      label: "Total Links",
      value: totalLinks.toLocaleString(),
      badgeText: totalLinks > 0 ? "Active Library" : "No links yet",
      badgeType: totalLinks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
      iconBg: "rgba(124, 58, 237, 0.15)",
      iconColor: "#8B5CF6",
    },
    {
      id: "total_clicks",
      label: "Total Clicks",
      value: totalClicks.toLocaleString(),
      badgeText: totalClicks > 0 ? `↑ ${totalClicks.toLocaleString()} hits` : "Awaiting clicks",
      badgeType: totalClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ),
      iconBg: "rgba(99, 102, 241, 0.15)",
      iconColor: "#6366F1",
    },
    {
      id: "avg_clicks",
      label: "Avg Clicks / Link",
      value: totalLinks > 0 ? avgClicks.toFixed(1) : "0.0",
      badgeText: totalLinks > 0 ? "Engagement Rate" : "Create first link",
      badgeType: avgClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      iconBg: "rgba(6, 182, 212, 0.15)",
      iconColor: "#06B6D4",
    },
    {
      id: "active_links",
      label: "Active Links",
      value: activeLinks.toLocaleString(),
      badgeText: totalLinks > 0 ? `${Math.round((activeLinks / Math.max(1, totalLinks)) * 100)}% Active` : "0% Active",
      badgeType: activeLinks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      iconBg: "rgba(16, 185, 129, 0.15)",
      iconColor: "#10B981",
    },
  ];

  return (
    <div className="metrics-grid">
      {cards.map((card) => (
        <div className="metric-card" key={card.id}>
          <div className="metric-card-top">
            <div className="metric-icon-badge" style={{ background: card.iconBg, color: card.iconColor }}>
              {card.icon}
            </div>
            <span className={`metric-trend-pill ${card.badgeType}`}>{card.badgeText}</span>
          </div>
          <div className="metric-card-val">{card.value}</div>
          <div className="metric-card-label">{card.label}</div>
        </div>
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

  const size = 150;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2 - 4;
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

  return (
    <div className="donut-card">
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
                stroke="rgba(255, 255, 255, 0.05)"
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
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
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
                y="46%"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="18"
                fontWeight="800"
                fontFamily="Inter, sans-serif"
              >
                {activeSlice ? `${activeSlice.pct}%` : total.toLocaleString()}
              </text>
              <text
                x="50%"
                y="62%"
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="10"
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
                  <span>{item.name}</span>
                </div>
                <div className="donut-legend-stats">
                  <span className="legend-val-num">{item.count}</span>
                  <span className="legend-val-pct">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="donut-empty-text">{emptyMessage}</p>
      )}
    </div>
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
// Component: SmartTrafficSection (Spike Alerts & 4 Intel Cards)
// -----------------------------------------------------------------------------
function SmartTrafficSection({ intelligence }) {
  if (!intelligence) return null;

  const { spikeAlert, momentum, cards } = intelligence;

  return (
    <div className="intelligence-section">
      {/* Surge Alert Banner */}
      {intelligence.hasSpike && spikeAlert && (
        <div className={`intelligence-spike-banner severity-${spikeAlert.severity || "moderate"}`} role="alert">
          <div className="spike-banner-content">
            <span className="spike-icon" aria-hidden="true">⚡</span>
            <div className="spike-text">
              <h4>
                {spikeAlert.severity === "high" ? "High Traffic Surge Detected!" : "Traffic Spike Detected!"}
              </h4>
              <p>{spikeAlert.message}</p>
            </div>
          </div>
          <div className="spike-badge">
            +{spikeAlert.percentageIncrease}% Velocity
          </div>
        </div>
      )}

      {/* Header with Momentum Badge */}
      <div className="intelligence-header">
        <div className="intel-heading-group">
          <div className="intel-icon-box" aria-hidden="true">🧠</div>
          <div>
            <h3>Smart Traffic Intelligence</h3>
            <p>Automated spike detection, peak window in IST, and audience strategy</p>
          </div>
        </div>

        {momentum && (
          <span className={`momentum-pill momentum-${momentum.status}`}>
            {momentum.label}
          </span>
        )}
      </div>

      {/* 4 Actionable Insight Cards */}
      <div className="intel-cards-grid">
        {(cards || []).map((card) => (
          <div className="intel-card" key={card.id}>
            <div className="intel-card-top">
              <span className="intel-card-icon" aria-hidden="true">{card.icon}</span>
              <span className="intel-card-title">{card.title}</span>
            </div>
            <div className="intel-card-headline">{card.headline}</div>
            <p className="intel-card-detail">{card.detail}</p>
          </div>
        ))}
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
      icon: "⏸",
      desc: "Link is temporarily paused by owner",
    };
  }
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return {
      status: "Expired",
      label: "Expired",
      className: "expired",
      icon: "⏱",
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
      icon: "🚫",
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

  return (
    <div className="links-table-card">
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Recent Links</h3>
          <p>Shortened links created in your workspace with live click metrics</p>
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

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th>Original URL</th>
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

                return (
                  <tr key={link._id}>
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
                          onClick={() => onCopy(link)}
                          title="Copy short link"
                        >
                          {isCopied ? "✓ Copied" : "Copy"}
                        </button>
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
                          <span className="expiry-icon">⏱</span>
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
                        <button
                          type="button"
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
                        </button>
                        <button
                          type="button"
                          className="btn-action-view btn-action-access"
                          onClick={() => onOpenAccessModal?.(link)}
                          title="Configure access rules, expiration date & click limits"
                          aria-label={`Access settings for ${link.shortCode}`}
                        >
                          <span aria-hidden="true">⚙️</span>
                          <span>Access</span>
                        </button>
                        {/* CHANGE: QR Code Feature Stage 4 — 2026-11-05 */}
                        <button
                          type="button"
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
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => onOpenAnalytics(link)}
                          title="View deep-dive analytics"
                        >
                          <span>📊 Analytics</span>
                        </button>
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
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
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
      label: "Total Campaign Clicks",
      value: attributedClicks.toLocaleString(),
      subtext: `${totalRecordedClicks.toLocaleString()} total clicks (${unattributedClicks.toLocaleString()} untracked)`,
      badgeText: attributedClicks > 0 ? "Attributed Traffic" : "Awaiting clicks",
      badgeType: attributedClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
      iconBg: "rgba(124, 58, 237, 0.15)",
      iconColor: "#8B5CF6",
    },
    {
      id: "total_campaigns",
      label: "Total Campaigns",
      value: totalCampaigns.toLocaleString(),
      subtext: totalCampaigns === 1 ? "1 active campaign" : `${totalCampaigns} active campaigns`,
      badgeText: totalCampaigns > 0 ? "Active UTM Tags" : "None defined",
      badgeType: totalCampaigns > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
      iconBg: "rgba(6, 182, 212, 0.15)",
      iconColor: "#06B6D4",
    },
    {
      id: "top_source",
      label: "Top Traffic Source",
      value: topSource?.name || "None",
      subtext: topSource ? `${topSource.count.toLocaleString()} clicks` : "No source recorded",
      badgeText: topSource ? "utm_source" : "Awaiting data",
      badgeType: topSource ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      iconBg: "rgba(16, 185, 129, 0.15)",
      iconColor: "#10B981",
    },
    {
      id: "top_campaign",
      label: "Top Campaign",
      value: topCampaign?.name || "None",
      subtext: topCampaign ? `${topCampaign.count.toLocaleString()} clicks` : "No campaign recorded",
      badgeText: topCampaign ? "utm_campaign" : "Awaiting data",
      badgeType: topCampaign ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      iconBg: "rgba(245, 158, 11, 0.15)",
      iconColor: "#F59E0B",
    },
  ];

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`}>
      {cards.map((card) => (
        <div className="metric-card campaign-metric-card" key={card.id}>
          <div className="metric-card-top">
            <div className="metric-icon-badge" style={{ background: card.iconBg, color: card.iconColor }}>
              {card.icon}
            </div>
            <span className={`metric-trend-pill ${card.badgeType}`}>{card.badgeText}</span>
          </div>
          <div
            className="metric-card-val campaign-metric-val"
            title={typeof card.value === "string" ? card.value : ""}
          >
            {card.value}
          </div>
          <div className="metric-card-label">{card.label}</div>
          {card.subtext && <div className="campaign-metric-subtext">{card.subtext}</div>}
        </div>
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
          <p>Real-time click distribution by campaign name, traffic source, and medium</p>
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
            <h3>Campaign Clicks Over Time 📈</h3>
            <span className="campaign-tag-source" style={{ fontSize: "11px", padding: "2px 8px" }}>
              Attributed Clicks Only
            </span>
          </div>
          <p>
            Daily campaign-attributed clicks across all marketing channels ({totalPeriodClicks.toLocaleString()} click{totalPeriodClicks !== 1 ? "s" : ""} in {rangeLabel})
          </p>
        </div>
      </div>

      <div className="chart-svg-container" onMouseLeave={() => setHoveredPoint(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="campaignChartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
              <stop offset="65%" stopColor="#7C3AED" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="campaignChartLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#A78BFA" />
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
                  stroke={isBaseline ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)"}
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
            <h1>Campaign & UTM Analytics 📣</h1>
            <p>Monitor campaign attribution, inbound traffic sources, and marketing channels.</p>
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

            <button
              type="button"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={campaignLoading}
              title="Refresh campaign analytics"
            >
              <span className={campaignLoading ? "spinning" : ""}>🔄</span>
              <span>{campaignLoading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {campaignError && (
        <div className="campaign-error-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="error-icon">⚠️</span>
            <span>{campaignError}</span>
          </div>
          <button type="button" onClick={onRefresh} className="btn-retry">
            Retry
          </button>
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
              icon="🌐"
              data={sources}
              emptyMessage="No traffic source data recorded yet. Share links with utm_source to view visitor sources."
            />
            <DonutChart
              title="Traffic Mediums (utm_medium)"
              icon="📡"
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
              <div className="campaign-empty-icon">🚀</div>
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
              <div className="campaign-info-icon">💡</div>
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
  const directPercentage = totalClicks > 0 ? Number((100 - qrPercentage).toFixed(1)) : 0;

  const cards = [
    {
      id: "total_clicks",
      label: "Total Clicks",
      value: totalClicks.toLocaleString(),
      subtext: totalClicks === 1 ? "1 overall link visit" : `${totalClicks.toLocaleString()} total link visits`,
      badgeText: totalClicks > 0 ? "All Channels" : "Awaiting traffic",
      badgeType: totalClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      iconBg: "rgba(139, 92, 246, 0.15)",
      iconColor: "#8B5CF6",
    },
    {
      id: "qr_scans",
      label: "QR Scans",
      value: qrClicks.toLocaleString(),
      subtext: `${qrPercentage}% of total recorded traffic`,
      badgeText: qrClicks > 0 ? "Physical / Scans" : "No scans yet",
      badgeType: qrClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      iconBg: "rgba(168, 85, 247, 0.15)",
      iconColor: "#A855F7",
    },
    {
      id: "direct_clicks",
      label: "Direct Clicks",
      value: directClicks.toLocaleString(),
      subtext: `${directPercentage}% of total recorded traffic`,
      badgeText: directClicks > 0 ? "Web / Direct" : "No direct clicks",
      badgeType: directClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
      iconBg: "rgba(6, 182, 212, 0.15)",
      iconColor: "#06B6D4",
    },
    {
      id: "qr_scan_rate",
      label: "QR Scan Rate",
      value: `${qrPercentage}%`,
      subtext: `${qrClicks.toLocaleString()} of ${totalClicks.toLocaleString()} total visits`,
      badgeText: qrPercentage >= 50 ? "High QR Adoption" : qrClicks > 0 ? "Active QR Visits" : "No QR visits",
      badgeType: qrClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      ),
      iconBg: "rgba(245, 158, 11, 0.15)",
      iconColor: "#F59E0B",
    },
  ];

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`}>
      {cards.map((card) => (
        <div className="metric-card campaign-metric-card" key={card.id}>
          <div className="metric-card-top">
            <div className="metric-icon-badge" style={{ background: card.iconBg, color: card.iconColor }}>
              {card.icon}
            </div>
            <span className={`metric-trend-pill ${card.badgeType}`}>{card.badgeText}</span>
          </div>
          <div className="metric-card-val campaign-metric-val" title={card.value}>
            {card.value}
          </div>
          <div className="metric-card-label">{card.label}</div>
          {card.subtext && <div className="campaign-metric-subtext">{card.subtext}</div>}
        </div>
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
          <p>Breakdown of QR scans versus direct visits for each shortened link in your workspace</p>
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
            <span role="img" aria-label="Trophy">🏆</span> Best Performing QR Link
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
                <button
                  type="button"
                  className={`copy-mini-btn ${copiedLinkId === (bestLink.linkId || bestLink._id) ? "copied" : ""}`}
                  onClick={() => onCopy?.({ _id: bestLink.linkId || bestLink._id, shortCode: bestLink.shortCode })}
                  title="Copy short link"
                >
                  {copiedLinkId === (bestLink.linkId || bestLink._id) ? "✓ Copied" : "Copy"}
                </button>
                <button
                  type="button"
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
                </button>
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
            <span className="qr-zero-icon">🎯</span>
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
              <span style={{ marginRight: "6px" }}>🔥</span>
              Top Performing QR Links
            </h3>
            <p>
              Top 5 short links ranked by QR scans ({rangeLabel}) &bull; Zero-scan links excluded
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
                          {rank === 1 ? "🥇 #1" : rank === 2 ? "🥈 #2" : rank === 3 ? "🥉 #3" : `#${rank}`}
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
            <h1>QR Code Scan Analytics 📱</h1>
            <p>Track QR code engagement, compare scans against direct link visits, and monitor per-link conversion.</p>
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

            <button
              type="button"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={qrLoading}
              title="Refresh QR analytics"
            >
              <span className={qrLoading ? "spinning" : ""}>🔄</span>
              <span>{qrLoading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {qrError && (
        <div className="campaign-error-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="error-icon">⚠️</span>
            <span>{qrError}</span>
          </div>
          <button type="button" onClick={onRefresh} className="btn-retry">
            Retry
          </button>
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
              icon="📱"
              data={[
                { name: "QR Scans", count: summary?.qrClicks || 0, color: "#8B5CF6" },
                { name: "Direct Clicks", count: summary?.directClicks || 0, color: "#06B6D4" },
              ]}
              emptyMessage="No traffic recorded in this time range. Scan the QR code or click your short link to view channel breakdown."
            />

            <div className="donut-card qr-summary-card">
              <div className="donut-card-top">
                <h4>
                  <span style={{ marginRight: "8px" }}>📊</span>
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
                    ? "🎉 QR scans account for the majority of your traffic! Your physical, print, or presentation materials are performing strongly."
                    : summary?.qrClicks > 0
                    ? "💡 QR codes are actively driving visits alongside direct digital links. Use the QR Code button to download print-ready codes."
                    : "🚀 No QR scans recorded yet. Use the 'QR Code' action on any link below to download and distribute your QR code!"}
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
              <div className="campaign-empty-icon">📱</div>
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
      value: geoIdentified.toLocaleString(),
      subtext: `${geoRate}% of total recorded traffic`,
      badgeText: geoIdentified > 0 ? "Global traffic" : "Awaiting visits",
      badgeType: geoIdentified > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      iconBg: "rgba(16, 185, 129, 0.15)",
      iconColor: "#10B981",
    },
    {
      id: "countries",
      label: "Countries Reached",
      value: countriesCount.toLocaleString(),
      subtext: topCountries[0] ? `Top: ${topCountries[0].country}` : "Worldwide reach",
      badgeText: countriesCount > 0 ? `${countriesCount} nations` : "No countries",
      badgeType: countriesCount > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      iconBg: "rgba(139, 92, 246, 0.15)",
      iconColor: "#8B5CF6",
    },
    {
      id: "cities",
      label: "Cities Reached",
      value: citiesCount.toLocaleString(),
      subtext: `${citiesCount} urban locations`,
      badgeText: citiesCount > 0 ? "Urban hubs" : "No cities",
      badgeType: citiesCount > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      ),
      iconBg: "rgba(6, 182, 212, 0.15)",
      iconColor: "#06B6D4",
    },
    {
      id: "qr_geo",
      label: "QR Physical Visits",
      value: qrGeoClicks.toLocaleString(),
      subtext: `${summary?.directGeoClicks || 0} direct visits`,
      badgeText: qrGeoClicks > 0 ? "Physical QR" : "0 QR scans",
      badgeType: qrGeoClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      iconBg: "rgba(245, 158, 11, 0.15)",
      iconColor: "#F59E0B",
    },
  ];

  return (
    <div className="campaign-metrics-grid geo-metrics-grid">
      {cards.map((c) => (
        <div key={c.id} className="campaign-stat-card">
          <div className="stat-card-header">
            <div
              className="stat-card-icon-box"
              style={{ background: c.iconBg, color: c.iconColor }}
            >
              {c.icon}
            </div>
            <span className={`stat-card-badge ${c.badgeType}`}>{c.badgeText}</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">{c.label}</span>
            <div className="stat-card-value">{c.value}</div>
            <span className="stat-card-subtext">{c.subtext}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// World Map with Interactive SVG paths and choropleth fill
function WorldMapChart({ topCountries = [] }) {
  const [hoveredCode, setHoveredCode] = useState(null);

  const countryMap = useMemo(() => {
    const map = new Map();
    for (const c of topCountries) {
      if (c.countryCode) {
        map.set(c.countryCode.toUpperCase(), c);
      }
    }
    return map;
  }, [topCountries]);

  const maxClicks = useMemo(() => {
    return topCountries.reduce((max, c) => Math.max(max, c.totalClicks || 0), 1);
  }, [topCountries]);

  const getCountryFill = (code) => {
    const data = countryMap.get(code);
    if (!data || !data.totalClicks) {
      return "var(--map-land-default, #1e293b)";
    }
    const ratio = data.totalClicks / maxClicks;
    if (ratio > 0.6) return "#10B981"; // Emerald for high traffic
    if (ratio > 0.3) return "#8B5CF6"; // Purple for medium traffic
    if (ratio > 0.1) return "#A78BFA"; // Lavender
    return "#6366F1"; // Indigo for lower traffic
  };

  const hoveredData = hoveredCode ? countryMap.get(hoveredCode) : null;
  const displayInfo = hoveredData || topCountries[0] || null;

  // Major country paths in equirectangular projection (viewBox 0 0 1000 500)
  const mapRegions = [
    // North America
    { code: "CA", name: "Canada", d: "M 120 70 L 290 50 L 330 90 L 260 140 L 150 140 L 110 100 Z" },
    { code: "US", name: "United States", d: "M 130 142 L 270 142 L 255 210 L 180 220 L 125 180 Z" },
    { code: "US_AK", parent: "US", name: "United States (Alaska)", d: "M 60 65 L 120 55 L 110 95 L 60 85 Z" },
    { code: "MX", name: "Mexico", d: "M 155 215 L 220 212 L 210 260 L 175 250 Z" },
    // South America
    { code: "CO", name: "Colombia", d: "M 235 270 L 275 265 L 270 305 L 240 305 Z" },
    { code: "BR", name: "Brazil", d: "M 275 275 L 365 285 L 360 365 L 315 385 L 275 325 Z" },
    { code: "AR", name: "Argentina", d: "M 285 370 L 325 370 L 310 465 L 285 465 Z" },
    { code: "CL", name: "Chile", d: "M 275 370 L 285 370 L 285 465 L 275 465 Z" },
    { code: "PE", name: "Peru", d: "M 240 305 L 275 305 L 270 365 L 245 345 Z" },
    // Europe
    { code: "GB", name: "United Kingdom", d: "M 450 120 L 472 115 L 468 152 L 448 150 Z" },
    { code: "FR", name: "France", d: "M 465 155 L 498 152 L 495 185 L 460 185 Z" },
    { code: "DE", name: "Germany", d: "M 498 138 L 528 135 L 525 168 L 498 168 Z" },
    { code: "ES", name: "Spain", d: "M 445 185 L 485 185 L 480 220 L 440 220 Z" },
    { code: "IT", name: "Italy", d: "M 505 175 L 525 175 L 535 220 L 520 220 Z" },
    { code: "NL", name: "Netherlands", d: "M 490 135 L 500 135 L 498 145 L 488 145 Z" },
    { code: "SE", name: "Sweden", d: "M 515 70 L 535 68 L 530 130 L 512 130 Z" },
    { code: "NO", name: "Norway", d: "M 495 72 L 515 70 L 512 130 L 492 125 Z" },
    { code: "FI", name: "Finland", d: "M 535 68 L 560 65 L 555 125 L 530 125 Z" },
    { code: "PL", name: "Poland", d: "M 528 135 L 560 132 L 558 165 L 525 165 Z" },
    { code: "UA", name: "Ukraine", d: "M 558 140 L 610 135 L 605 175 L 555 172 Z" },
    // Russia & Asia
    { code: "RU", name: "Russia", d: "M 550 65 L 850 50 L 880 115 L 610 125 L 550 110 Z" },
    { code: "TR", name: "Turkey", d: "M 555 180 L 615 178 L 610 205 L 550 205 Z" },
    { code: "SA", name: "Saudi Arabia", d: "M 585 210 L 640 210 L 635 265 L 580 260 Z" },
    { code: "AE", name: "United Arab Emirates", d: "M 640 230 L 652 230 L 650 242 L 638 242 Z" },
    { code: "IN", name: "India", d: "M 650 190 L 715 190 L 695 275 L 670 290 L 650 235 Z" },
    { code: "CN", name: "China", d: "M 705 135 L 810 130 L 805 220 L 710 215 Z" },
    { code: "JP", name: "Japan", d: "M 845 140 L 865 135 L 860 190 L 840 185 Z" },
    { code: "KR", name: "South Korea", d: "M 812 170 L 825 170 L 823 188 L 810 188 Z" },
    { code: "ID", name: "Indonesia", d: "M 740 280 L 830 280 L 820 310 L 730 310 Z" },
    // Africa
    { code: "EG", name: "Egypt", d: "M 535 210 L 575 210 L 570 245 L 530 245 Z" },
    { code: "NG", name: "Nigeria", d: "M 480 265 L 520 265 L 515 300 L 475 300 Z" },
    { code: "KE", name: "Kenya", d: "M 560 275 L 590 275 L 585 315 L 555 315 Z" },
    { code: "ZA", name: "South Africa", d: "M 500 365 L 560 365 L 545 425 L 510 425 Z" },
    { code: "MA", name: "Morocco", d: "M 435 200 L 470 200 L 465 235 L 430 235 Z" },
    // Oceania
    { code: "AU", name: "Australia", d: "M 770 335 L 880 330 L 865 420 L 780 415 Z" },
    { code: "NZ", name: "New Zealand", d: "M 890 405 L 915 400 L 905 445 L 885 440 Z" },
  ];

  return (
    <div className="geo-chart-card world-map-card">
      <div className="geo-card-header">
        <div>
          <h3>Global Visitor Distribution</h3>
          <p>Geographical density of short link visits and physical QR engagements across the world</p>
        </div>

        {/* Hover / Highlighted country inspector badge */}
        <div className="world-map-inspector">
          {displayInfo ? (
            <div className="inspector-pill">
              <span className="inspector-flag">{getCountryFlagEmoji(displayInfo.countryCode)}</span>
              <span className="inspector-country">{displayInfo.country}</span>
              <span className="inspector-clicks">{displayInfo.totalClicks} visits</span>
              <span className="inspector-qr">({displayInfo.qrClicks} QR)</span>
            </div>
          ) : (
            <span className="inspector-hint">Hover over any country</span>
          )}
        </div>
      </div>

      <div className="world-map-svg-wrapper">
        <svg
          viewBox="0 0 1000 500"
          className="world-map-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(15, 23, 42, 0.4)" />
              <stop offset="100%" stopColor="rgba(10, 15, 30, 0.9)" />
            </radialGradient>
            <filter id="countryGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ocean Background */}
          <rect width="1000" height="500" rx="12" fill="url(#oceanGlow)" />

          {/* Subtle Latitude/Longitude Graticules */}
          <g className="map-graticules" opacity="0.12" stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="4 4">
            <line x1="50" y1="125" x2="950" y2="125" />
            <line x1="50" y1="250" x2="950" y2="250" />
            <line x1="50" y1="375" x2="950" y2="375" />
            <line x1="250" y1="30" x2="250" y2="470" />
            <line x1="500" y1="30" x2="500" y2="470" />
            <line x1="750" y1="30" x2="750" y2="470" />
          </g>

          {/* Continents & Countries */}
          <g className="map-countries-group">
            {mapRegions.map((region) => {
              const code = region.parent || region.code;
              const hasData = countryMap.has(code);
              const isHovered = hoveredCode === code;

              return (
                <path
                  key={region.code}
                  d={region.d}
                  fill={getCountryFill(code)}
                  stroke={isHovered ? "#ffffff" : hasData ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.08)"}
                  strokeWidth={isHovered ? 2 : hasData ? 1 : 0.6}
                  filter={hasData && isHovered ? "url(#countryGlow)" : "none"}
                  className={`world-map-country-path ${hasData ? "has-data" : ""} ${isHovered ? "hovered" : ""}`}
                  onMouseEnter={() => setHoveredCode(code)}
                  onMouseLeave={() => setHoveredCode(null)}
                >
                  <title>{`${region.name}: ${countryMap.get(code)?.totalClicks || 0} visits`}</title>
                </path>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="world-map-legend">
          <span className="legend-title">Visitor Density:</span>
          <div className="legend-scale">
            <span className="scale-item">
              <span className="scale-box" style={{ background: "#1e293b" }} /> 0 visits
            </span>
            <span className="scale-item">
              <span className="scale-box" style={{ background: "#6366F1" }} /> 1 - 5
            </span>
            <span className="scale-item">
              <span className="scale-box" style={{ background: "#8B5CF6" }} /> 6 - 20
            </span>
            <span className="scale-item">
              <span className="scale-box" style={{ background: "#10B981" }} /> 21+ visits
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
                <span className="geo-qr-stat">📱 {item.qrClicks} QR</span>
                <span className="geo-direct-stat">🌐 {item.directClicks} Direct</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Top Countries Table
function TopCountriesTable({ countries = [] }) {
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
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Top Countries</h3>
          <p>Nations ranked by overall visitor engagement and physical QR adoption</p>
        </div>
        <div className="table-actions-group">
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th style={{ width: "70px" }}>Rank</th>
              <th>Country</th>
              <th>Total Visits</th>
              <th>QR Scans</th>
              <th>Direct Clicks</th>
              <th style={{ width: "200px" }}>Traffic Share</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const flag = getCountryFlagEmoji(c.countryCode);
                return (
                  <tr key={c.countryCode || c.country}>
                    <td>
                      <span className={`qr-rank-pill rank-${c.rank <= 3 ? c.rank : "other"}`}>
                        #{c.rank}
                      </span>
                    </td>
                    <td>
                      <div className="geo-country-cell">
                        <span className="geo-table-flag">{flag}</span>
                        <div className="geo-country-names">
                          <span className="geo-table-country-name">{c.country}</span>
                          {c.countryCode && (
                            <span className="geo-table-iso-pill">{c.countryCode}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="clicks-badge">{c.totalClicks}</span>
                    </td>
                    <td>
                      <span className="geo-channel-pill qr">
                        📱 {c.qrClicks} ({c.qrPercentage}%)
                      </span>
                    </td>
                    <td>
                      <span className="geo-channel-pill direct">
                        🌐 {c.directClicks}
                      </span>
                    </td>
                    <td>
                      <div className="geo-progress-cluster">
                        <div className="geo-progress-bar-bg">
                          <div
                            className="geo-progress-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(4, c.percentage))}%` }}
                          />
                        </div>
                        <span className="geo-percentage-text">{c.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="table-empty-row">
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

// Top Cities Table
function TopCitiesTable({ cities = [] }) {
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
      <div className="table-topbar">
        <div className="table-topbar-title">
          <h3>Top Cities</h3>
          <p>Metropolitan locations generating the highest volume of visits</p>
        </div>
        <div className="table-actions-group">
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search cities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive-box">
        <table className="custom-links-table">
          <thead>
            <tr>
              <th style={{ width: "70px" }}>Rank</th>
              <th>City</th>
              <th>Country</th>
              <th>Total Visits</th>
              <th>QR Scans</th>
              <th>Direct Clicks</th>
              <th style={{ width: "140px" }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const flag = getCountryFlagEmoji(c.countryCode);
                return (
                  <tr key={`${c.city}-${c.countryCode}-${c.rank}`}>
                    <td>
                      <span className={`qr-rank-pill rank-${c.rank <= 3 ? c.rank : "other"}`}>
                        #{c.rank}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--text-primary)" }}>{c.city}</strong>
                    </td>
                    <td>
                      <div className="geo-country-cell">
                        <span className="geo-table-flag">{flag}</span>
                        <span>{c.country}</span>
                      </div>
                    </td>
                    <td>
                      <span className="clicks-badge">{c.totalClicks}</span>
                    </td>
                    <td>
                      <span className="geo-channel-pill qr">📱 {c.qrClicks}</span>
                    </td>
                    <td>
                      <span className="geo-channel-pill direct">🌐 {c.directClicks}</span>
                    </td>
                    <td>
                      <span className="geo-percentage-text" style={{ fontWeight: 650 }}>
                        {c.percentage}%
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="table-empty-row">
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

  return (
    <div className="campaign-view-container geo-analytics-view-container">
      {/* Page Header & Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            <h1>Geo-Location Analytics 🌍</h1>
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
        <div className="campaign-loading-state">
          <div className="loading-spinner" />
          <p>Analyzing global geographic traffic...</p>
        </div>
      ) : (
        <>
          {/* 1. Statistic Cards */}
          <GeoMetricCards summary={summary} topCountries={topCountries} />

          {/* 2. Zero Traffic State */}
          {isZeroState ? (
            <div className="campaign-empty-card">
              <div className="campaign-empty-icon" style={{ fontSize: "42px" }}>🌍</div>
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
              {/* 3. Realistic 3D Dotted Rotating Earth Globe with Multi-Level Drill-Down */}
              <RotatingDottedGlobe
                topCountries={topCountries}
                regions={regions}
                topCities={topCities}
                summary={summary}
              />

              {/* 4. QR vs Direct Channel Breakdown */}
              <GeoQRComparisonChart qrVsDirect={qrVsDirect} />

              {/* 5. Dual Tables: Top Countries & Top Cities */}
              <div className="geo-tables-grid">
                <TopCountriesTable countries={topCountries} />
                <TopCitiesTable cities={topCities} />
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
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  // CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "campaigns"
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
      // CHANGE: Notifications Step 4B/4D — 2026-11-05
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
      setShowNotificationsDropdown(false);
      setActiveView("dashboard");
      setCampaignRange("all");
      setError("");
      setAuthError("");
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = useCallback((newToken, userData) => {
    setLoading(true);
    setToken(newToken);
    if (userData) setUser(userData);
    setAuthError("");
    setError("");
  }, []);

  // Silent session restoration on initial visit / page reload
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const refreshRes = await axios.post(
          `${USER_URL}/refresh-token`,
          {},
          { withCredentials: true }
        );

        if (isMounted && refreshRes.data?.success && refreshRes.data?.token) {
          const newToken = refreshRes.data.token;
          setToken(newToken);
          if (refreshRes.data.user) {
            setUser(refreshRes.data.user);
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
            const refreshRes = await axios.post(
              `${USER_URL}/refresh-token`,
              {},
              { withCredentials: true }
            );
            if (refreshRes.data?.token) {
              const newToken = refreshRes.data.token;
              setToken(newToken);
              localStorage.setItem("token", newToken);
              originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch {
            handleSessionExpired();
          }
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [handleSessionExpired]);

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

  useEffect(() => {
    if (activeView !== "campaigns" || !token) return;
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
    return <Login onLoginSuccess={handleLoginSuccess} initialError={authError} />;
  }

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-badge" aria-hidden="true">🔗</div>
          <h2 className="logo-title">SmartLink</h2>
        </div>

        <div className="sidebar-nav-group">
          <p className="sidebar-nav-heading">WORKSPACE</p>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`nav-item ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveView("dashboard")}
            >
              <span className="nav-item-icon">▦</span>
              <span>Dashboard</span>
            </button>
            {/* CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02 */}
            <button
              type="button"
              className={`nav-item ${activeView === "campaigns" ? "active" : ""}`}
              onClick={() => setActiveView("campaigns")}
            >
              <span className="nav-item-icon">📣</span>
              <span>Campaigns</span>
            </button>
            {/* CHANGE: QR analytics dashboard — 2026-11-06 */}
            <button
              type="button"
              className={`nav-item ${activeView === "qr-analytics" ? "active" : ""}`}
              onClick={() => setActiveView("qr-analytics")}
              title="QR Analytics"
              aria-label="QR Analytics"
            >
              <span className="nav-item-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </span>
              <span>QR Analytics</span>
            </button>
            {/* CHANGE: Stage 8 — Geo Analytics Sidebar Item — 2026-11-08 */}
            <button
              type="button"
              className={`nav-item ${activeView === "geo-analytics" ? "active" : ""}`}
              onClick={() => setActiveView("geo-analytics")}
              title="Geo Analytics"
              aria-label="Geo Analytics"
            >
              <span className="nav-item-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <span>Geo Analytics</span>
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => {
                if (activeView !== "dashboard") {
                  setActiveView("dashboard");
                  setTimeout(() => {
                    const tableEl = document.querySelector(".links-table-card");
                    if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                  }, 50);
                } else {
                  const tableEl = document.querySelector(".links-table-card");
                  if (tableEl) tableEl.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <span className="nav-item-icon">↗</span>
              <span>My Links</span>
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => {
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
            >
              <span className="nav-item-icon">📊</span>
              <span>Analytics</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar">
            {user?.username ? user.username.charAt(0).toUpperCase() : "V"}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.username || "Vijay"}</span>
            <span className="user-email">{user?.email || "smartlink@user"}</span>
          </div>
          <button
            type="button"
            className="btn-icon-logout"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-search-box">
            <svg className="topbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              className="topbar-search-input"
              placeholder="Search links..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search links"
            />
          </div>

          <div className="topbar-actions">
            {/* CHANGE: Notifications Step 4C / Bell Click Fix — 2026-11-05 */}
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
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
                      <button
                        type="button"
                        className="btn-mark-all-read"
                        onClick={handleMarkAllAsRead}
                        title="Mark all notifications as read"
                      >
                        Mark all as read
                      </button>
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
                        <span className="notifications-empty-icon">⚠️</span>
                        <p className="notifications-empty-title">Unable to load</p>
                        <p className="notifications-empty-desc">{notificationsError}</p>
                        <button
                          type="button"
                          className="btn-retry-notifications"
                          onClick={fetchNotifications}
                        >
                          Retry
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="notifications-empty-state">
                        <span className="notifications-empty-icon">🔔</span>
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
                                      <button
                                        type="button"
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
                                      </button>
                                    )}

                                    <button
                                      type="button"
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
                                    </button>
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

            <div className="topbar-profile-pill">
              <div className="user-avatar" style={{ width: "28px", height: "28px", fontSize: "12px" }}>
                {user?.username ? user.username.charAt(0).toUpperCase() : "V"}
              </div>
              <span className="topbar-profile-name">{user?.username || "Vijay"}</span>
            </div>

            <button
              type="button"
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
              <span>+ Create New Link</span>
            </button>
          </div>
        </header>

        {/* Main View Switcher: Dashboard vs Campaigns */}
        {/* CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02 */}
        {activeView === "dashboard" ? (
          <>
            {/* Welcome Greeting */}
            <div className="page-greeting">
              <div>
                <h1>Welcome back, {user?.username || "Vijay"}! 👋</h1>
                <p>Here&apos;s an overview of your links and performance.</p>
              </div>
            </div>

            {/* 1. Top 4 Statistic Cards */}
            <MetricCards
              totalLinks={links.length}
              totalClicks={totalClicks}
              activeLinks={activeLinks}
              avgClicks={avgClicks}
            />

            {/* 2. Clicks Overview Chart */}
            <ClicksOverviewChart
              dailyTrends={dashboardAnalytics?.dailyTrends || []}
              history={dashboardAnalytics?.history || []}
              selectedLink={selectedLink}
              links={links}
              onSelectLink={setSelectedLink}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />

            {/* 3 & 4. Dual Donut Charts (Device & Browser Breakdown) */}
            <div className="donuts-grid">
              <DonutChart
                title="Device Breakdown"
                icon="📱"
                data={dashboardAnalytics?.devices || []}
                emptyMessage="No device data recorded yet. Share your short link to view visitor platforms."
              />
              <DonutChart
                title="Browser Breakdown"
                icon="🌐"
                data={dashboardAnalytics?.browsers || []}
                emptyMessage="No browser data recorded yet. Visitor browsers will appear after clicks."
              />
            </div>

            {/* 5. Click Activity Heatmap (Day x Hour in IST) */}
            <ActivityHeatmap history={dashboardAnalytics?.history || []} />

            {/* 6. Smart Traffic Intelligence Cards */}
            <SmartTrafficSection intelligence={dashboardAnalytics?.intelligence} />

            {/* 7. Recent Links Table */}
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

                        <button
                          type="button"
                          className={`btn-create-primary success-copy-btn ${
                            copiedLinkId === createSuccessLink._id ? "copied" : ""
                          }`}
                          onClick={() => handleCopy(createSuccessLink)}
                          title="Copy short link"
                        >
                          {copiedLinkId === createSuccessLink._id ? "✓ Copied" : "Copy"}
                        </button>
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
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCreateAnother}
                    >
                      + Create Another Link
                    </button>
                    <button
                      type="button"
                      className="btn-create-primary"
                      onClick={resetCreateModal}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetCreateModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-create-primary"
                      disabled={createLoading}
                    >
                      {createLoading ? "Creating..." : "Create Short Link →"}
                    </button>
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
                      icon="📱"
                      data={detailAnalytics?.devices || []}
                    />
                    <DonutChart
                      title="Browser Breakdown"
                      icon="🌐"
                      data={detailAnalytics?.browsers || []}
                    />
                  </div>

                  <ActivityHeatmap history={detailAnalytics?.history || []} />

                  <SmartTrafficSection intelligence={detailAnalytics?.intelligence} />

                  {/* Individual Click Events History Table */}
                  <div className="links-table-card">
                    <h4 style={{ margin: "0 0 12px", color: "#fff", fontSize: "15px" }}>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseQrModal}
              >
                Close
              </button>
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