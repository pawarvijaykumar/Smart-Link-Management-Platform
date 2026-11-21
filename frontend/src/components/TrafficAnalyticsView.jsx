// =============================================================================
// Component: TrafficAnalyticsView (Stage 10: Advanced Traffic Visualization)
// CHANGE: Stage 10 UI Refinement and Responsive Layout — 2026-11-16
// Comprehensive traffic analytics dashboard:
// 1. Responsive 4-card metric row (desktop: 4-col, tablet: 2-col, mobile: 1-col)
// 2. High-contrast date filter pills (7d, 30d, all) with aligned Refresh button
// 3. Daily traffic trend (full-width smooth Hermite spline line chart)
// 4. Responsive 2-column chart grids for Hourly, QR vs Direct, Device, and Campaigns
// 5. Traffic activity heatmap (full-width 7x24 matrix with mobile horizontal scroll)
// 6. Polished glassmorphic tooltips, typography, and dark theme consistency
// =============================================================================

import { useState, useMemo } from "react";
import SpecularButton from "./SpecularButton";
import { SegmentedControl } from "./ui/SegmentedControl";
import StatCard from "./ui/StatCard";
import { Activity, AlertTriangle, Smartphone, Monitor, Tablet, HardDrive, TrendingUp, QrCode, Clock, Calendar } from "lucide-react";

// -----------------------------------------------------------------------------
// Format Helpers in Indian Standard Time (IST)
// -----------------------------------------------------------------------------
function formatShortDate(isoStr) {
  if (!isoStr) return "";
  try {
    const [y, m, d] = isoStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dt.toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
  } catch {
    return isoStr;
  }
}

