// =============================================================================
// CHANGE: Stage 11 Link Comparison View — 2026-11-16
// Comprehensive side-by-side multi-link performance benchmarking view.
// Compares total clicks, QR vs direct visits, device categories, geographic
// traffic (countries/cities), and aligned daily traffic trends.
// =============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import SpecularButton from "./SpecularButton";
import StatCard from "./ui/StatCard";
import { ArrowRightLeft, Trophy, AlertTriangle, Info, X, Smartphone, Monitor, Tablet, HardDrive, QrCode, Globe, TrendingUp } from "lucide-react";

export const LINK_COLORS = [
  "var(--accent)", // 0: Primary accent
  "#64748B",       // 1: Slate
  "#94A3B8",       // 2: Light slate
  "#475569",       // 3: Dark slate
  "#CBD5E1",       // 4: Pale slate
];

export const getLinkColor = (index) => LINK_COLORS[index % LINK_COLORS.length];

// -----------------------------------------------------------------------------
// Helper: Shorten Long URLs cleanly
// -----------------------------------------------------------------------------
const formatUrl = (url, maxLen = 38) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
    return display.length > maxLen ? `${display.slice(0, maxLen)}…` : display;
  } catch (_) {
    return url.length > maxLen ? `${url.slice(0, maxLen)}…` : url;
  }
};

// -----------------------------------------------------------------------------
// Helper: Format Date string for Tooltip / Legend
// -----------------------------------------------------------------------------
const formatTrendDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt);
  } catch (_) {
    return dateStr;
  }
};

