// =============================================================================
// Component: DeviceAnalyticsView (Device & Browser Intelligence Dashboard)
// CHANGE: Stage 9 Device & Browser Intelligence Dashboard — 2026-11-15
// Clean, responsive dashboard visualizing device categories, operating systems,
// browser engines, hardware manufacturers, models, and QR vs Direct channels.
// =============================================================================

import { useState, useMemo } from "react";
import SpecularButton from "./SpecularButton";

// Helper icon renderers for Operating Systems
function getOsIcon(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("android")) return "🤖";
  if (lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad")) return "🍏";
  if (lower.includes("windows")) return "🪟";
  if (lower.includes("macos") || lower.includes("mac")) return "💻";
  if (lower.includes("linux")) return "🐧";
  if (lower.includes("chromeos")) return "🌐";
  return "💻";
}

// Helper icon renderers for Browsers
function getBrowserIcon(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("chrome")) return "🌐";
  if (lower.includes("safari")) return "🧭";
  if (lower.includes("firefox")) return "🦊";
  if (lower.includes("edge")) return "🌊";
  if (lower.includes("opera")) return "🔴";
  if (lower.includes("samsung")) return "🌌";
  if (lower.includes("brave")) return "🦁";
  if (lower.includes("uc")) return "🐿️";
  if (lower.includes("curl") || lower.includes("postman")) return "⚡";
  return "🌐";
}

// Helper icon renderers for Device Types
function getDeviceTypeIcon(type = "") {
  const lower = type.toLowerCase();
  if (lower === "mobile") return "📱";
  if (lower === "desktop") return "🖥️";
  if (lower === "tablet") return "📟";
  return "🔌";
}

// Helper icon renderers for Hardware Vendors
function getVendorIcon(vendor = "") {
  const lower = vendor.toLowerCase();
  if (lower.includes("apple")) return "🍏";
  if (lower.includes("samsung")) return "📱";
  if (lower.includes("google")) return "🇬";
  if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) return "🟠";
  if (lower.includes("oneplus")) return "🔴";
  if (lower.includes("motorola") || lower.includes("moto")) return "Ⓜ️";
  return "🏷️";
}