function formatHour12(h) {
  if (h === null || h === undefined) return "N/A";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12} ${ampm}`;
}

// -----------------------------------------------------------------------------
// 1. Top 4 Metric KPI Cards (Responsive: 4-col desktop, 2-col tablet, 1-col mobile)
// -----------------------------------------------------------------------------
function TrafficMetricCards({ summary, loading = false }) {
  const totalClicks = summary?.totalClicks ?? 0;
  const qrPct = summary?.qrPercentage ?? 0;
  const directPct = summary?.directPercentage ?? 0;
  const peakHour = summary?.peakHour;
  const topDayOfWeek = summary?.topDayOfWeek || "N/A";

  return (
    <div className={`metrics-grid ${loading ? "data-refreshing" : ""}`} style={{ marginBottom: "16px" }}>
      <StatCard
        label="Total traffic"
        value={totalClicks.toLocaleString()}
        icon={TrendingUp}
      />
      <StatCard
        label="Channel split"
        value={totalClicks > 0 ? `${qrPct}% QR • ${directPct}% Dir` : "0% QR • 0% Dir"}
        icon={QrCode}
      />
      <StatCard
        label="Peak engagement"
        value={peakHour !== null && peakHour !== undefined ? formatHour12(peakHour) : "N/A"}
        icon={Clock}
      />
      <StatCard
        label="Most active day"
        value={topDayOfWeek}
        icon={Calendar}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Daily Traffic Trend Chart (Full-width line chart with smooth Hermite spline)
// -----------------------------------------------------------------------------
function DailyTrafficTrendChart({ dailyTrends = [], totalClicks = 0 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const data = useMemo(() => dailyTrends || [], [dailyTrends]);
  const width = 900;
  const height = 250;
  const padLeft = 50;
  const padRight = 24;
  const padTop = 25;
  const padBottom = 38;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = height - padBottom;

  const maxVal = useMemo(() => {
    const raw = Math.max(...data.map((d) => d.totalClicks || 0), 0);
    return raw > 0 ? Math.ceil(raw * 1.15) : 5;
  }, [data]);

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const n = data.length;
    return data.map((d, i) => {
      const count = d.totalClicks || 0;
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / maxVal) * innerH));
      return {
        x,
        y,
        date: d.date,
        count,
        qr: d.qrClicks || 0,
        direct: d.directClicks || 0,
      };
    });
  }, [data, maxVal, innerW, innerH, padLeft, padTop, zeroY]);

  // Monotone cubic Hermite spline interpolation
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: "", areaPath: "" };
    if (points.length === 1) {
      const p = points[0];
      const lp = `M ${padLeft} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${p.y.toFixed(1)}`;
      const ap = `M ${padLeft} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${p.y.toFixed(1)} L ${(width - padRight).toFixed(1)} ${zeroY.toFixed(1)} L ${padLeft} ${zeroY.toFixed(1)} Z`;
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
      const cp1x = p1.x + dX / 3;
      const cp1y = p1.y + (m[i] * dX) / 3;
      const cp2x = p2.x - dX / 3;
      const cp2y = p2.y - (m[i + 1] * dX) / 3;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const ap = `${d} L ${points[n - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
    return { linePath: d, areaPath: ap };
  }, [points, innerW, padLeft, padRight, zeroY]);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const labelInterval = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Daily traffic trend
          </h3>
          <p className="traffic-chart-subtitle">
            Daily visitor volume over time.
          </p>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: "250px" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="trafficAccentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
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
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10.5px"
                  fontFamily="inherit"
                >
                  {val.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#trafficAccentGradient)" />}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Interactive Dots */}
          {points.map((p) => {
            const isHovered = hoveredPoint?.date === p.date;
            return (
              <g key={p.date}>
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="7"
                    fill="var(--accent-soft)"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4 : 2.5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={isHovered ? 2 : 1}
                  style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {points.map((p, i) => {
            if (i % labelInterval !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={p.date}
                x={p.x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10.5px"
                fontFamily="inherit"
              >
                {formatShortDate(p.date)}
              </text>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-tooltip-bubble"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform: "translate(-50%, -125%)",
            }}
          >
            <div className="chart-tooltip-title">{formatShortDate(hoveredPoint.date)}</div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "var(--accent)" }} />
              <span>Total: <strong style={{ color: "var(--text)" }}>{hoveredPoint.count.toLocaleString()}</strong></span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "var(--accent)" }} />
              <span>QR Scans: <strong style={{ color: "var(--text)" }}>{hoveredPoint.qr.toLocaleString()}</strong></span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "#64748B" }} />
              <span>Direct: <strong style={{ color: "var(--text)" }}>{hoveredPoint.direct.toLocaleString()}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. Hourly Traffic Distribution Chart (24-Hour Bar Chart with Peak Highlight)
// -----------------------------------------------------------------------------
function HourlyTrafficChart({ hourlyData = [], peakHour = null }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  const data = useMemo(() => {
    return Array.isArray(hourlyData) && hourlyData.length === 24
      ? hourlyData
      : Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          label: `${String(h).padStart(2, "0")}:00`,
          count: 0,
          qrClicks: 0,
          directClicks: 0,
        }));
  }, [hourlyData]);

  const maxVal = useMemo(() => {
    const raw = Math.max(...data.map((d) => d.count || 0), 0);
    return raw > 0 ? Math.ceil(raw * 1.2) : 5;
  }, [data]);

  const width = 600;
  const height = 230;
  const padLeft = 45;
  const padRight = 18;
  const padTop = 25;
  const padBottom = 38;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = height - padBottom;
  const barSlot = innerW / 24;
  const barWidth = Math.max(7, barSlot * 0.72);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Hourly traffic distribution
          </h3>
          <p className="traffic-chart-subtitle">
            24-hour visitor density profile.
          </p>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: "230px" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {/* Gridlines */}
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
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10px"
                  fontFamily="inherit"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* 24 Bars */}
          {data.map((item) => {
            const count = item.count || 0;
            const barH = count > 0 ? Math.max(3, (count / maxVal) * innerH) : 0;
            const x = padLeft + item.hour * barSlot + (barSlot - barWidth) / 2;
            const y = zeroY - barH;
            const isHovered = hoveredBar?.hour === item.hour;

            return (
              <g key={item.hour}>
                <rect
                  x={padLeft + item.hour * barSlot}
                  y={padTop}
                  width={barSlot}
                  height={innerH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="3"
                  fill="var(--accent)"
                  opacity={count === 0 ? 0.12 : isHovered ? 1 : 0.75}
                  style={{
                    transition: "opacity 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredBar(item)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {[0, 4, 8, 12, 16, 20].map((h) => {
            const x = padLeft + h * barSlot + barSlot / 2;
            return (
              <text
                key={h}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10px"
                fontFamily="inherit"
              >
                {String(h).padStart(2, "0")}:00
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredBar && (
          <div
            className="chart-tooltip-bubble"
            style={{
              left: `${((padLeft + hoveredBar.hour * barSlot + barSlot / 2) / width) * 100}%`,
              top: `${((zeroY - Math.max(3, ((hoveredBar.count || 0) / maxVal) * innerH)) / height) * 100}%`,
              transform: "translate(-50%, -125%)",
            }}
          >
            <div className="chart-tooltip-title">
              {formatHour12(hoveredBar.hour)} ({hoveredBar.label})
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "var(--accent)" }} />
              <span>Total: <strong style={{ color: "var(--text)" }}>{hoveredBar.count}</strong></span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "var(--accent)" }} />
              <span>QR: <strong style={{ color: "var(--text)" }}>{hoveredBar.qrClicks || 0}</strong></span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "#64748B" }} />
              <span>Direct: <strong style={{ color: "var(--text)" }}>{hoveredBar.directClicks || 0}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. QR vs Direct Traffic Over Time (Multi-Series Comparison Chart)
// -----------------------------------------------------------------------------
function QRvsDirectComparisonChart({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = useMemo(() => data || [], [data]);
  const width = 600;
  const height = 230;
  const padLeft = 45;
  const padRight = 18;
  const padTop = 25;
  const padBottom = 38;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = height - padBottom;

  const maxVal = useMemo(() => {
    const raw = Math.max(...series.map((d) => Math.max(d.qr || 0, d.direct || 0)), 0);
    return raw > 0 ? Math.ceil(raw * 1.2) : 5;
  }, [series]);

  const qrPoints = useMemo(() => {
    if (series.length === 0) return [];
    const n = series.length;
    return series.map((d, i) => {
      const count = d.qr || 0;
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / maxVal) * innerH));
      return { x, y, date: d.date, count };
    });
  }, [series, maxVal, innerW, innerH, padLeft, padTop, zeroY]);

  const directPoints = useMemo(() => {
    if (series.length === 0) return [];
    const n = series.length;
    return series.map((d, i) => {
      const count = d.direct || 0;
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / maxVal) * innerH));
      return { x, y, date: d.date, count };
    });
  }, [series, maxVal, innerW, innerH, padLeft, padTop, zeroY]);

  const makeLinePath = (pts) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${padLeft} ${pts[0].y} L ${width - padRight} ${pts[0].y}`;
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, "");
  };

  const qrLine = useMemo(() => makeLinePath(qrPoints), [qrPoints]);
  const directLine = useMemo(() => makeLinePath(directPoints), [directPoints]);

  const totalQR = useMemo(() => series.reduce((s, d) => s + (d.qr || 0), 0), [series]);
  const totalDirect = useMemo(() => series.reduce((s, d) => s + (d.direct || 0), 0), [series]);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const labelInterval = Math.max(1, Math.ceil(series.length / 6));

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            QR vs direct traffic
          </h3>
          <p className="traffic-chart-subtitle">
            Channel acquisition over time.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--accent)" }} />
            <span style={{ color: "var(--text-muted)" }}>QR ({totalQR})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#64748B" }} />
            <span style={{ color: "var(--text-muted)" }}>Direct ({totalDirect})</span>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", height: "230px" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {/* Gridlines */}
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
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10px"
                  fontFamily="inherit"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* QR Line */}
          {qrLine && (
            <path
              d={qrLine}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Direct Line */}
          {directLine && (
            <path
              d={directLine}
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Points for QR */}
          {qrPoints.map((p, idx) => (
            <circle
              key={`qr_${p.date}`}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.date === p.date ? 4 : 2.5}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="1"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredPoint(series[idx])}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Points for Direct */}
          {directPoints.map((p, idx) => (
            <circle
              key={`dir_${p.date}`}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.date === p.date ? 4 : 2.5}
              fill="#64748B"
              stroke="var(--surface)"
              strokeWidth="1"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredPoint(series[idx])}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* X Axis Labels */}
          {series.map((d, i) => {
            if (i % labelInterval !== 0 && i !== series.length - 1) return null;
            const x = series.length === 1 ? padLeft + innerW / 2 : padLeft + (i / (series.length - 1)) * innerW;
            return (
              <text
                key={d.date}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="10px"
                fontFamily="inherit"
              >
                {formatShortDate(d.date)}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-tooltip-bubble"
            style={{
              left: `${((padLeft + (series.findIndex((d) => d.date === hoveredPoint.date) / Math.max(1, series.length - 1)) * innerW) / width) * 100}%`,
              top: "20%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="chart-tooltip-title">{formatShortDate(hoveredPoint.date)}</div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "var(--accent)" }} />
              <span>QR Scans: <strong style={{ color: "var(--text)" }}>{hoveredPoint.qr || 0}</strong></span>
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "#64748B" }} />
              <span>Direct: <strong style={{ color: "var(--text)" }}>{hoveredPoint.direct || 0}</strong></span>
            </div>
            <div className="chart-tooltip-row" style={{ borderTop: "1px solid var(--border)", paddingTop: "3px" }}>
              <span>Total: <strong style={{ color: "var(--text)" }}>{(hoveredPoint.qr || 0) + (hoveredPoint.direct || 0)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5. Device Traffic Distribution Chart (Interactive Donut & Split Breakdown)
// CHANGE: Interactive device category selection — 2026-11-16
// -----------------------------------------------------------------------------
function DeviceTrafficChart({ deviceDistribution = [], totalClicks = 0 }) {
  // CHANGE: Interactive device category selection — 2026-11-16
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const colors = {
    mobile: "#8B5CF6",
    desktop: "#06B6D4",
    tablet: "#F59E0B",
    unknown: "#64748B",
  };

  const icons = {
    mobile: <Smartphone size={14} />,
    desktop: <Monitor size={14} />,
    tablet: <Tablet size={14} />,
    unknown: <HardDrive size={14} />,
  };

  const items = useMemo(() => {
    return (deviceDistribution || []).map((d) => ({
      ...d,
      color: colors[d.deviceType] || "#94A3B8",
      icon: icons[d.deviceType] || <Smartphone size={14} />,
      percentage: d.percentage !== undefined ? d.percentage : (totalClicks > 0 ? Math.round((d.count / totalClicks) * 100) : 0),
    }));
  }, [deviceDistribution, totalClicks]);

  const activeSlices = useMemo(() => items.filter((d) => d.count > 0), [items]);

  const size = 146;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo(() => {
    return activeSlices.map((item, idx) => {
      const pct = totalClicks > 0 ? (item.count / totalClicks) * 100 : 0;
      const priorPctSum = activeSlices
        .slice(0, idx)
        .reduce((sum, prev) => sum + (totalClicks > 0 ? (prev.count / totalClicks) * 100 : 0), 0);
      const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((priorPctSum / 100) * circumference);
      return {
        ...item,
        pct: Number(pct.toFixed(1)),
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [activeSlices, totalClicks, circumference]);

  // Handle clicking to toggle category selection or switch immediately
  const handleCategoryToggle = (deviceType) => {
    setSelectedCategory((prev) => (prev === deviceType ? null : deviceType));
  };

  const handleKeyDown = (e, deviceType) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      handleCategoryToggle(deviceType);
    }
  };

  // Determine active view target: hover has temporary preview precedence, otherwise selectedCategory
  const currentTargetType = hoveredCategory || selectedCategory;
  const targetItem = currentTargetType
    ? items.find((d) => d.deviceType === currentTargetType)
    : null;

  // Center display values (safe zero-handling)
  const centerPct = targetItem
    ? `${targetItem.percentage}%`
    : totalClicks > 0
    ? "100%"
    : "0%";

  const centerLabel = targetItem
    ? targetItem.label
    : "All Devices";

  const centerSubtext = targetItem
    ? `${targetItem.count.toLocaleString()} clicks`
    : `${totalClicks.toLocaleString()} total`;

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Device Traffic Distribution
          </h3>
          <p className="traffic-chart-subtitle">
            Click any category to filter and inspect distribution
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {selectedCategory && (
            <SpecularButton
              variant="ghost"
              size="xs"
              className="traffic-reset-btn"
              onClick={() => setSelectedCategory(null)}
              aria-label="Reset device category filter"
            >
              Reset
            </SpecularButton>
          )}
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {totalClicks > 0 ? `${totalClicks.toLocaleString()} total` : "0 recorded"}
          </span>
        </div>
      </div>

      {totalClicks > 0 ? (
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
              />
              {slices.map((slice) => {
                const isSelected = selectedCategory === slice.deviceType;
                const isHovered = hoveredCategory === slice.deviceType;
                const isEmphasized = isSelected || isHovered;
                const hasFocus = currentTargetType !== null;
                const isDimmed = hasFocus && !isEmphasized;

                return (
                  <circle
                    key={slice.deviceType}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isEmphasized ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                      transformOrigin: "center",
                      transform: "rotate(-90deg)",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "pointer",
                      opacity: isDimmed ? 0.22 : 1,
                      filter: isEmphasized ? `drop-shadow(0 0 6px ${slice.color})` : "none",
                    }}
                    onClick={() => handleCategoryToggle(slice.deviceType)}
                    onMouseEnter={() => setHoveredCategory(slice.deviceType)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                );
              })}
            </svg>
            <div className="donut-center-label" aria-live="polite">
              <span className="donut-center-pct" style={{ color: targetItem ? targetItem.color : "var(--text)" }}>
                {centerPct}
              </span>
              <span className="donut-center-text">
                {centerLabel}
              </span>
              <span className="donut-center-subtext">
                {centerSubtext}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.map((item) => {
              const isSelected = selectedCategory === item.deviceType;
              const isHovered = hoveredCategory === item.deviceType;
              const hasSelection = selectedCategory !== null;
              const isOtherCategory = hasSelection && !isSelected;

              return (
                <div
                  key={item.deviceType}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${item.label} traffic: ${item.count} clicks, ${item.percentage} percent`}
                  className={`device-category-row ${isSelected ? "selected" : ""} ${isOtherCategory ? "dimmed" : ""}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: isSelected
                      ? `${item.color}22`
                      : isHovered
                      ? "var(--surface-hover)"
                      : "var(--surface-2)",
                    border: isSelected
                      ? `1.5px solid ${item.color}`
                      : isHovered
                      ? "1px solid var(--border)"
                      : "1px solid var(--border)",
                    boxShadow: isSelected ? `0 0 12px ${item.color}35` : "none",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    outline: "none",
                    opacity: isOtherCategory && !isHovered ? 0.65 : 1,
                  }}
                  onClick={() => handleCategoryToggle(item.deviceType)}
                  onKeyDown={(e) => handleKeyDown(e, item.deviceType)}
                  onMouseEnter={() => setHoveredCategory(item.deviceType)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ fontSize: "15px" }}>{item.icon}</span>
                    <strong style={{ fontSize: "13px", color: isSelected ? item.color : "var(--text-primary)" }}>
                      {item.label}
                    </strong>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          color: item.color,
                          background: `${item.color}25`,
                          border: `1px solid ${item.color}55`,
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "12.5px", color: "var(--text)", fontWeight: "600" }}>
                      {item.count.toLocaleString()}
                    </span>
                    <span
                      className="geo-percentage-text"
                      style={{
                        minWidth: "38px",
                        textAlign: "right",
                        color: isSelected ? item.color : undefined,
                        fontWeight: isSelected ? "700" : undefined,
                      }}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "30px 0", margin: 0 }}>
          No device traffic recorded in this date range.
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 6. Campaign Traffic Trends (Comparison Chart & Top Campaigns)
// -----------------------------------------------------------------------------
function CampaignTrafficChart({ campaignTrends = {}, totalClicks = 0 }) {
  const topCampaigns = campaignTrends?.topCampaigns || [];
  const campColors = ["#10B981", "#8B5CF6", "#F59E0B", "#38BDF8", "#EC4899"];

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Campaign Traffic Trends
          </h3>
          <p className="traffic-chart-subtitle">
            Performance across tagged UTM marketing campaigns
          </p>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {topCampaigns.length} active campaigns
        </span>
      </div>

      {topCampaigns.length > 0 ? (
        <div>
          {/* Campaign Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            {topCampaigns.map((tc, idx) => {
              const color = campColors[idx % campColors.length];
              return (
                <div
                  key={tc.campaign}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11.5px",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                  <strong style={{ color: "var(--text)" }}>{tc.campaign}</strong>
                  <span style={{ color: "var(--text-muted)" }}>({tc.count} • {tc.percentage}%)</span>
                </div>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="custom-links-table" style={{ width: "100%", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th style={{ width: "32px", textAlign: "center" }}>#</th>
                  <th>Campaign Name</th>
                  <th style={{ textAlign: "right" }}>Clicks</th>
                  <th style={{ width: "110px" }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((tc, idx) => {
                  const color = campColors[idx % campColors.length];
                  return (
                    <tr key={tc.campaign}>
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                          <strong style={{ color: "var(--text-primary)" }}>{tc.campaign}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "600", color: "var(--text)" }}>
                        {tc.count.toLocaleString()}
                      </td>
                      <td>
                        <div className="geo-progress-cluster">
                          <div className="geo-progress-bar-bg">
                            <div
                              className="geo-progress-bar-fill"
                              style={{
                                width: `${tc.percentage}%`,
                                background: color,
                              }}
                            />
                          </div>
                          <span className="geo-percentage-text">{tc.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)", fontSize: "12.5px" }}>
          <p style={{ margin: 0, marginBottom: "6px" }}>No UTM campaigns detected in this timeframe.</p>
          <span style={{ fontSize: "11.5px", color: "var(--text-secondary)" }}>
            Tip: Tag links with <code style={{ color: "#38BDF8", background: "rgba(56, 189, 248, 0.1)", padding: "1px 4px", borderRadius: "3px" }}>?utm_campaign=summer_sale</code> to track campaign-level traffic here.
          </span>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 7. Traffic Activity Heatmap (Full-width with mobile horizontal scroll)
// -----------------------------------------------------------------------------
function TrafficHeatmapChart({ heatmapData = {}, totalClicks = 0 }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const days = useMemo(() => heatmapData?.days || [], [heatmapData]);
  const grid = useMemo(() => heatmapData?.grid || [], [heatmapData]);

  const maxCellClicks = useMemo(() => {
    const raw = Math.max(...grid.map((c) => c.count || 0), 0);
    return raw > 0 ? raw : 1;
  }, [grid]);

  const getCellBg = (count) => {
    if (!count || count === 0) return "var(--surface-2)";
    const ratio = Math.min(1, count / maxCellClicks);
    if (ratio <= 0.25) return "rgba(16, 185, 129, 0.30)";
    if (ratio <= 0.50) return "rgba(16, 185, 129, 0.55)";
    if (ratio <= 0.75) return "rgba(16, 185, 129, 0.80)";
    return "rgba(16, 185, 129, 1.0)";
  };

  return (
    <div className="traffic-chart-card">
      <div className="traffic-chart-header">
        <div>
          <h3 className="traffic-chart-title">
            Traffic Activity Heatmap (Days vs Hours in IST)
          </h3>
          <p className="traffic-chart-subtitle">
            Visitor density matrix by day of the week and hour of day (UTC+05:30)
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
          <span>Less</span>
          <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "var(--surface-2)" }} />
          <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "rgba(16, 185, 129, 0.30)" }} />
          <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "rgba(16, 185, 129, 0.55)" }} />
          <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "rgba(16, 185, 129, 0.80)" }} />
          <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "rgba(16, 185, 129, 1.0)" }} />
          <span>More</span>
        </div>
      </div>

      <div className="traffic-heatmap-scroll">
        <div className="traffic-heatmap-inner">
          {/* Hour headers */}
          <div style={{ display: "grid", gridTemplateColumns: "55px repeat(24, 1fr) 45px", gap: "3px", marginBottom: "5px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600" }}>Day</span>
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                style={{
                  fontSize: "9.5px",
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </span>
            ))}
            <span style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right", fontWeight: "600" }}>Total</span>
          </div>

          {/* 7 Day Rows */}
          {days.map((d) => (
            <div
              key={d.dayOfWeek}
              style={{
                display: "grid",
                gridTemplateColumns: "55px repeat(24, 1fr) 45px",
                gap: "3px",
                marginBottom: "3px",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)" }}>
                {d.shortName}
              </span>

              {/* 24 Hour Cells */}
              {Array.from({ length: 24 }, (_, h) => {
                const count = d.hours?.[h] || 0;
                const isHovered = hoveredCell?.day === d.shortName && hoveredCell?.hour === h;

                return (
                  <div
                    key={h}
                    style={{
                      height: "22px",
                      borderRadius: "3px",
                      background: getCellBg(count),
                      border: isHovered
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "transform 0.1s ease",
                      transform: isHovered ? "scale(1.2)" : "scale(1)",
                      zIndex: isHovered ? 5 : 1,
                    }}
                    onMouseEnter={() =>
                      setHoveredCell({
                        day: d.dayName,
                        hour: h,
                        label: `${String(h).padStart(2, "0")}:00`,
                        count,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                );
              })}

              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text)", textAlign: "right" }}>
                {d.totalClicks.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Floating Tooltip */}
        {hoveredCell && (
          <div
            className="chart-tooltip-bubble"
            style={{
              bottom: "12px",
              right: "12px",
            }}
          >
            <div className="chart-tooltip-title">
              {hoveredCell.day} • {formatHour12(hoveredCell.hour)} ({hoveredCell.label} IST)
            </div>
            <div className="chart-tooltip-row">
              <span className="tooltip-swatch" style={{ background: "#34D399" }} />
              <span>Clicks: <strong style={{ color: "var(--text)" }}>{hoveredCell.count.toLocaleString()}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component: TrafficAnalyticsView
// -----------------------------------------------------------------------------
export default function TrafficAnalyticsView({
  trafficAnalytics = null,
  trafficLoading = false,
  trafficError = "",
  trafficRange = "7d",
  onRangeChange = null,
  onRefresh = null,
}) {
  const rangeButtons = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "all", label: "All Time" },
  ];

  const data = trafficAnalytics?.data || {};
  const summary = data?.summary || {};
  const totalClicks = summary?.totalClicks || 0;
  const dailyTrends = data?.dailyTrends || [];
  const hourlyDistribution = data?.hourlyDistribution || [];
  const qrVsDirectOverTime = data?.qrVsDirectOverTime || [];
  const deviceDistribution = data?.deviceDistribution || [];
  const campaignTrends = data?.campaignTrends || {};
  const heatmap = data?.heatmap || {};

  const isZeroState = totalClicks === 0 && !trafficLoading && !trafficError;

  return (
    <div className="traffic-analytics-view-container">
      {/* 1. Header & Range Filter Controls */}
      <div className="page-greeting">
        <div className="campaigns-title-row">
          <div>
            {/* CHANGE: Traffic Analytics heading animated with SplitText — 2026-11-19 */}
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>
              Traffic Analytics
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13.5px" }}>
              Deep dive into daily velocity, hourly density, QR vs direct channel dynamics, device footprint, campaign ROI, and time-of-day heatmaps.
            </p>
          </div>

          <div className="traffic-header-controls">
            {/* Filter Pills */}
            <SegmentedControl
              options={rangeButtons.map((btn) => ({ value: btn.id, label: btn.label }))}
              value={trafficRange}
              onChange={(val) => onRangeChange?.(val)}
              size="md"
              ariaLabel="Traffic Analytics date filter"
            />

            {/* Refresh Button */}
            <SpecularButton
              variant="secondary"
              size="sm"
              className="btn-refresh-campaigns"
              onClick={onRefresh}
              disabled={trafficLoading}
              title="Refresh Traffic Analytics"
              aria-label="Refresh Traffic Analytics"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="15"
                height="15"
                className={trafficLoading ? "spinning" : ""}
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{trafficLoading ? "Updating..." : "Refresh"}</span>
            </SpecularButton>
          </div>
        </div>
      </div>

      {/* 2. Error Banner */}
      {trafficError && (
        <div className="auth-alert error" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={16} />
            <span>{trafficError}</span>
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

      {/* 3. Loading State */}
      {trafficLoading && !trafficAnalytics ? (
        <div className="campaign-loading-state">
          <div className="spinner-purple" />
          <p>Loading advanced traffic analytics...</p>
        </div>
      ) : isZeroState ? (
        // 4. Empty State
        <div className="card-box empty-state-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ marginBottom: "14px", color: "var(--accent)" }}><Activity size={40} /></div>
          <h3 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
            No Traffic Recorded Yet
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "480px", margin: "0 auto 20px" }}>
            No clicks were recorded for your short links during this timeframe. Share your links or scan your QR codes to populate real-time traffic intelligence.
          </p>
          <div style={{ display: "inline-flex", gap: "10px" }}>
            <SpecularButton
              variant="primary"
              size="md"
              className="btn-primary"
              onClick={() => onRangeChange?.("all")}
            >
              View All Time
            </SpecularButton>
            <SpecularButton
              variant="secondary"
              size="md"
              className="btn-secondary"
              onClick={onRefresh}
            >
              Refresh
            </SpecularButton>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Responsive 4-card Metric Row */}
          <TrafficMetricCards summary={summary} loading={trafficLoading} />

          {/* 2. Full-Width Daily Traffic Trend (Line Chart) */}
          <DailyTrafficTrendChart
            dailyTrends={dailyTrends}
            totalClicks={totalClicks}
          />

          {/* 3. Responsive 2-Column Grid: Hourly Distribution & QR vs Direct */}
          <div className="traffic-charts-grid-2col">
            <HourlyTrafficChart
              hourlyData={hourlyDistribution}
              peakHour={summary.peakHour}
            />
            <QRvsDirectComparisonChart data={qrVsDirectOverTime} />
          </div>

          {/* 4. Responsive 2-Column Grid: Device Distribution & Campaign Trends */}
          <div className="traffic-charts-grid-2col">
            <DeviceTrafficChart
              deviceDistribution={deviceDistribution}
              totalClicks={totalClicks}
            />
            <CampaignTrafficChart
              campaignTrends={campaignTrends}
              totalClicks={totalClicks}
            />
          </div>

          {/* 5. Full-Width Traffic Activity Heatmap */}
          <TrafficHeatmapChart
            heatmapData={heatmap}
            totalClicks={totalClicks}
          />
        </>
      )}
    </div>
  );
}