// =============================================================================
// 1. Link Selector & Pill Tray Component
// =============================================================================
function LinkSelector({
  availableLinks = [],
  selectedIds = [],
  onSelectLink,
  onRemoveLink,
  onSelectPreset,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unselectedLinks = useMemo(() => {
    return availableLinks.filter(
      (l) =>
        !selectedIds.includes(l._id) &&
        (l.shortCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.originalUrl?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [availableLinks, selectedIds, searchTerm]);

  const selectedLinkObjects = useMemo(() => {
    return selectedIds
      .map((id) => availableLinks.find((l) => l._id === id))
      .filter(Boolean);
  }, [selectedIds, availableLinks]);

  return (
    <div className="comparison-selector-card">
      <div className="comparison-selector-header">
        <div>
          <h3 className="comparison-selector-title">
            Compare short links
          </h3>
          <p className="comparison-selector-subtitle">
            Select 2 or more short links to benchmark performance.
          </p>
        </div>

        <div className="comparison-preset-actions">
          {availableLinks.length >= 2 && (
            <button
              type="button"
              className="comparison-action-btn"
              onClick={() => onSelectPreset("top2")}
              title="Select first 2 links"
            >
              Top 2 Links
            </button>
          )}
          {availableLinks.length >= 3 && (
            <button
              type="button"
              className="comparison-action-btn"
              onClick={() => onSelectPreset("top3")}
              title="Select first 3 links"
            >
              Top 3 Links
            </button>
          )}
          {selectedIds.length > 0 && (
            <button
              type="button"
              className="comparison-action-btn clear"
              onClick={() => onSelectPreset("clear")}
              title="Clear all selected links"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Selected Links Tray */}
      <div className="selected-links-tray">
        {selectedLinkObjects.map((link, idx) => {
          const color = getLinkColor(idx);
          return (
            <div
              key={link._id}
              className="selected-link-chip"
              style={{
                borderColor: idx === 0 ? "var(--accent)" : "var(--border)",
                backgroundColor: idx === 0 ? "var(--accent-soft)" : "var(--surface-2)",
              }}
            >
              <span
                className="selected-link-color-dot"
                style={{ backgroundColor: color }}
              />
              <div className="selected-link-info">
                <strong style={{ color: "var(--text)" }}>s/{link.shortCode}</strong>
                <span className="selected-link-dest" title={link.originalUrl}>
                  {formatUrl(link.originalUrl, 26)}
                </span>
              </div>
              <button
                type="button"
                className="selected-link-remove-btn"
                onClick={() => onRemoveLink(link._id)}
                aria-label={`Remove s/${link.shortCode} from comparison`}
                title="Remove link"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Add Link Dropdown Trigger */}
        <div className="add-link-dropdown-wrapper" ref={dropdownRef}>
          <SpecularButton
            type="button"
            variant="cyan"
            size="sm"
            className="add-link-trigger-btn"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
          >
            <span>+</span> Add Link to Compare
          </SpecularButton>

          {isOpen && (
            <div className="add-link-dropdown-menu">
              <div className="add-link-search-box">
                <input
                  type="text"
                  placeholder="Search your links..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="add-link-list">
                {unselectedLinks.length > 0 ? (
                  unselectedLinks.map((link) => (
                    <button
                      key={link._id}
                      type="button"
                      className="add-link-item"
                      onClick={() => {
                        onSelectLink(link._id);
                        setSearchTerm("");
                        setIsOpen(false);
                      }}
                    >
                      <div className="add-link-item-left">
                        <strong>s/{link.shortCode}</strong>
                        <span className="add-link-dest">{formatUrl(link.originalUrl, 34)}</span>
                      </div>
                      <span className="add-link-clicks">{link.clicks || 0} clicks</span>
                    </button>
                  ))
                ) : (
                  <div className="add-link-empty">
                    {availableLinks.length === 0
                      ? "No links found in your account"
                      : unselectedLinks.length === 0 && selectedIds.length === availableLinks.length
                      ? "All your links are currently selected"
                      : "No matching links found"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedIds.length < 2 && (
        <div className="comparison-warning-banner">
          <Info size={15} style={{ color: "var(--accent)" }} />
          <span>
            Please select at least <strong>2 links</strong> to enable side-by-side performance comparison.
            ({selectedIds.length} of 2 selected)
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 2. Best Performer Highlight Banner
// =============================================================================
function BestPerformerBanner({ bestPerformer, totalClicksCombined = 0 }) {
  if (!bestPerformer) {
    return (
      <div className="comparison-best-performer-card empty">
        <div className="best-performer-icon"><ArrowRightLeft size={16} /></div>
        <div>
          <h4 className="best-performer-title">No clicks recorded</h4>
          <p className="best-performer-subtext">
            None of the selected links have recorded clicks within the selected date range.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-best-performer-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
      <div className="best-performer-left">
        <div style={{ color: "var(--text-muted)" }}><Trophy size={18} /></div>
        <div>
          <span style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-muted)" }}>Top performing link</span>
          <h4 className="best-performer-title" style={{ fontSize: "15px", fontWeight: "600", margin: "2px 0", color: "var(--text)" }}>
            s/{bestPerformer.shortCode}
            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "4px" }}>
              {bestPerformer.totalClicks.toLocaleString()} clicks
            </span>
          </h4>
          <p className="best-performer-url" title={bestPerformer.originalUrl} style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
            {formatUrl(bestPerformer.originalUrl, 50)}
          </p>
        </div>
      </div>

      <div className="best-performer-right">
        <div className="best-performer-metric">
          <span className="metric-num" style={{ fontSize: "24px", fontWeight: "600", fontFamily: "var(--font-mono, monospace)", color: "var(--text)" }}>
            {bestPerformer.percentageOfTotal}%
          </span>
          <span className="metric-label" style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-muted)" }}>
            Share of group traffic
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 3. Comparison KPI Metric Cards Grid
// =============================================================================
function ComparisonKPICards({ links = [], summary = {}, range = "7d" }) {
  return (
    <div className="comparison-kpi-cards-section">
      {/* High level combined stats */}
      <div className="metrics-grid" style={{ marginBottom: "16px" }}>
        <StatCard
          label="Combined clicks"
          value={(summary.totalClicksCombined || 0).toLocaleString()}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Total QR scans"
          value={(summary.totalQRCombined || 0).toLocaleString()}
          icon={<QrCode size={18} />}
        />
        <StatCard
          label="Total direct visits"
          value={(summary.totalDirectCombined || 0).toLocaleString()}
          icon={<Globe size={18} />}
        />
        <StatCard
          label="Primary channel"
          value={(summary.totalQRCombined || 0) >= (summary.totalDirectCombined || 0) ? "QR Scans" : "Direct Visits"}
          icon={<ArrowRightLeft size={18} />}
        />
      </div>

      {/* Individual Link Cards Grid */}
      <div className="comparison-links-cards-grid">
        {links.map((link, idx) => {
          const color = getLinkColor(idx);
          const topDevice = link.devices?.slice().sort((a, b) => b.count - a.count)[0];
          const topCountry = link.topCountries?.[0];

          return (
            <div
              key={link._id}
              className="comparison-link-card"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <div className="comparison-link-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    className="selected-link-color-dot"
                    style={{ backgroundColor: color }}
                  />
                  <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                    s/{link.shortCode}
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    backgroundColor: `${color}25`,
                    color: color,
                  }}
                >
                  Link {idx + 1}
                </span>
              </div>

              <p className="comparison-link-dest" title={link.originalUrl}>
                {formatUrl(link.originalUrl, 32)}
              </p>

              <div className="comparison-link-stat-row">
                <span className="stat-label">
                  {range === "all" ? "All-Time Clicks" : "Clicks in Period"}
                </span>
                <strong className="stat-value">{link.totalClicks.toLocaleString()}</strong>
              </div>

              {range !== "all" && typeof link.allTimeTotalClicks === "number" && (
                <div className="comparison-link-stat-row">
                  <span className="stat-label">All-Time Total</span>
                  <span className="stat-value" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {link.allTimeTotalClicks.toLocaleString()} clicks
                  </span>
                </div>
              )}

              <div className="comparison-link-stat-row">
                <span className="stat-label">QR vs Direct</span>
                <span className="stat-value" style={{ fontSize: "12px" }}>
                  <span style={{ color: "var(--accent-purple)", fontWeight: "600" }}>
                    {link.qrClicks} QR ({link.qrPercentage}%)
                  </span>
                  {" · "}
                  <span style={{ color: "#06B6D4", fontWeight: "600" }}>
                    {link.directClicks} Dir ({link.directPercentage}%)
                  </span>
                </span>
              </div>

              <div className="comparison-link-stat-row">
                <span className="stat-label">Top Device</span>
                <span className="stat-value" style={{ fontSize: "12px" }}>
                  {topDevice && topDevice.count > 0
                    ? `${topDevice.label} (${topDevice.percentage}%)`
                    : "None recorded"}
                </span>
              </div>

              <div className="comparison-link-stat-row">
                <span className="stat-label">Top Country</span>
                <span className="stat-value" style={{ fontSize: "12px" }}>
                  {topCountry
                    ? `${topCountry.country} (${topCountry.count})`
                    : "None recorded"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 4. Chart 1: Total Click Comparison (Bar Chart)
// =============================================================================
function TotalClicksBarChart({ links = [] }) {
  const maxClicks = useMemo(() => {
    return Math.max(1, ...links.map((l) => l.totalClicks));
  }, [links]);

  const totalAllClicks = useMemo(() => {
    return links.reduce((sum, l) => sum + l.totalClicks, 0);
  }, [links]);

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Total click comparison
          </h3>
          <p className="traffic-chart-subtitle">
            Relative click volume across selected short links.
          </p>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {totalAllClicks.toLocaleString()} total clicks
        </span>
      </div>

      <div className="comparison-bars-container">
        {links.map((link, idx) => {
          const color = getLinkColor(idx);
          const pctOfMax = Math.round((link.totalClicks / maxClicks) * 100);
          const pctOfGroup =
            totalAllClicks > 0
              ? Math.round((link.totalClicks / totalAllClicks) * 100)
              : 0;

          return (
            <div key={link._id} className="comparison-bar-row">
              <div className="comparison-bar-label">
                <span
                  className="selected-link-color-dot"
                  style={{ backgroundColor: color }}
                />
                <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                  s/{link.shortCode}
                </strong>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginLeft: "4px",
                  }}
                  title={link.originalUrl}
                >
                  ({formatUrl(link.originalUrl, 22)})
                </span>
              </div>

              <div className="comparison-bar-track">
                <div
                  className="comparison-bar-fill"
                  style={{
                    width: `${Math.max(2, pctOfMax)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              <div className="comparison-bar-values">
                <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                  {link.totalClicks.toLocaleString()}
                </strong>
                <span className="comparison-bar-share">{pctOfGroup}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 5. Chart 2: QR vs Direct Comparison (Grouped Bar Chart)
// =============================================================================
function QRvsDirectGroupedChart({ links = [] }) {
  const maxSegment = useMemo(() => {
    let max = 1;
    links.forEach((l) => {
      if (l.qrClicks > max) max = l.qrClicks;
      if (l.directClicks > max) max = l.directClicks;
    });
    return max;
  }, [links]);

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            QR scans vs direct visits
          </h3>
          <p className="traffic-chart-subtitle">
            Channel acquisition split across compared links.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: "var(--accent)",
                borderRadius: "2px",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>QR</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: "#64748B",
                borderRadius: "2px",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Direct</span>
          </div>
        </div>
      </div>

      <div className="comparison-grouped-bars-list">
        {links.map((link, idx) => {
          const color = getLinkColor(idx);
          const qrPct = Math.round((link.qrClicks / maxSegment) * 100);
          const directPct = Math.round((link.directClicks / maxSegment) * 100);

          return (
            <div key={link._id} className="grouped-bar-group">
              <div className="grouped-bar-header">
                <span
                  className="selected-link-color-dot"
                  style={{ backgroundColor: color }}
                />
                <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                  s/{link.shortCode}
                </strong>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {link.totalClicks} total clicks
                </span>
              </div>

              {/* QR Bar */}
              <div className="grouped-bar-subrow">
                <span className="grouped-bar-sublabel" style={{ color: "var(--text-muted)" }}>
                  QR Scans
                </span>
                <div className="comparison-bar-track">
                  <div
                    className="comparison-bar-fill"
                    style={{
                      width: `${Math.max(link.qrClicks > 0 ? 3 : 0, qrPct)}%`,
                      backgroundColor: "var(--accent)",
                    }}
                  />
                </div>
                <span className="grouped-bar-val">
                  {link.qrClicks} ({link.qrPercentage}%)
                </span>
              </div>

              {/* Direct Bar */}
              <div className="grouped-bar-subrow">
                <span className="grouped-bar-sublabel" style={{ color: "var(--text-muted)" }}>
                  Direct Visits
                </span>
                <div className="comparison-bar-track">
                  <div
                    className="comparison-bar-fill"
                    style={{
                      width: `${Math.max(link.directClicks > 0 ? 3 : 0, directPct)}%`,
                      backgroundColor: "#64748B",
                    }}
                  />
                </div>
                <span className="grouped-bar-val">
                  {link.directClicks} ({link.directPercentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 6. Chart 3: Device Distribution Comparison
// =============================================================================
function DeviceDistributionComparison({ links = [] }) {
  const deviceColors = {
    mobile: "var(--accent)",
    desktop: "#64748B",
    tablet: "#94A3B8",
    unknown: "#CBD5E1",
  };

  const deviceIcons = {
    mobile: <Smartphone size={13} />,
    desktop: <Monitor size={13} />,
    tablet: <Tablet size={13} />,
    unknown: <HardDrive size={13} />,
  };

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Device category breakdown
          </h3>
          <p className="traffic-chart-subtitle">
            Visitor hardware segmentation comparison per link.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {["mobile", "desktop", "tablet", "unknown"].map((dev) => (
            <span
              key={dev}
              style={{
                fontSize: "11px",
                color: deviceColors[dev],
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>{deviceIcons[dev]}</span>
              <span style={{ textTransform: "capitalize" }}>{dev}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="comparison-device-breakdown-list">
        {links.map((link, idx) => {
          const color = getLinkColor(idx);
          return (
            <div key={link._id} className="device-link-breakdown-card">
              <div className="device-link-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    className="selected-link-color-dot"
                    style={{ backgroundColor: color }}
                  />
                  <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                    s/{link.shortCode}
                  </strong>
                </div>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {link.totalClicks} clicks
                </span>
              </div>

              {/* Stacked Device Progress Bar */}
              <div className="device-stacked-bar">
                {link.devices?.map((dev) => {
                  if (dev.percentage === 0) return null;
                  return (
                    <div
                      key={dev.deviceType}
                      title={`${dev.label}: ${dev.count} clicks (${dev.percentage}%)`}
                      style={{
                        width: `${dev.percentage}%`,
                        backgroundColor: deviceColors[dev.deviceType] || "#94A3B8",
                        height: "100%",
                        transition: "width 0.2s ease",
                      }}
                    />
                  );
                })}
              </div>

              {/* Grid of 4 device stats */}
              <div className="device-segments-grid">
                {link.devices?.map((dev) => (
                  <div key={dev.deviceType} className="device-segment-chip">
                    <span style={{ fontSize: "12px" }}>{deviceIcons[dev.deviceType]}</span>
                    <span className="dev-name">{dev.label}</span>
                    <strong className="dev-count" style={{ color: deviceColors[dev.deviceType] }}>
                      {dev.percentage}%
                    </strong>
                    <span className="dev-raw">({dev.count})</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 7. Chart 4: Geographic Traffic Comparison (Countries & Cities)
// =============================================================================
function GeographicComparison({ links = [] }) {
  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Geographic traffic comparison
          </h3>
          <p className="traffic-chart-subtitle">
            Top countries and cities driving visitors.
          </p>
        </div>
      </div>

      <div className="comparison-geo-grid">
        {links.map((link, idx) => {
          const color = getLinkColor(idx);
          return (
            <div key={link._id} className="geo-link-card">
              <div className="geo-link-header">
                <span
                  className="selected-link-color-dot"
                  style={{ backgroundColor: color }}
                />
                <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                  s/{link.shortCode}
                </strong>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {link.totalClicks} clicks
                </span>
              </div>

              <div className="geo-columns-wrapper">
                {/* Top Countries */}
                <div className="geo-subcol">
                  <span className="geo-subcol-title">Top Countries</span>
                  {link.topCountries && link.topCountries.length > 0 ? (
                    link.topCountries.map((c, cIdx) => (
                      <div key={cIdx} className="geo-row">
                        <span className="geo-name" title={c.country}>
                          {c.country}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="geo-count">{c.count}</span>
                          <span className="geo-pct">{c.percentage}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="geo-empty-text">No country data recorded</span>
                  )}
                </div>

                {/* Top Cities */}
                <div className="geo-subcol">
                  <span className="geo-subcol-title">Top Cities</span>
                  {link.topCities && link.topCities.length > 0 ? (
                    link.topCities.map((city, ctIdx) => (
                      <div key={ctIdx} className="geo-row">
                        <span className="geo-name" title={`${city.city}, ${city.country}`}>
                          {city.city}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="geo-count">{city.count}</span>
                          <span className="geo-pct">{city.percentage}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="geo-empty-text">No city data recorded</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 8. Chart 5: Daily Traffic Trend Comparison (Multi-Line Chart)
// =============================================================================
function MultiLineDailyTrendChart({ links = [], dates = [] }) {
  const [hoveredDateIdx, setHoveredDateIdx] = useState(null);

  const width = 800;
  const height = 260;
  const padLeft = 46;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = padTop + innerH;

  // Find max clicks across all dates and all links
  const maxClicks = useMemo(() => {
    let max = 0;
    links.forEach((l) => {
      (l.dailySeries || []).forEach((pt) => {
        if (pt.totalClicks > max) max = pt.totalClicks;
      });
    });
    return Math.max(2, Math.ceil(max * 1.15));
  }, [links]);

  // Compute point coordinates for each link
  const linkLines = useMemo(() => {
    if (!dates || dates.length === 0) return [];
    const count = dates.length;

    return links.map((link, linkIdx) => {
      const color = getLinkColor(linkIdx);
      const points = dates.map((dateStr, idx) => {
        const x = padLeft + (count === 1 ? innerW / 2 : (idx / (count - 1)) * innerW);
        const pt = (link.dailySeries || []).find((p) => p.date === dateStr);
        const clicks = pt ? pt.totalClicks : 0;
        const y = zeroY - (clicks / maxClicks) * innerH;
        return { x, y, clicks, date: dateStr };
      });

      // Construct SVG path
      let pathD = "";
      if (points.length > 0) {
        pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
          pathD += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
        }
      }

      return {
        link,
        color,
        points,
        pathD,
      };
    });
  }, [links, dates, maxClicks, innerW, innerH, padLeft, zeroY]);

  const yTicks = useMemo(() => {
    return [0, Math.round(maxClicks / 2), maxClicks];
  }, [maxClicks]);

  const labelStep = Math.max(1, Math.ceil(dates.length / 8));

  const hoveredDate = hoveredDateIdx !== null ? dates[hoveredDateIdx] : null;

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Daily traffic trend comparison
          </h3>
          <p className="traffic-chart-subtitle">
            Daily visitor trajectories across compared links.
          </p>
        </div>

        {/* Legend */}
        <div className="comparison-trend-legend">
          {links.map((link, idx) => {
            const color = getLinkColor(idx);
            return (
              <div key={link._id} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: color }}
                />
                <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: "600" }}>
                  s/{link.shortCode}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: "260px" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {/* Gridlines */}
          {yTicks.map((val) => {
            const y = zeroY - (val / maxClicks) * innerH;
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10.5px"
                >
                  {val.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Hover guideline */}
          {hoveredDateIdx !== null && dates.length > 0 && (
            <line
              x1={
                padLeft +
                (dates.length === 1
                  ? innerW / 2
                  : (hoveredDateIdx / (dates.length - 1)) * innerW)
              }
              y1={padTop}
              x2={
                padLeft +
                (dates.length === 1
                  ? innerW / 2
                  : (hoveredDateIdx / (dates.length - 1)) * innerW)
              }
              y2={zeroY}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
          )}

          {/* Line paths */}
          {linkLines.map((item) => (
            <path
              key={item.link._id}
              d={item.pathD}
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Interactive dots and hit zones */}
          {linkLines.map((item) =>
            item.points.map((p, pIdx) => {
              const isHovered = hoveredDateIdx === pIdx;
              return (
                <circle
                  key={`${item.link._id}_${pIdx}`}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : 3}
                  fill={item.color}
                  stroke="#0F172A"
                  strokeWidth="2"
                  style={{
                    transition: "r 0.15s ease",
                    cursor: "pointer",
                  }}
                />
              );
            })
          )}

          {/* Transparent hit boxes for each date index */}
          {dates.map((_, idx) => {
            const count = dates.length;
            const sliceW = count > 1 ? innerW / (count - 1) : innerW;
            const x =
              count === 1
                ? padLeft
                : padLeft + idx * sliceW - sliceW / 2;
            return (
              <rect
                key={idx}
                x={Math.max(padLeft, x)}
                y={padTop}
                width={count === 1 ? innerW : Math.min(sliceW, width - padRight - x)}
                height={innerH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHoveredDateIdx(idx)}
                onMouseLeave={() => setHoveredDateIdx(null)}
              />
            );
          })}

          {/* X Axis Date Labels */}
          {dates.map((dateStr, idx) => {
            if (idx % labelStep !== 0 && idx !== dates.length - 1) return null;
            const x =
              padLeft +
              (dates.length === 1
                ? innerW / 2
                : (idx / (dates.length - 1)) * innerW);
            return (
              <text
                key={dateStr}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10.5px"
              >
                {formatTrendDate(dateStr)}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Bubble */}
        {hoveredDateIdx !== null && hoveredDate && (
          <div
            className="chart-tooltip-bubble comparison-multi-tooltip"
            style={{
              left: `${Math.min(
                Math.max(
                  8,
                  ((padLeft +
                    (dates.length === 1
                      ? innerW / 2
                      : (hoveredDateIdx / (dates.length - 1)) * innerW)) /
                    width) *
                    100
                ),
                80
              )}%`,
              top: "14px",
            }}
          >
            <div className="chart-tooltip-title">{formatTrendDate(hoveredDate)}</div>
            {linkLines.map((item) => {
              const pt = item.points[hoveredDateIdx];
              return (
                <div key={item.link._id} className="chart-tooltip-row">
                  <span
                    className="tooltip-swatch"
                    style={{ backgroundColor: item.color }}
                  />
                  <span style={{ color: "var(--text)", fontWeight: "600" }}>
                    s/{item.link.shortCode}:
                  </span>
                  <span>{pt ? pt.clicks.toLocaleString() : 0} clicks</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component: LinkComparisonView
// =============================================================================
export default function LinkComparisonView({
  links = [],
  token = "",
  apiBaseUrl = "",
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [range, setRange] = useState("7d");
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortControllerRef = useRef(null);

  // Initialize selectedIds with first 2 links when links become available
  useEffect(() => {
    if (selectedIds.length === 0 && links.length >= 2) {
      setSelectedIds([links[0]._id, links[1]._id]);
    } else if (selectedIds.length === 0 && links.length === 1) {
      setSelectedIds([links[0]._id]);
    }
  }, [links]);

  // Fetch comparison analytics whenever selectedIds or range changes
  const fetchComparison = useCallback(
    async (curRange = range, curIds = selectedIds) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      if (!curIds || curIds.length < 2) {
        setComparisonData(null);
        setLoading(false);
        setError("");
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentSignal = abortControllerRef.current.signal;

      setLoading(true);
      setError("");

      try {
        const url = `${apiBaseUrl}/api/links/user/analytics/comparison?linkIds=${curIds.join(
          ","
        )}&range=${curRange}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${activeToken}` },
          signal: currentSignal,
        });

        if (res.data?.success) {
          setComparisonData(res.data);
        } else {
          setError(res.data?.message || "Failed to fetch link comparison analytics");
        }
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("Fetch link comparison error:", err);
        setError(
          err.response?.data?.message ||
            "Unable to load link comparison analytics. Please check connection."
        );
      } finally {
        setLoading(false);
      }
    },
    [token, apiBaseUrl, range, selectedIds]
  );

  // Trigger fetch when selectedIds or range changes
  useEffect(() => {
    if (selectedIds.length >= 2) {
      fetchComparison(range, selectedIds);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedIds, range, fetchComparison]);

  // Selection handlers
  const handleSelectLink = (id) => {
    if (!selectedIds.includes(id)) {
      const updated = [...selectedIds, id];
      setSelectedIds(updated);
    }
  };

  const handleRemoveLink = (id) => {
    const updated = selectedIds.filter((item) => item !== id);
    setSelectedIds(updated);
  };

  const handleSelectPreset = (preset) => {
    if (preset === "top2" && links.length >= 2) {
      setSelectedIds([links[0]._id, links[1]._id]);
    } else if (preset === "top3" && links.length >= 3) {
      setSelectedIds([links[0]._id, links[1]._id, links[2]._id]);
    } else if (preset === "clear") {
      setSelectedIds([]);
      setComparisonData(null);
    }
  };

  const handleRangeChange = (newRange) => {
    setRange(newRange);
  };

  return (
    <div className="comparison-view-container">
      {/* Top Header & Date Filters */}
      <div className="traffic-chart-header" style={{ marginBottom: "16px" }}>
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "var(--text)",
              margin: "0 0 4px 0",
            }}
          >
            Link comparison
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            Side-by-side performance benchmarking across short links.
          </p>
        </div>

        {/* Date Filter Pills & Refresh Button */}
        <div className="traffic-header-controls">
          <div className="traffic-filter-pills" role="group" aria-label="Date Range Filters">
            <button
              type="button"
              className={`traffic-pill-btn ${range === "7d" ? "active" : ""}`}
              onClick={() => handleRangeChange("7d")}
              disabled={loading}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`traffic-pill-btn ${range === "30d" ? "active" : ""}`}
              onClick={() => handleRangeChange("30d")}
              disabled={loading}
            >
              30 Days
            </button>
            <button
              type="button"
              className={`traffic-pill-btn ${range === "all" ? "active" : ""}`}
              onClick={() => handleRangeChange("all")}
              disabled={loading}
            >
              All Time
            </button>
          </div>

          <SpecularButton
            type="button"
            variant="secondary"
            size="md"
            className="traffic-refresh-btn"
            onClick={() => fetchComparison(range, selectedIds)}
            disabled={loading || selectedIds.length < 2}
            title="Refresh link comparison"
            aria-label="Refresh link comparison"
          >
            <span
              className={`refresh-icon ${loading ? "spinning" : ""}`}
              aria-hidden="true"
            >
              ↻
            </span>
            <span>Refresh</span>
          </SpecularButton>
        </div>
      </div>

      {/* 1. Link Selection Tray */}
      <LinkSelector
        availableLinks={links}
        selectedIds={selectedIds}
        onSelectLink={handleSelectLink}
        onRemoveLink={handleRemoveLink}
        onSelectPreset={handleSelectPreset}
      />

      {/* Error Banner */}
      {error && (
        <div className="analytics-error-banner" style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={15} style={{ color: "var(--danger)" }} /> <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="analytics-loading-spinner" style={{ padding: "40px 0" }}>
          <div className="spinner" />
          <p style={{ color: "var(--text-muted)", marginTop: "12px", fontSize: "13px" }}>
            Aggregating comparative metrics across selected links...
          </p>
        </div>
      )}

      {/* Main Comparison Data Render */}
      {!loading && comparisonData && selectedIds.length >= 2 && (
        <>
          {/* 2. Best Performer Banner */}
          <BestPerformerBanner
            bestPerformer={comparisonData.summary?.bestPerformer}
            totalClicksCombined={comparisonData.summary?.totalClicksCombined}
          />

          {/* 3. Comparison KPI Cards */}
          <ComparisonKPICards
            links={comparisonData.links || []}
            summary={comparisonData.summary || {}}
            range={range}
          />

          {/* 4. Full Width: Daily Traffic Trend Comparison */}
          <MultiLineDailyTrendChart
            links={comparisonData.links || []}
            dates={comparisonData.dates || []}
          />

          {/* 5. Two Column Grid: Total Clicks & QR vs Direct */}
          <div className="traffic-charts-grid-2col">
            <TotalClicksBarChart links={comparisonData.links || []} />
            <QRvsDirectGroupedChart links={comparisonData.links || []} />
          </div>

          {/* 6. Two Column Grid: Devices & Geographic */}
          <div className="traffic-charts-grid-2col">
            <DeviceDistributionComparison links={comparisonData.links || []} />
            <GeographicComparison links={comparisonData.links || []} />
          </div>
        </>
      )}

      {/* Empty State when fewer than 2 links selected */}
      {!loading && selectedIds.length < 2 && (
        <div className="comparison-empty-selection-card">
          <div style={{ marginBottom: "12px", color: "var(--accent)" }}><ArrowRightLeft size={36} /></div>
          <h3 style={{ color: "var(--text)", fontSize: "17px", margin: "0 0 6px 0" }}>
            Select Links to Benchmark
          </h3>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              maxWidth: "460px",
              margin: "0 auto 18px",
            }}
          >
            Choose at least two short links using the selector above to generate instant side-by-side
            comparative analytics across visitor volume, QR channels, hardware, and regions.
          </p>
          {links.length >= 2 && (
            <button
              type="button"
              className="traffic-pill-btn active"
              onClick={() => handleSelectPreset("top2")}
              style={{ padding: "8px 18px", fontSize: "13px" }}
            >
              Compare My Top 2 Links
            </button>
          )}
        </div>
      )}
    </div>
  );
}
