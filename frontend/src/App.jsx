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
import "./App.css";

const API_BASE_URL = "http://localhost:5000";
const API_URL = `${API_BASE_URL}/api/links`;
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
// Component: RecentLinksTable (Links Table with Copy, Status, and Actions)
// -----------------------------------------------------------------------------
function RecentLinksTable({
  links = [],
  onCopy,
  copiedLinkId,
  onOpenAnalytics,
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
              <th>Created At</th>
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
                      <span className="clicks-badge">
                        {link.clicks || 0}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                      {formattedDate}
                    </td>
                    <td>
                      <span className={`status-pill ${(link.clicks || 0) > 0 ? "active" : "ready"}`}>
                        {(link.clicks || 0) > 0 ? "Active" : "Ready"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="table-actions-cell" style={{ justifyContent: "flex-end" }}>
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

  const resetCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setNewUrlInput("");
    setUtmInputs(initialUtmState);
    setShowUtmSection(false);
    setCreateError("");
    setCreateSuccessLink(null);
  }, []);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLink, setDetailLink] = useState(null);
  const [detailAnalytics, setDetailAnalytics] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalTimeRange, setModalTimeRange] = useState("7d");

  // CHANGE: Added separate Campaign Analytics frontend view — 2026-11-02
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "campaigns"
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  // CHANGE: Stage 5C — 2026-11-03
  const [campaignRange, setCampaignRange] = useState("all"); // "all" | "30d" | "7d"
  const campaignAbortControllerRef = useRef(null);
  const activeCampaignRangeRef = useRef("all");

  // CHANGE: Notifications Step 4B — 2026-11-04
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

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
      // CHANGE: Notifications Step 4B — 2026-11-04
      setNotifications([]);
      setUnreadCount(0);
      setShowNotificationsDropdown(false);
      setActiveView("dashboard");
      setCampaignRange("all");
      setAuthError(message);
    },
    []
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
      // CHANGE: Notifications Step 4B — 2026-11-04
      setNotifications([]);
      setUnreadCount(0);
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

  // CHANGE: Notifications Step 4B — 2026-11-04
  // Fetch notifications belonging strictly to the authenticated user
  const fetchNotifications = useCallback(async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;

    setNotificationsLoading(true);
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
          setNotifications((prev) =>
            prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
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
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;

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
            {/* CHANGE: Notifications Step 4B — 2026-11-04 */}
            <button
              type="button"
              className="topbar-icon-btn"
              title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
              onClick={() => setShowNotificationsDropdown((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

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
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
            />
          </>
        ) : (
          <CampaignAnalyticsView
            campaignAnalytics={campaignAnalytics}
            campaignLoading={campaignLoading}
            campaignError={campaignError}
            campaignRange={campaignRange}
            onRangeChange={handleCampaignRangeChange}
            onRefresh={() => fetchCampaignAnalytics(campaignRange)}
          />
        )}
      </main>

      {/* Create New Link Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={resetCreateModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create a Short Link</h3>
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

                {createSuccessLink ? (
                  <div>
                    <div className="auth-alert success" style={{ marginBottom: "16px" }}>
                      <span>Short link created successfully!</span>
                    </div>
                    <label className="modal-input-label">Your Short URL</label>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        readOnly
                        className="modal-text-input"
                        value={`${API_URL}/${createSuccessLink.shortCode}`}
                      />
                      <button
                        type="button"
                        className="btn-create-primary"
                        style={{ height: "46px" }}
                        onClick={() => handleCopy(createSuccessLink)}
                      >
                        {copiedLinkId === createSuccessLink._id ? "✓ Copied" : "Copy"}
                      </button>
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
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetCreateModal}
                >
                  {createSuccessLink ? "Done" : "Cancel"}
                </button>
                {!createSuccessLink && (
                  <button
                    type="submit"
                    className="btn-create-primary"
                    disabled={createLoading}
                  >
                    {createLoading ? "Creating..." : "Create Short Link →"}
                  </button>
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
    </div>
  );
}

export default App;