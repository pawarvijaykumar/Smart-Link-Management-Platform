// =============================================================================
// CHANGE: Stage 12 Smart Traffic Anomaly Detection View — 2026-11-16
// AI-driven statistical surveillance detecting unusual traffic spikes,
// sudden drops, and channel shifts in real-time with dynamic threshold bands.
// Updated: 2026-11-17 for precision baseline calculation & zero-baseline safety.
// =============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import SpecularButton from "./SpecularButton";
import { ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, TrendingUp, TrendingDown, Info, X } from "lucide-react";

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
// 1. Diagnostic Details Modal Popup
// =============================================================================
function AnomalyDetailModal({
  item,
  onClose,
  onAcknowledge,
  onResolve,
  actionLoading,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  // Determine if modal is opened for an anomaly event or a link health surveillance record
  const isAnomalyEvent = Boolean(item.type && (item.type === "SPIKE" || item.type === "DROP"));
  const isLinkHealth = Boolean(item.averageClicksPerDay !== undefined);

  const isSpike = isAnomalyEvent
    ? item.type === "SPIKE"
    : item.status === "SPIKE_ALERT";
  const isDrop = isAnomalyEvent
    ? item.type === "DROP"
    : item.status === "DROP_ALERT";
  const isHealthy = !isAnomalyEvent && item.status === "HEALTHY";
  const isInsufficient = !isAnomalyEvent && item.status === "INSUFFICIENT_DATA";
  const isInactive = !isAnomalyEvent && item.status === "INACTIVE";

  const statusLabel = isAnomalyEvent
    ? isSpike
      ? "Traffic Spike Alert"
      : "Traffic Drop Alert"
    : isSpike
    ? "Spike Alert"
    : isDrop
    ? "Drop Alert"
    : isHealthy
    ? "Healthy Traffic"
    : isInsufficient
    ? "Insufficient Data"
    : "Inactive Link";

  const icon = isSpike ? (
    <TrendingUp size={20} style={{ color: "var(--accent)" }} />
  ) : isDrop ? (
    <TrendingDown size={20} style={{ color: "var(--danger)" }} />
  ) : isHealthy ? (
    <CheckCircle2 size={20} style={{ color: "var(--success)" }} />
  ) : (
    <Info size={20} style={{ color: "var(--text-muted)" }} />
  );

  return (
    <div className="anomaly-modal-overlay" onClick={onClose}>
      <div className="anomaly-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="anomaly-modal-header">
          <div className="anomaly-modal-title-group">
            <span className="anomaly-modal-icon">{icon}</span>
            <div>
              <h3 className="anomaly-modal-headline">
                {isAnomalyEvent ? item.title : `s/${item.shortCode} - Diagnostic Overview`}
              </h3>
              <p className="anomaly-modal-sub">
                {isAnomalyEvent
                  ? `${formatTrendDate(item.date)} • Severity: ${item.severity} • Status: ${
                      item.status?.toUpperCase() || "NEW"
                    }`
                  : `Link Health Surveillance • ${statusLabel}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="anomaly-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="anomaly-modal-body">
          {/* Link Target Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Monitored Short Link
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ color: "var(--text)", fontSize: "14px" }}>s/{item.shortCode}</strong>
              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>→</span>
              <a
                href={item.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent-purple)",
                  fontSize: "12px",
                  textDecoration: "underline",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "340px",
                }}
              >
                {formatUrl(item.originalUrl, 46)}
              </a>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="anomaly-modal-stats-grid">
            {isAnomalyEvent ? (
              <>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Observed Clicks</span>
                  <span
                    className="anomaly-modal-stat-value"
                    style={{ color: isSpike ? "#34D399" : "#F87171" }}
                  >
                    {item.actualClicks?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Baseline Expected</span>
                  <span className="anomaly-modal-stat-value">
                    {item.expectedClicks?.toLocaleString() || 0} / day
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Deviation from Baseline</span>
                  <span
                    className="anomaly-modal-stat-value"
                    style={{
                      color: isSpike ? "#34D399" : "#F87171",
                      fontSize: item.expectedClicks === 0 ? "13px" : "18px",
                    }}
                  >
                    {item.deviationDisplay ||
                      (item.deviationPercentage !== null && item.deviationPercentage !== undefined
                        ? `${item.deviationPercentage > 0 ? "+" : ""}${item.deviationPercentage}%`
                        : "N/A – baseline is zero")}
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Absolute Difference</span>
                  <span
                    className="anomaly-modal-stat-value"
                    style={{ color: isSpike ? "#34D399" : "#F87171" }}
                  >
                    {item.absoluteDifference !== undefined
                      ? `${item.absoluteDifference > 0 ? "+" : ""}${item.absoluteDifference} clicks`
                      : `${item.actualClicks - item.expectedClicks > 0 ? "+" : ""}${item.actualClicks - item.expectedClicks} clicks`}
                  </span>
                </div>
                <div className="anomaly-modal-stat-box" style={{ gridColumn: "span 2" }}>
                  <span className="anomaly-modal-stat-label">Statistical Z-Score</span>
                  <span className="anomaly-modal-stat-value">
                    Z: {item.zScore !== undefined ? item.zScore : "N/A"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Today ({item.todayDate || "IST"})</span>
                  <span
                    className="anomaly-modal-stat-value"
                    style={{ color: isSpike ? "#34D399" : isDrop ? "#F87171" : "var(--text)" }}
                  >
                    {item.todayClicks?.toLocaleString() || 0} clicks
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Yesterday ({item.yesterdayDate || "IST"})</span>
                  <span className="anomaly-modal-stat-value">
                    {item.yesterdayClicks?.toLocaleString() || 0} clicks
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Daily Baseline (Excluding Today)</span>
                  <span className="anomaly-modal-stat-value">
                    {item.averageClicksPerDay || 0} / day
                  </span>
                </div>
                <div className="anomaly-modal-stat-box">
                  <span className="anomaly-modal-stat-label">Period Total</span>
                  <span className="anomaly-modal-stat-value">
                    {item.totalClicks?.toLocaleString() || 0} clicks
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Baseline Calculation & Historical Period Section */}
          <div className="anomaly-modal-section">
            <span className="anomaly-modal-section-title">
              Baseline Calculation & Historical Period
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>Historical Period Used: </strong>
                <span style={{ color: "var(--text-secondary)" }}>
                  {item.historicalPeriod || "Historical window excluding evaluation period"}
                </span>
              </div>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>Calculation Formula: </strong>
                <span style={{ color: "var(--text-secondary)" }}>
                  {item.baselineCalculation || `${item.expectedClicks || item.averageClicksPerDay || 0} clicks/day baseline average`}
                </span>
              </div>
            </div>
          </div>

          {/* Statistical Baseline / Description Section */}
          <div className="anomaly-modal-section">
            <span className="anomaly-modal-section-title">
              Statistical Baseline Assessment
            </span>
            <p className="anomaly-modal-section-text">
              {isAnomalyEvent
                ? item.description || "Statistical divergence detected from historical baseline."
                : item.baselineExplanation ||
                  (isHealthy
                    ? `Historical baseline average is ${item.averageClicksPerDay} clicks/day. Today's traffic (${item.todayClicks}) is within expected statistical variation (±2σ).`
                    : isInsufficient
                    ? `Link has insufficient historical click volume (${item.totalClicks} clicks) to establish a statistically reliable baseline. Minimum 3–5 active clicks required.`
                    : isInactive
                    ? "Link has recorded 0 clicks during the selected surveillance window."
                    : `Link is exhibiting significant traffic divergence from its historical baseline average (${item.averageClicksPerDay} clicks/day).`)}
            </p>
          </div>

          {/* Root Cause & Recommendations */}
          {(isAnomalyEvent || isSpike || isDrop) && (
            <>
              <div className="anomaly-modal-section">
                <span className="anomaly-modal-section-title">
                  Algorithmic Root Cause (Unverified Hypothesis)
                </span>
                <p className="anomaly-modal-section-text">
                  {item.rootCause ||
                    (isSpike
                      ? "Unverified traffic surge: Potential external promotional campaign, social share, newsletter distribution, or sudden referral influx. Review traffic sources to confirm."
                      : "Unverified traffic drop: Potential campaign expiration, destination endpoint downtime, reduced social post visibility, or natural audience churn.")}
                </p>
              </div>

              <div className="anomaly-modal-section">
                <span className="anomaly-modal-section-title">
                  Recommended Action
                </span>
                <p className="anomaly-modal-section-text">
                  {item.recommendation ||
                    (isSpike
                      ? "1. Inspect Traffic Analytics referral channels and UTM sources to identify the traffic driver. 2. Verify destination server capacity to handle elevated concurrency. 3. Monitor for unusual IP concentrations."
                      : "1. Verify that the destination URL (originalUrl) is reachable and returning HTTP 200. 2. Check active ad campaigns or scheduled social posts for pauses or expiration. 3. Review device and geo distribution for channel-specific drops.")}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer with Lifecycle Actions */}
        <div className="anomaly-modal-footer">
          {isAnomalyEvent && item.id && (
            <>
              {item.status !== "acknowledged" && item.status !== "resolved" && (
                <SpecularButton
                  type="button"
                  variant="cyan"
                  size="sm"
                  className="anomaly-btn ack"
                  disabled={actionLoading}
                  onClick={() => onAcknowledge(item.id)}
                >
                  Acknowledge
                </SpecularButton>
              )}
              {item.status !== "resolved" && (
                <SpecularButton
                  type="button"
                  variant="success"
                  size="sm"
                  className="anomaly-btn resolve"
                  disabled={actionLoading}
                  onClick={() => onResolve(item.id)}
                >
                  Mark Resolved
                </SpecularButton>
              )}
            </>
          )}
          <SpecularButton
            type="button"
            variant="ghost"
            size="sm"
            className="anomaly-btn details"
            onClick={onClose}
          >
            Close
          </SpecularButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 2. Dynamic Statistical Threshold Band Timeline Chart
// =============================================================================
function AnomalyTimelineChart({ timeline = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const width = 800;
  const height = 260;
  const padLeft = 46;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = padTop + innerH;

  const maxVal = useMemo(() => {
    let max = 0;
    timeline.forEach((pt) => {
      if (pt.clicks > max) max = pt.clicks;
      if (pt.upperThreshold > max) max = pt.upperThreshold;
    });
    return Math.max(4, Math.ceil(max * 1.18));
  }, [timeline]);

  const points = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    const count = timeline.length;

    return timeline.map((pt, idx) => {
      const x = padLeft + (count === 1 ? innerW / 2 : (idx / (count - 1)) * innerW);
      const yActual = zeroY - (pt.clicks / maxVal) * innerH;
      const yExpected = zeroY - (pt.expected / maxVal) * innerH;
      const yUpper = zeroY - (pt.upperThreshold / maxVal) * innerH;
      const yLower = zeroY - (pt.lowerThreshold / maxVal) * innerH;

      return {
        ...pt,
        x,
        yActual,
        yExpected,
        yUpper,
        yLower,
      };
    });
  }, [timeline, maxVal, innerW, innerH, padLeft, zeroY]);

  // Construct SVG paths
  const { actualPath, expectedPath, thresholdAreaPath } = useMemo(() => {
    if (points.length === 0) return { actualPath: "", expectedPath: "", thresholdAreaPath: "" };

    let aPath = `M ${points[0].x.toFixed(1)} ${points[0].yActual.toFixed(1)}`;
    let ePath = `M ${points[0].x.toFixed(1)} ${points[0].yExpected.toFixed(1)}`;
    let upperPath = `M ${points[0].x.toFixed(1)} ${points[0].yUpper.toFixed(1)}`;

    for (let i = 1; i < points.length; i++) {
      aPath += ` L ${points[i].x.toFixed(1)} ${points[i].yActual.toFixed(1)}`;
      ePath += ` L ${points[i].x.toFixed(1)} ${points[i].yExpected.toFixed(1)}`;
      upperPath += ` L ${points[i].x.toFixed(1)} ${points[i].yUpper.toFixed(1)}`;
    }

    // Connect upper path to lower path in reverse to make a closed polygon
    let areaPath = upperPath;
    for (let i = points.length - 1; i >= 0; i--) {
      areaPath += ` L ${points[i].x.toFixed(1)} ${points[i].yLower.toFixed(1)}`;
    }
    areaPath += " Z";

    return {
      actualPath: aPath,
      expectedPath: ePath,
      thresholdAreaPath: areaPath,
    };
  }, [points]);

  const yTicks = useMemo(() => {
    const step = maxVal / 4;
    return [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), maxVal];
  }, [maxVal]);

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // Decide date label decimation
  const labelStep = points.length > 20 ? 4 : points.length > 10 ? 2 : 1;

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Dynamic Statistical Threshold Band & Anomalies
          </h3>
          <p className="traffic-chart-subtitle">
            Historical baseline (mean) with dynamic ±2σ confidence bounds against observed click traffic
          </p>
        </div>

        {/* Legend */}
        <div className="anomaly-chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "#8B5CF6" }} />
            <span>Observed Traffic</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-line-dashed"
              style={{ borderBottom: "2px dashed #64748B", width: "16px" }}
            />
            <span>Expected Baseline</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-box"
              style={{
                backgroundColor: "rgba(139, 92, 246, 0.15)",
                border: "1px dashed rgba(139, 92, 246, 0.35)",
              }}
            />
            <span>±2σ Normal Threshold Band</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "#EF4444" }} />
            <span>Spike Anomaly</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "#F59E0B" }} />
            <span>Drop Anomaly</span>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            <linearGradient id="thresholdBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((val) => {
            const y = zeroY - (val / maxVal) * innerH;
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10px"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Threshold Band Fill */}
          {thresholdAreaPath && (
            <path d={thresholdAreaPath} fill="url(#thresholdBandGrad)" />
          )}

          {/* Expected Baseline Line (Dashed) */}
          {expectedPath && (
            <path
              d={expectedPath}
              fill="none"
              stroke="#64748B"
              strokeWidth="1.8"
              strokeDasharray="4 4"
            />
          )}

          {/* Observed Traffic Line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            const isSpike = p.isAnomaly && p.anomalyType === "SPIKE";
            const isDrop = p.isAnomaly && p.anomalyType === "DROP";

            return (
              <g key={p.date}>
                {/* Glow ring for anomalous points */}
                {(isSpike || isDrop) && (
                  <circle
                    cx={p.x}
                    cy={p.yActual}
                    r={isHovered ? 9 : 7}
                    fill="none"
                    stroke={isSpike ? "#EF4444" : "#F59E0B"}
                    strokeWidth="2"
                    style={{
                      animation: "pulseGlow 2s infinite",
                    }}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.yActual}
                  r={isHovered ? 5.5 : p.isAnomaly ? 4.5 : 3}
                  fill={isSpike ? "#EF4444" : isDrop ? "#F59E0B" : "#8B5CF6"}
                  stroke="#0F172A"
                  strokeWidth="2"
                  style={{ transition: "r 0.15s ease", cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* Transparent hit boxes */}
          {points.map((_, idx) => {
            const count = points.length;
            const sliceW = count > 1 ? innerW / (count - 1) : innerW;
            const x = count === 1 ? padLeft : padLeft + idx * sliceW - sliceW / 2;
            return (
              <rect
                key={idx}
                x={Math.max(padLeft, x)}
                y={padTop}
                width={count === 1 ? innerW : Math.min(sliceW, width - padRight - x)}
                height={innerH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}

          {/* X Axis Date Labels */}
          {points.map((p, idx) => {
            if (idx % labelStep !== 0 && idx !== points.length - 1) return null;
            return (
              <text
                key={p.date}
                x={p.x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10.5px"
              >
                {formatTrendDate(p.date)}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Bubble */}
        {hoveredPoint && (
          <div
            className="chart-tooltip-bubble"
            style={{
              left: `${Math.min(
                Math.max(8, (hoveredPoint.x / width) * 100),
                78
              )}%`,
              top: "14px",
            }}
          >
            <div className="chart-tooltip-title">
              {formatTrendDate(hoveredPoint.date)}
              {hoveredPoint.isAnomaly && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    backgroundColor:
                      hoveredPoint.anomalyType === "SPIKE" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                    color: hoveredPoint.anomalyType === "SPIKE" ? "#F87171" : "#FCD34D",
                    fontWeight: 700,
                  }}
                >
                  {hoveredPoint.anomalyType === "SPIKE" ? "ANOMALY: SPIKE" : "ANOMALY: DROP"}
                </span>
              )}
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ backgroundColor: "#8B5CF6" }} />
              <span>Observed:</span>
              <strong style={{ color: "var(--text)" }}>
                {hoveredPoint.clicks.toLocaleString()} clicks
              </strong>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ backgroundColor: "#64748B" }} />
              <span>Expected Baseline:</span>
              <span>{hoveredPoint.expected.toLocaleString()} clicks</span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ backgroundColor: "#EF4444" }} />
              <span>Upper Threshold (+2σ):</span>
              <span>{hoveredPoint.upperThreshold.toLocaleString()} clicks</span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ backgroundColor: "#F59E0B" }} />
              <span>Lower Threshold (-2σ):</span>
              <span>{hoveredPoint.lowerThreshold.toLocaleString()} clicks</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 3. Active Anomaly Alert Cards Feed
// =============================================================================
function AnomalyAlertsFeed({
  anomalyEvents = [],
  onOpenModal,
  onAcknowledge,
  onResolve,
  actionLoading,
}) {
  const [filterType, setFilterType] = useState("ALL");

  const filteredEvents = useMemo(() => {
    if (filterType === "ALL") return anomalyEvents;
    if (filterType === "UNRESOLVED") return anomalyEvents.filter((e) => e.status !== "resolved");
    if (filterType === "CRITICAL") return anomalyEvents.filter((e) => e.severity === "CRITICAL");
    if (filterType === "SPIKE") return anomalyEvents.filter((e) => e.type === "SPIKE");
    if (filterType === "DROP") return anomalyEvents.filter((e) => e.type === "DROP");
    return anomalyEvents;
  }, [anomalyEvents, filterType]);

  const unresolvedCount = useMemo(
    () => anomalyEvents.filter((e) => e.status !== "resolved").length,
    [anomalyEvents]
  );

  return (
    <div className="anomaly-alerts-container">
      <div className="anomaly-alerts-header">
        <div>
          <h3 className="traffic-chart-title">
            Active Anomaly Detections ({anomalyEvents.length})
          </h3>
          <p className="traffic-chart-subtitle">
            Statistically significant traffic deviations identified by the surveillance engine
          </p>
        </div>

        {/* Filter Pills */}
        <div className="anomaly-filter-tabs">
          <button
            type="button"
            className={`anomaly-tab-btn ${filterType === "ALL" ? "active" : ""}`}
            onClick={() => setFilterType("ALL")}
          >
            All ({anomalyEvents.length})
          </button>
          <button
            type="button"
            className={`anomaly-tab-btn ${filterType === "UNRESOLVED" ? "active" : ""}`}
            onClick={() => setFilterType("UNRESOLVED")}
          >
            Unresolved ({unresolvedCount})
          </button>
          <button
            type="button"
            className={`anomaly-tab-btn critical ${filterType === "CRITICAL" ? "active" : ""}`}
            onClick={() => setFilterType("CRITICAL")}
          >
            Critical
          </button>
          <button
            type="button"
            className={`anomaly-tab-btn ${filterType === "SPIKE" ? "active" : ""}`}
            onClick={() => setFilterType("SPIKE")}
          >
            Spikes
          </button>
          <button
            type="button"
            className={`anomaly-tab-btn ${filterType === "DROP" ? "active" : ""}`}
            onClick={() => setFilterType("DROP")}
          >
            Drops
          </button>
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="anomaly-cards-list">
          {filteredEvents.map((evt) => {
            const isCritical = evt.severity === "CRITICAL";
            const isSpike = evt.type === "SPIKE";
            const isResolved = evt.status === "resolved";
            const isAcknowledged = evt.status === "acknowledged";

            return (
              <div
                key={evt.id}
                className={`anomaly-alert-card ${isCritical ? "critical-card" : "warning-card"}`}
                style={{ opacity: isResolved ? 0.75 : 1 }}
              >
                <div className="anomaly-card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      className={`anomaly-severity-pill ${
                        isCritical ? "critical" : "warning"
                      }`}
                    >
                      <span className="severity-pulse-dot" />
                      {evt.severity}
                    </span>
                    <span className="anomaly-type-pill">
                      {isSpike ? "Traffic Spike" : "Traffic Drop"}
                    </span>
                    <span
                      className={`anomaly-status-tag ${
                        isResolved ? "resolved" : isAcknowledged ? "acknowledged" : "new"
                      }`}
                    >
                      {isResolved ? "Resolved" : isAcknowledged ? "Acknowledged" : "New"}
                    </span>
                    <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                      s/{evt.shortCode}
                    </strong>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {formatTrendDate(evt.date)}
                  </span>
                </div>

                <div className="anomaly-card-title-row">
                  <h4 className="anomaly-card-headline">{evt.title}</h4>
                  <p className="anomaly-card-desc">{evt.description}</p>
                </div>

                <div className="anomaly-metrics-chips">
                  <div className="anomaly-metric-chip">
                    <span className="chip-label">Observed</span>
                    <strong className="chip-val" style={{ color: isSpike ? "#34D399" : "#F87171" }}>
                      {evt.actualClicks} clicks
                    </strong>
                  </div>
                  <div className="anomaly-metric-chip">
                    <span className="chip-label">Baseline Expected</span>
                    <strong className="chip-val">{evt.expectedClicks} / day</strong>
                  </div>
                  <div className="anomaly-metric-chip">
                    <span className="chip-label">Deviation</span>
                    <strong
                      className="chip-val"
                      style={{ color: isSpike ? "#34D399" : "#F87171" }}
                    >
                      {evt.deviationDisplay ||
                        (evt.deviationPercentage !== null && evt.deviationPercentage !== undefined
                          ? `${evt.deviationPercentage > 0 ? "+" : ""}${evt.deviationPercentage}%`
                          : "N/A – baseline is zero")}
                    </strong>
                  </div>
                  <div className="anomaly-metric-chip">
                    <span className="chip-label">Difference</span>
                    <strong className="chip-val" style={{ color: isSpike ? "#34D399" : "#F87171" }}>
                      {evt.absoluteDifference !== undefined
                        ? `${evt.absoluteDifference > 0 ? "+" : ""}${evt.absoluteDifference} clicks`
                        : `${evt.actualClicks - evt.expectedClicks > 0 ? "+" : ""}${evt.actualClicks - evt.expectedClicks} clicks`}
                    </strong>
                  </div>
                  <div className="anomaly-metric-chip">
                    <span className="chip-label">Z-Score</span>
                    <strong className="chip-val">Z: {evt.zScore}</strong>
                  </div>
                </div>

                <div className="anomaly-analysis-box">
                  <div className="analysis-row">
                    <strong>Root Cause:</strong>
                    <span>{evt.rootCause}</span>
                  </div>
                  <div className="analysis-row">
                    <strong>Recommendation:</strong>
                    <span>{evt.recommendation}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="anomaly-action-btns-row">
                  {!isAcknowledged && !isResolved && (
                    <button
                      type="button"
                      className="anomaly-btn ack"
                      disabled={actionLoading}
                      onClick={() => onAcknowledge(evt.id)}
                    >
                      Acknowledge
                    </button>
                  )}
                  {!isResolved && (
                    <button
                      type="button"
                      className="anomaly-btn resolve"
                      disabled={actionLoading}
                      onClick={() => onResolve(evt.id)}
                    >
                      Mark Resolved
                    </button>
                  )}
                  <button
                    type="button"
                    className="anomaly-btn details"
                    onClick={() => onOpenModal(evt)}
                  >
                    View Diagnostics →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="anomaly-empty-state-box">
          <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          <strong style={{ color: "var(--text)", fontSize: "14px" }}>
            No Anomalies in this Category
          </strong>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0" }}>
            All link traffic in the selected filter is operating within expected statistical parameters.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 4. Per-Link Traffic Surveillance Table with Clickable Status Badges
// =============================================================================
function LinkSurveillanceTable({ linkHealth = [], onOpenModal }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredLinks = useMemo(() => {
    return linkHealth.filter((l) => {
      const matchesSearch =
        l.shortCode?.toLowerCase().includes(search.toLowerCase()) ||
        l.originalUrl?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === "ALL") return true;
      if (statusFilter === "ANOMALIES") return l.status === "SPIKE_ALERT" || l.status === "DROP_ALERT";
      if (statusFilter === "HEALTHY") return l.status === "HEALTHY";
      if (statusFilter === "INSUFFICIENT") return l.status === "INSUFFICIENT_DATA";
      if (statusFilter === "INACTIVE") return l.status === "INACTIVE";
      return true;
    });
  }, [linkHealth, search, statusFilter]);

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Link Traffic Surveillance Roster
          </h3>
          <p className="traffic-chart-subtitle">
            Monitored links with baseline click rates, daily activity, and interactive health status badges
          </p>
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="surveillance-search-input"
          />

          <div className="traffic-filter-pills">
            <button
              type="button"
              className={`traffic-pill-btn ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              All ({linkHealth.length})
            </button>
            <button
              type="button"
              className={`traffic-pill-btn ${statusFilter === "ANOMALIES" ? "active" : ""}`}
              onClick={() => setStatusFilter("ANOMALIES")}
            >
              Anomalies
            </button>
            <button
              type="button"
              className={`traffic-pill-btn ${statusFilter === "HEALTHY" ? "active" : ""}`}
              onClick={() => setStatusFilter("HEALTHY")}
            >
              Healthy
            </button>
            <button
              type="button"
              className={`traffic-pill-btn ${statusFilter === "INSUFFICIENT" ? "active" : ""}`}
              onClick={() => setStatusFilter("INSUFFICIENT")}
            >
              Insufficient Data
            </button>
          </div>
        </div>
      </div>

      <div className="surveillance-table-wrapper">
        <table className="surveillance-table">
          <thead>
            <tr>
              <th>Short Link</th>
              <th>Surveillance Status</th>
              <th>Period Clicks</th>
              <th>Daily Baseline (Avg)</th>
              <th>Today (IST)</th>
              <th>Yesterday (IST)</th>
              <th>Activity Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {filteredLinks.length > 0 ? (
              filteredLinks.map((link) => {
                const isSpike = link.status === "SPIKE_ALERT";
                const isDrop = link.status === "DROP_ALERT";
                const isHealthy = link.status === "HEALTHY";
                const isInsufficient = link.status === "INSUFFICIENT_DATA";
                const isInactive = link.status === "INACTIVE";

                const sparklineArr = link.recentSparkline && link.recentSparkline.length > 0
                  ? link.recentSparkline
                  : [0, 0, 0, 0, 0];
                const maxSpark = Math.max(1, ...sparklineArr);
                const sparkW = 80;
                const sparkH = 22;

                const sparkPoints = sparklineArr
                  .map((val, idx) => {
                    const x = (idx / Math.max(1, sparklineArr.length - 1)) * sparkW;
                    const y = sparkH - (val / maxSpark) * (sparkH - 4) - 2;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ");

                return (
                  <tr key={link._id || link.shortCode}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                          s/{link.shortCode}
                        </strong>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            maxWidth: "200px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={link.originalUrl}
                        >
                          {formatUrl(link.originalUrl, 28)}
                        </span>
                      </div>
                    </td>

                    {/* Clickable Status Badge Chip */}
                    <td>
                      {isSpike && (
                        <button
                          type="button"
                          className="status-badge-chip spike clickable"
                          onClick={() => onOpenModal(link)}
                          title="Click to view spike diagnostic breakdown & baseline"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span className="status-badge-chip spike">
                            Spike Alert
                          </span>
                        </button>
                      )}
                      {isDrop && (
                        <button
                          type="button"
                          className="status-badge-chip drop clickable"
                          onClick={() => onOpenModal(link)}
                          title="Click to view drop diagnostic breakdown & baseline"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span className="status-badge-chip drop">
                            Drop Alert
                          </span>
                        </button>
                      )}
                      {isHealthy && (
                        <button
                          type="button"
                          className="status-badge-chip healthy clickable"
                          onClick={() => onOpenModal(link)}
                          title="Click to view baseline stability details"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span className="status-badge-chip healthy">
                            Healthy
                          </span>
                        </button>
                      )}
                      {isInsufficient && (
                        <button
                          type="button"
                          className="status-badge-chip insufficient clickable"
                          onClick={() => onOpenModal(link)}
                          title="Click to view data threshold requirements"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span className="status-badge-chip insufficient">
                            Insufficient Data
                          </span>
                        </button>
                      )}
                      {isInactive && (
                        <button
                          type="button"
                          className="status-badge-chip inactive clickable"
                          onClick={() => onOpenModal(link)}
                          title="Click to view link activity status"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span className="status-badge-chip inactive">
                            Inactive
                          </span>
                        </button>
                      )}
                    </td>

                    <td>
                      <strong style={{ color: "var(--text)" }}>
                        {(link.totalClicks || 0).toLocaleString()}
                      </strong>
                    </td>

                    <td>{link.averageClicksPerDay || 0} / day</td>

                    <td title={`Today (${link.todayDate || "IST"})`}>
                      <strong
                        style={{
                          color: isSpike ? "#34D399" : isDrop ? "#F87171" : "var(--text)",
                        }}
                      >
                        {link.todayClicks || 0}
                      </strong>
                    </td>

                    <td title={`Yesterday (${link.yesterdayDate || "IST"})`}>
                      {link.yesterdayClicks || 0}
                    </td>

                    <td>
                      <svg width={sparkW} height={sparkH}>
                        <polyline
                          fill="none"
                          stroke={isSpike ? "#EF4444" : isDrop ? "#F59E0B" : "#8B5CF6"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparkPoints}
                        />
                      </svg>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                  No monitored links match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component: TrafficAnomalyView
// =============================================================================
export default function TrafficAnomalyView({
  token = "",
  apiBaseUrl = "",
}) {
  const [range, setRange] = useState("14d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedModalItem, setSelectedModalItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchAnomalies = useCallback(
    async (selectedRange = range) => {
      const activeToken = token || localStorage.getItem("token");
      if (!activeToken) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentSignal = abortControllerRef.current.signal;

      setLoading(true);
      setError("");

      try {
        const url = `${apiBaseUrl}/api/links/user/analytics/anomalies?range=${selectedRange}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${activeToken}` },
          signal: currentSignal,
        });

        if (res.data?.success) {
          setData(res.data);
        } else {
          setError(res.data?.message || "Failed to load anomaly detection data");
        }
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("Fetch anomaly analytics error:", err);
        setError(
          err.response?.data?.message ||
            "Unable to load traffic anomaly surveillance data. Please check your connection."
        );
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, range, token]
  );

  useEffect(() => {
    fetchAnomalies(range);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAnomalies, range]);

  // Acknowledge anomaly lifecycle handler
  const handleAcknowledge = async (anomalyId) => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken || !anomalyId) return;

    try {
      setActionLoading(true);
      const res = await axios.patch(
        `${apiBaseUrl}/api/links/user/analytics/anomalies/${anomalyId}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );

      if (res.data?.success) {
        // Optimistically update local data
        setData((prev) => {
          if (!prev) return prev;
          const updatedEvents = (prev.anomalyEvents || []).map((evt) =>
            evt.id === anomalyId ? { ...evt, status: "acknowledged" } : evt
          );
          return { ...prev, anomalyEvents: updatedEvents };
        });

        // If modal is viewing this item, update it
        setSelectedModalItem((prev) =>
          prev && prev.id === anomalyId ? { ...prev, status: "acknowledged" } : prev
        );
      }
    } catch (err) {
      console.error("Acknowledge anomaly error:", err);
      alert(err.response?.data?.message || "Failed to acknowledge anomaly alert");
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve anomaly lifecycle handler
  const handleResolve = async (anomalyId) => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken || !anomalyId) return;

    try {
      setActionLoading(true);
      const res = await axios.patch(
        `${apiBaseUrl}/api/links/user/analytics/anomalies/${anomalyId}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );

      if (res.data?.success) {
        // Optimistically update local data
        setData((prev) => {
          if (!prev) return prev;
          const updatedEvents = (prev.anomalyEvents || []).map((evt) =>
            evt.id === anomalyId ? { ...evt, status: "resolved" } : evt
          );
          const unresolved = updatedEvents.filter((e) => e.status !== "resolved").length;
          return {
            ...prev,
            anomalyEvents: updatedEvents,
            summary: { ...prev.summary, unresolvedCount: unresolved },
          };
        });

        // If modal is viewing this item, update it
        setSelectedModalItem((prev) =>
          prev && prev.id === anomalyId ? { ...prev, status: "resolved" } : prev
        );
      }
    } catch (err) {
      console.error("Resolve anomaly error:", err);
      alert(err.response?.data?.message || "Failed to resolve anomaly alert");
    } finally {
      setActionLoading(false);
    }
  };

  const summary = data?.summary || {
    totalAnomaliesDetected: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    spikeCount: 0,
    dropCount: 0,
    unresolvedCount: 0,
    healthScore: 100,
    healthRating: "EXCELLENT",
    totalMonitoredLinks: 0,
    totalClicksInPeriod: 0,
  };

  return (
    <div className="traffic-anomaly-view-container">
      {/* Top Header & Range Bar */}
      <div className="traffic-analytics-header">
        <div>
          <h2 className="traffic-analytics-title">
            Traffic Intelligence
          </h2>
          <p className="traffic-analytics-subtitle">
            Dynamic statistical threshold surveillance across click history detecting traffic spikes and cliff drops
          </p>
        </div>

        <div className="traffic-header-controls">
          <div className="traffic-date-pills">
            {["7d", "14d", "30d", "all"].map((r) => (
              <button
                key={r}
                type="button"
                className={`traffic-pill-btn ${range === r ? "active" : ""}`}
                onClick={() => setRange(r)}
                disabled={loading}
              >
                {r === "7d" ? "7 Days" : r === "14d" ? "14 Days" : r === "30d" ? "30 Days" : "All Time"}
              </button>
            ))}
          </div>

          <SpecularButton
            type="button"
            variant="secondary"
            size="md"
            className="traffic-refresh-btn"
            onClick={() => fetchAnomalies(range)}
            disabled={loading}
            title="Recalculate statistical anomalies"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </SpecularButton>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="traffic-error-banner">
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={15} /> {error}</span>
          <button type="button" onClick={() => fetchAnomalies(range)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="spinner" />
          <p style={{ color: "var(--text-muted)", marginTop: "12px", fontSize: "13px" }}>
            Running statistical baseline calculations & anomaly detection models across click history...
          </p>
        </div>
      )}

      {/* Main Content */}
      {!loading && data && (
        <>
          {/* 1. Health Score & Top Anomaly KPI Cards */}
          <div className="anomaly-top-cards-grid">
            {/* Health Score Gauge Card */}
            <div className="anomaly-health-card">
              <div className="health-score-top">
                <span className="health-card-label">Traffic Health Index</span>
                <span
                  className={`health-rating-badge ${
                    summary.healthScore >= 90
                      ? "optimal"
                      : summary.healthScore >= 75
                      ? "good"
                      : summary.healthScore >= 50
                      ? "attention"
                      : "critical"
                  }`}
                >
                  {summary.healthRating}
                </span>
              </div>
              <div className="health-score-val-wrapper">
                <div
                  className="health-score-number"
                  style={{
                    color:
                      summary.healthScore >= 90
                        ? "#10B981"
                        : summary.healthScore >= 75
                        ? "#06B6D4"
                        : summary.healthScore >= 50
                        ? "#F59E0B"
                        : "#EF4444",
                  }}
                >
                  {summary.healthScore}%
                </div>
                <p className="health-score-desc">
                  {summary.healthScore >= 90
                    ? "Normal statistical stability across links"
                    : summary.healthScore >= 75
                    ? "Minor traffic anomalies observed"
                    : "Significant deviations detected; review alerts"}
                </p>
              </div>
            </div>

            {/* Total Anomalies */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">Total Anomalies</span>
                <span className="channel-badge live">Surveillance</span>
              </div>
              <div
                className="campaign-metric-value"
                style={{
                  color: summary.totalAnomaliesDetected > 0 ? "#F87171" : "#10B981",
                }}
              >
                {summary.totalAnomaliesDetected || 0}
              </div>
              <p className="campaign-metric-subtext">Active deviations in period</p>
            </div>

            {/* Spikes vs Drops */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">Spikes / Drops</span>
                <span className="channel-badge direct">Surges vs Cliffs</span>
              </div>
              <div className="campaign-metric-value" style={{ fontSize: "20px" }}>
                <span style={{ color: "#34D399" }}>{summary.spikeCount || 0} Spikes</span>
                {" / "}
                <span style={{ color: "#F87171" }}>{summary.dropCount || 0} Drops</span>
              </div>
              <p className="campaign-metric-subtext">Statistical deviation breakdown</p>
            </div>

            {/* Unresolved Alerts */}
            <div className="metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">Unresolved Alerts</span>
                <span
                  className={`channel-badge ${
                    (summary.unresolvedCount || 0) > 0 ? "qr" : "utm"
                  }`}
                >
                  {(summary.unresolvedCount || 0) > 0 ? "Action Required" : "All Clear"}
                </span>
              </div>
              <div
                className="campaign-metric-value"
                style={{
                  color: (summary.unresolvedCount || 0) > 0 ? "#EF4444" : "#10B981",
                }}
              >
                {summary.unresolvedCount || 0}
              </div>
              <p className="campaign-metric-subtext">Alerts requiring owner attention</p>
            </div>
          </div>

          {/* 2. Dynamic Statistical Threshold Band Timeline Chart */}
          <AnomalyTimelineChart timeline={data.timeline || []} />

          {/* 3. Active Anomaly Alert Cards Feed */}
          <AnomalyAlertsFeed
            anomalyEvents={data.anomalyEvents || []}
            onOpenModal={(evt) => setSelectedModalItem(evt)}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
            actionLoading={actionLoading}
          />

          {/* 4. Link Traffic Surveillance Roster Table with Clickable Badges */}
          <LinkSurveillanceTable
            linkHealth={data.linkHealth || []}
            onOpenModal={(link) => setSelectedModalItem(link)}
          />
        </>
      )}

      {/* Diagnostic Details Modal Popup */}
      {selectedModalItem && (
        <AnomalyDetailModal
          item={selectedModalItem}
          onClose={() => setSelectedModalItem(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}