// -----------------------------------------------------------------------------
// Sub-component: Device Donut Chart
// -----------------------------------------------------------------------------
function DeviceDonutChart({ data = [], title = "Device Category Split", icon = "📊" }) {
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
  const circumference = 2 * Math.PI * radius;

  const defaultColors = useMemo(() => ["#8B5CF6", "#06B6D4", "#F59E0B", "#10B981", "#EC4899", "#64748B"], []);

  const slices = useMemo(() => {
    return activeItems.map((item, idx) => {
      const pct = total > 0 ? (item.count / total) * 100 : 0;
      const priorPctSum = activeItems
        .slice(0, idx)
        .reduce((sum, prev) => sum + (total > 0 ? (prev.count / total) * 100 : 0), 0);
      const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((priorPctSum / 100) * circumference);
      const color = item.color || defaultColors[idx % defaultColors.length];
      return {
        ...item,
        pct: Number(pct.toFixed(1)),
        strokeDasharray,
        strokeDashoffset,
        color,
      };
    });
  }, [activeItems, total, circumference, defaultColors]);

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
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={strokeWidth}
              />
              {slices.map((slice, idx) => {
                const isHovered = hoveredIdx === idx;
                return (
                  <circle
                    key={slice.name || idx}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                      transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                      cursor: "pointer",
                      opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="donut-center-label">
              <span className="donut-center-pct">
                {activeSlice ? `${activeSlice.pct}%` : "100%"}
              </span>
              <span className="donut-center-text">
                {activeSlice ? activeSlice.name : "Total"}
              </span>
            </div>
          </div>

          <div className="donut-legend-list">
            {slices.map((slice, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <div
                  key={slice.name || idx}
                  className="donut-legend-row"
                  style={{
                    opacity: hoveredIdx === null || isHovered ? 1 : 0.4,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="donut-legend-item">
                    <span
                      className="legend-swatch"
                      style={{ background: slice.color }}
                    />
                    <span className="legend-label">{slice.name}</span>
                  </div>
                  <div className="donut-legend-stats">
                    <span className="legend-val-num">{slice.count.toLocaleString()}</span>
                    <span className="legend-val-pct">{slice.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="donut-empty-text">No device data recorded in this time range.</p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-component: KPI Cards (Top 4)
// -----------------------------------------------------------------------------
function DeviceMetricCards({ summary, loading = false }) {
  const totalClicks = summary?.totalClicks ?? 0;
  const mobileClicks = summary?.mobileClicks ?? 0;
  const desktopClicks = summary?.desktopClicks ?? 0;
  const mobilePct = summary?.mobilePercentage ?? 0;
  const desktopPct = summary?.desktopPercentage ?? 0;
  const primaryOs = summary?.primaryOs || "None";
  const primaryBrowser = summary?.primaryBrowser || "None";

  const cards = [
    {
      id: "mobile_share",
      label: "Mobile Share",
      value: `${mobilePct}%`,
      subtext: `${mobileClicks.toLocaleString()} of ${totalClicks.toLocaleString()} total visits`,
      badgeText: mobileClicks > 0 ? `${mobileClicks} visits` : "No visits",
      badgeType: mobileClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
      iconBg: "rgba(139, 92, 246, 0.15)",
      iconColor: "#8B5CF6",
    },
    {
      id: "desktop_share",
      label: "Desktop Share",
      value: `${desktopPct}%`,
      subtext: `${desktopClicks.toLocaleString()} of ${totalClicks.toLocaleString()} total visits`,
      badgeText: desktopClicks > 0 ? `${desktopClicks} visits` : "No visits",
      badgeType: desktopClicks > 0 ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      iconBg: "rgba(6, 182, 212, 0.15)",
      iconColor: "#06B6D4",
    },
    {
      id: "primary_os",
      label: "Primary OS",
      value: primaryOs,
      subtext: totalClicks > 0 ? "Top visitor platform" : "Awaiting visitor traffic",
      badgeText: primaryOs !== "None" ? "Leading OS" : "Pending",
      badgeType: primaryOs !== "None" ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      ),
      iconBg: "rgba(16, 185, 129, 0.15)",
      iconColor: "#10B981",
    },
    {
      id: "primary_browser",
      label: "Primary Browser",
      value: primaryBrowser,
      subtext: totalClicks > 0 ? "Top web client engine" : "Awaiting visitor traffic",
      badgeText: primaryBrowser !== "None" ? "Leading Browser" : "Pending",
      badgeType: primaryBrowser !== "None" ? "positive" : "neutral",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
          <div className="metric-card-subtext">{card.subtext}</div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: DeviceAnalyticsView (Main Dashboard View)
// -----------------------------------------------------------------------------
export default function DeviceAnalyticsView({
  deviceAnalytics,
  deviceLoading,
  deviceError,
  deviceRange,
  onRangeChange,
  onRefresh,
}) {
  const summary = deviceAnalytics?.summary;
  const deviceTypes = useMemo(() => deviceAnalytics?.deviceTypes || [], [deviceAnalytics]);
  const operatingSystems = useMemo(() => deviceAnalytics?.operatingSystems || [], [deviceAnalytics]);
  const browsers = deviceAnalytics?.browsers || [];
  const vendors = deviceAnalytics?.vendors || [];
  const models = deviceAnalytics?.models || [];

  const isZeroState = summary && summary.totalClicks === 0;

  // Donut chart data for Device Category Split
  const deviceDonutData = useMemo(() => {
    const colorMap = {
      mobile: "#8B5CF6",
      desktop: "#06B6D4",
      tablet: "#F59E0B",
      unknown: "#64748B",
    };
    return (deviceTypes || []).map((d) => ({
      name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
      count: d.totalClicks || 0,
      color: colorMap[d.type.toLowerCase()] || "#A855F7",
    }));
  }, [deviceTypes]);

  // Donut chart data for Top Operating Systems
  const osDonutData = useMemo(() => {
    const osColors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#64748B"];
    return (operatingSystems || []).slice(0, 5).map((os, idx) => ({
      name: os.name,
      count: os.totalClicks || 0,
      color: osColors[idx % osColors.length],
    }));
  }, [operatingSystems]);

  return (
    <div className="campaign-view-container geo-analytics-view-container device-analytics-view-container">
      {/* 1. Page Header & Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            <h1>Devices & Operating Systems 📱💻</h1>
            <p>
              Monitor visitor device hardware, operating system distribution, browser engines, and version adoption across direct links and QR scans.
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
                  className={`range-pill-btn ${deviceRange === btn.id ? "active" : ""}`}
                  onClick={() => onRangeChange?.(btn.id)}
                  disabled={deviceLoading && deviceRange === btn.id}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <SpecularButton
              type="button"
              variant="secondary"
              size="md"
              className="campaign-refresh-btn"
              onClick={onRefresh}
              disabled={deviceLoading}
              title="Refresh Device Analytics"
              aria-label="Refresh Device Analytics"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="15"
                height="15"
                className={deviceLoading ? "spin-icon" : ""}
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{deviceLoading ? "Updating..." : "Refresh"}</span>
            </SpecularButton>
          </div>
        </div>
      </div>

      {/* 2. Error Banner */}
      {deviceError && (
        <div className="auth-alert error" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>⚠️</span>
            <span>{deviceError}</span>
          </div>
          <SpecularButton
            type="button"
            variant="danger"
            size="sm"
            onClick={onRefresh}
            className="btn-retry"
          >
            Retry
          </SpecularButton>
        </div>
      )}

      {/* 3. Initial Loading State */}
      {deviceLoading && !deviceAnalytics ? (
        <div className="campaign-loading-state">
          <div className="spinner-purple" />
          <p>Loading device & browser analytics...</p>
        </div>
      ) : isZeroState ? (
        // 4. Zero State
        <div className="card-box empty-state-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: "44px", marginBottom: "14px" }}>📱💻</div>
          <h3 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
            No Device Traffic Recorded Yet
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "480px", margin: "0 auto 20px" }}>
            No clicks have been recorded for your links in this date range. Click or share your short links, or scan your QR codes from a mobile device or desktop browser to populate real-time intelligence.
          </p>
          <div style={{ display: "inline-flex", gap: "10px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onRangeChange?.("all")}
            >
              View All Time
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onRefresh}
            >
              Check Again
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 5. Top 4 Metric Cards */}
          <DeviceMetricCards summary={summary} loading={deviceLoading} />

          {/* 6. Device Categories & Channel Split (QR vs Direct) */}
          <div className={`donuts-grid ${deviceLoading ? "data-refreshing" : ""}`}>
            <DeviceDonutChart
              title="Device Category Split"
              icon="📱"
              data={deviceDonutData}
            />
            <DeviceDonutChart
              title="Operating System Split"
              icon="💻"
              data={osDonutData}
            />
          </div>

          {/* 7. Device Category Cards with QR vs Direct Breakdown */}
          <div className={`card-box ${deviceLoading ? "data-refreshing" : ""}`} style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <span>📲</span> Device Category Attribution (QR Scans vs Direct Visits)
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Total: {(summary?.totalClicks || 0).toLocaleString()} clicks
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              {(deviceTypes || []).map((dev) => {
                const typeName = dev.type.charAt(0).toUpperCase() + dev.type.slice(1);
                const qrClicks = dev.qrClicks || 0;
                const directClicks = dev.directClicks || 0;
                const totalDevClicks = dev.totalClicks || 0;
                const qrPct = dev.qrPercentage || 0;
                const directPct = totalDevClicks > 0 ? Number((100 - qrPct).toFixed(1)) : 0;

                return (
                  <div
                    key={dev.type}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>{getDeviceTypeIcon(dev.type)}</span>
                        <span style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "14px" }}>
                          {typeName}
                        </span>
                      </div>
                      <span className="geo-table-iso-pill" style={{ color: "#A855F7" }}>
                        {dev.percentage}% share
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                      <span>Total Visits:</span>
                      <strong style={{ color: "#fff" }}>{totalDevClicks.toLocaleString()}</strong>
                    </div>

                    {/* QR vs Direct Visual Progress Bar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", height: "8px", width: "100%", borderRadius: "4px", overflow: "hidden", background: "rgba(255, 255, 255, 0.06)" }}>
                        <div
                          style={{
                            width: `${qrPct}%`,
                            background: "linear-gradient(90deg, #8B5CF6, #A855F7)",
                            transition: "width 0.3s ease",
                          }}
                          title={`QR Scans: ${qrClicks} (${qrPct}%)`}
                        />
                        <div
                          style={{
                            width: `${directPct}%`,
                            background: "linear-gradient(90deg, #06B6D4, #38BDF8)",
                            transition: "width 0.3s ease",
                          }}
                          title={`Direct Clicks: ${directClicks} (${directPct}%)`}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span style={{ color: "#C084FC", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8B5CF6", display: "inline-block" }} />
                          QR: {qrClicks} ({qrPct}%)
                        </span>
                        <span style={{ color: "#38BDF8", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06B6D4", display: "inline-block" }} />
                          Direct: {directClicks} ({directPct}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. Dual Tables Grid: Operating Systems & Web Browsers */}
          <div className={`geo-tables-grid ${deviceLoading ? "data-refreshing" : ""}`}>
            {/* Operating Systems Table with Versions */}
            <div className="geo-table-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>💻</span> Operating Systems & Versions
                </h4>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {operatingSystems.length} detected
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="custom-links-table" style={{ width: "100%", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "36px", textAlign: "center" }}>#</th>
                      <th>OS Platform</th>
                      <th style={{ textAlign: "right" }}>Clicks</th>
                      <th style={{ width: "130px" }}>Share</th>
                      <th style={{ textAlign: "right" }}>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operatingSystems.length > 0 ? (
                      operatingSystems.map((os) => (
                        <tr key={os.name}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{os.rank}</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "16px" }}>{getOsIcon(os.name)}</span>
                                <strong style={{ color: "var(--text-primary)" }}>{os.name}</strong>
                              </div>
                              {/* Detected OS Versions */}
                              {os.versions && os.versions.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
                                  {os.versions.map((ver) => (
                                    <span
                                      key={ver.version}
                                      style={{
                                        fontSize: "10px",
                                        background: "rgba(255, 255, 255, 0.06)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "3px",
                                        padding: "1px 5px",
                                        color: "var(--text-secondary)",
                                      }}
                                      title={`${ver.clicks} clicks (${os.totalClicks > 0 ? ((ver.clicks / os.totalClicks) * 100).toFixed(0) : 0}%)`}
                                    >
                                      v{ver.version} ({ver.clicks})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600", color: "#fff" }}>
                            {os.totalClicks.toLocaleString()}
                          </td>
                          <td>
                            <div className="geo-progress-cluster">
                              <div className="geo-progress-bar-bg">
                                <div
                                  className="geo-progress-bar-fill"
                                  style={{
                                    width: `${os.percentage}%`,
                                    background: "linear-gradient(90deg, #10B981, #34D399)",
                                  }}
                                />
                              </div>
                              <span className="geo-percentage-text">{os.percentage}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                              <span className="geo-channel-pill qr" title={`QR Scans: ${os.qrClicks}`}>
                                QR {os.qrClicks}
                              </span>
                              <span className="geo-channel-pill direct" title={`Direct Clicks: ${os.directClicks}`}>
                                Dir {os.directClicks}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty-row">
                          No operating systems recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Web Browsers Table with Versions */}
            <div className="geo-table-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🌐</span> Web Browsers & Versions
                </h4>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {browsers.length} detected
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="custom-links-table" style={{ width: "100%", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "36px", textAlign: "center" }}>#</th>
                      <th>Browser Engine</th>
                      <th style={{ textAlign: "right" }}>Clicks</th>
                      <th style={{ width: "130px" }}>Share</th>
                      <th style={{ textAlign: "right" }}>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {browsers.length > 0 ? (
                      browsers.map((b) => (
                        <tr key={b.name}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{b.rank}</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "16px" }}>{getBrowserIcon(b.name)}</span>
                                <strong style={{ color: "var(--text-primary)" }}>{b.name}</strong>
                              </div>
                              {/* Detected Browser Versions */}
                              {b.versions && b.versions.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
                                  {b.versions.map((ver) => (
                                    <span
                                      key={ver.version}
                                      style={{
                                        fontSize: "10px",
                                        background: "rgba(255, 255, 255, 0.06)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "3px",
                                        padding: "1px 5px",
                                        color: "var(--text-secondary)",
                                      }}
                                      title={`${ver.clicks} clicks (${b.totalClicks > 0 ? ((ver.clicks / b.totalClicks) * 100).toFixed(0) : 0}%)`}
                                    >
                                      v{ver.version} ({ver.clicks})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600", color: "#fff" }}>
                            {b.totalClicks.toLocaleString()}
                          </td>
                          <td>
                            <div className="geo-progress-cluster">
                              <div className="geo-progress-bar-bg">
                                <div
                                  className="geo-progress-bar-fill"
                                  style={{
                                    width: `${b.percentage}%`,
                                    background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
                                  }}
                                />
                              </div>
                              <span className="geo-percentage-text">{b.percentage}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                              <span className="geo-channel-pill qr" title={`QR Scans: ${b.qrClicks}`}>
                                QR {b.qrClicks}
                              </span>
                              <span className="geo-channel-pill direct" title={`Direct Clicks: ${b.directClicks}`}>
                                Dir {b.directClicks}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty-row">
                          No web browsers recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 9. Hardware Analytics: Manufacturer Breakdown & Detected Models */}
          <div className={`geo-tables-grid ${deviceLoading ? "data-refreshing" : ""}`}>
            {/* Manufacturer Breakdown */}
            <div className="geo-table-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🏭</span> Hardware Manufacturers
                </h4>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {vendors.length} detected
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="custom-links-table" style={{ width: "100%", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "36px", textAlign: "center" }}>#</th>
                      <th>Manufacturer</th>
                      <th style={{ textAlign: "right" }}>Clicks</th>
                      <th style={{ width: "130px" }}>Share</th>
                      <th style={{ textAlign: "right" }}>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.length > 0 ? (
                      vendors.map((v) => (
                        <tr key={v.name}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{v.rank}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "16px" }}>{getVendorIcon(v.name)}</span>
                              <strong style={{ color: "var(--text-primary)" }}>{v.name}</strong>
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600", color: "#fff" }}>
                            {v.totalClicks.toLocaleString()}
                          </td>
                          <td>
                            <div className="geo-progress-cluster">
                              <div className="geo-progress-bar-bg">
                                <div
                                  className="geo-progress-bar-fill"
                                  style={{
                                    width: `${v.percentage}%`,
                                    background: "linear-gradient(90deg, #F59E0B, #FBBF24)",
                                  }}
                                />
                              </div>
                              <span className="geo-percentage-text">{v.percentage}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                              <span className="geo-channel-pill qr" title={`QR Scans: ${v.qrClicks}`}>
                                QR {v.qrClicks}
                              </span>
                              <span className="geo-channel-pill direct" title={`Direct Clicks: ${v.directClicks}`}>
                                Dir {v.directClicks}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty-row">
                          No hardware manufacturers recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detected Hardware Models */}
            <div className="geo-table-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📱</span> Detected Device Models
                </h4>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {models.length} recognized
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="custom-links-table" style={{ width: "100%", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "36px", textAlign: "center" }}>#</th>
                      <th>Device Model</th>
                      <th>Vendor</th>
                      <th style={{ textAlign: "right" }}>Clicks</th>
                      <th style={{ textAlign: "right" }}>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.length > 0 ? (
                      models.map((m) => (
                        <tr key={`${m.vendor}-${m.name}`}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{m.rank}</td>
                          <td>
                            <strong style={{ color: "var(--text-primary)" }}>{m.name}</strong>
                          </td>
                          <td>
                            <span className="geo-table-iso-pill" style={{ color: "var(--text-secondary)" }}>
                              {m.vendor}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "600", color: "#fff" }}>
                            {m.totalClicks.toLocaleString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                              <span className="geo-channel-pill qr" title={`QR Scans: ${m.qrClicks}`}>
                                QR {m.qrClicks}
                              </span>
                              <span className="geo-channel-pill direct" title={`Direct Clicks: ${m.directClicks}`}>
                                Dir {m.directClicks}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="table-empty-row">
                          No specific mobile hardware models recognized yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="city-geo-accuracy-notice" style={{ marginTop: "10px" }}>
                <strong>Hardware Detection Note:</strong> Device models are extracted from standard HTTP client headers (e.g., iPhone, iPad, Mac, Pixel, Galaxy). Desktop PC configurations do not advertise physical hardware motherboard/chassis models.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
