import { useState, useMemo } from "react";

// CHANGE: Verified click graph data accuracy — 2026-10-20
// -----------------------------------------------------------------------------
// Date Calculation Helpers in Indian Standard Time (IST, UTC+05:30)
// -----------------------------------------------------------------------------
const getTodayISTStr = () => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
};

const getTodayIST = () => {
  const [y, m, d] = getTodayISTStr().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
};

const shiftISODate = (isoStr, deltaDays) => {
  const [y, m, d] = isoStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(dt.getUTCDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}`;
};

const getDaysBetween = (startIso, endIso) => {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const t2 = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  return Math.round((t2 - t1) / 86400000);
};

const formatISODate = (d) => {
  if (!d) return getTodayISTStr();
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(parsed);
    }
    return d;
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  }
  return String(d);
};

const formatDisplayDate = (d) => {
  if (!d) return "";
  const iso = formatISODate(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
    return dt.toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
  }
  return String(d);
};

function buildFilteredTrends(
  dailyTrends = [],
  history = [],
  timeRange = "7d",
  selectedLink = null,
  links = []
) {
  const countByIso = {};

  if (Array.isArray(dailyTrends) && dailyTrends.length > 0) {
    dailyTrends.forEach((item) => {
      if (!item) return;
      const rawKey =
        item.isoDate ||
        (item._id && String(item._id).match(/^\d{4}-\d{2}-\d{2}$/)
          ? item._id
          : null);
      const key = rawKey || (item.date ? formatISODate(item.date) : null);
      if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
        countByIso[key] = (countByIso[key] || 0) + Math.max(0, item.count || 0);
      }
    });
  }

  const isAllLinks =
    !selectedLink ||
    selectedLink === "__all__" ||
    selectedLink.shortCode === "__all__";

  // Fallback to history array only if dailyTrends is empty
  if (
    Object.keys(countByIso).length === 0 &&
    Array.isArray(history) &&
    history.length > 0
  ) {
    const seenClickIds = new Set();
    history.forEach((click) => {
      if (!click?.clickedAt) return;

      if (click._id) {
        const idStr = String(click._id);
        if (seenClickIds.has(idStr)) return;
        seenClickIds.add(idStr);
      }

      // If viewing an individual link, ignore clicks from other links
      if (!isAllLinks && selectedLink && click.link) {
        const targetId = String(selectedLink._id || selectedLink.id || "");
        const clickLinkId = String(click.link?._id || click.link);
        const targetCode = String(selectedLink.shortCode || "");
        const clickCode = String(click.shortCode || click.link?.shortCode || "");

        if (targetId && clickLinkId && targetId !== clickLinkId) return;
        if (targetCode && clickCode && targetCode !== clickCode) return;
      }

      const iso = formatISODate(click.clickedAt);
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        countByIso[iso] = (countByIso[iso] || 0) + 1;
      }
    });
  }

  const hasAnyData = Object.values(countByIso).some((c) => c > 0);
  if (!hasAnyData) return [];

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

  // All time: include every recorded date from earliest history up to today,
  // filling zero-click dates in between so the full velocity curve is shown.
  const datesWithClicks = Object.keys(countByIso)
    .filter((k) => (countByIso[k] || 0) > 0)
    .sort();
  const earliestClickDate = datesWithClicks[0] || todayIST;

  let earliestCreatedDate = null;
  if (!isAllLinks && selectedLink?.createdAt) {
    earliestCreatedDate = formatISODate(selectedLink.createdAt);
  } else if (Array.isArray(links) && links.length > 0) {
    const createdList = links
      .map((l) => (l.createdAt ? formatISODate(l.createdAt) : null))
      .filter(Boolean)
      .sort();
    if (createdList.length > 0) {
      earliestCreatedDate = createdList[0];
    }
  }

  let earliestDate = earliestClickDate;
  if (earliestCreatedDate && earliestCreatedDate < earliestDate) {
    earliestDate = earliestCreatedDate;
  }

  // Ensure at least a 7-day span up to today so fresh links never collapse to only 2 dates
  const minStartDate = shiftISODate(todayIST, -6);
  const effectiveStartDate = earliestDate < minStartDate ? earliestDate : minStartDate;
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
// Computes readable integer Y-axis ticks and upper bound starting at zero
// -----------------------------------------------------------------------------
function calculateNiceYAxis(maxVal) {
  if (maxVal <= 0) return { max: 3, ticks: [0, 1, 2, 3] };
  if (maxVal === 1) return { max: 2, ticks: [0, 1, 2] };
  if (maxVal === 2) return { max: 2, ticks: [0, 1, 2] };
  if (maxVal <= 4) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  if (maxVal <= 6) return { max: 6, ticks: [0, 2, 4, 6] };
  if (maxVal <= 9) return { max: 9, ticks: [0, 3, 6, 9] };

  // For larger counts, pick a clean round step (1, 2, 5, 10, 20, 50, etc.)
  const targetIntervals = 3;
  const rawStep = maxVal / targetIntervals;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const factor = rawStep / power;
  const stepMult = factor <= 1.2 ? 1 : factor <= 2.5 ? 2 : factor <= 5.5 ? 5 : 10;
  const step = Math.max(1, Math.round(stepMult * power));
  const niceMax = Math.ceil(maxVal / step) * step;
  const ticks = [];
  for (let v = 0; v <= niceMax; v += step) {
    ticks.push(v);
  }
  return { max: niceMax, ticks };
}

// -----------------------------------------------------------------------------
// Component: ClicksOverviewChart (Smooth Monotone Area Chart with No Overshoot)
// -----------------------------------------------------------------------------
function ClicksOverviewChart({
  dailyTrends = [],
  history = [],
  selectedLink = null,
  links = [],
  onSelectLink,
  timeRange = "7d",
  onTimeRangeChange,
}) {
  const isControlled = typeof onTimeRangeChange === "function";
  const [internalTimeRange, setInternalTimeRange] = useState(timeRange);
  const activeTimeRange = isControlled ? timeRange : internalTimeRange;

  const handleRangeChange = (newRange) => {
    if (isControlled) {
      onTimeRangeChange(newRange);
    } else {
      setInternalTimeRange(newRange);
    }
  };

  const [hoveredPoint, setHoveredPoint] = useState(null);

  const isAllLinks =
    !selectedLink ||
    selectedLink === "__all__" ||
    selectedLink.shortCode === "__all__";

  const rangeLabel =
    activeTimeRange === "7d"
      ? "last 7 days"
      : activeTimeRange === "30d"
      ? "last 30 days"
      : "all time";

  const filteredTrends = useMemo(() => {
    return buildFilteredTrends(
      dailyTrends,
      history,
      activeTimeRange,
      selectedLink,
      links
    );
  }, [dailyTrends, history, activeTimeRange, selectedLink, links]);

  const maxCount = useMemo(() => {
    if (!filteredTrends || filteredTrends.length === 0) return 0;
    return Math.max(0, ...filteredTrends.map((d) => Math.max(0, d.count || 0)));
  }, [filteredTrends]);

  // Clean integer axis ticks starting at 0
  const { max: effectiveMax, ticks: yTicks } = useMemo(() => {
    return calculateNiceYAxis(maxCount);
  }, [maxCount]);

  const totalPeriodClicks = useMemo(() => {
    return Math.max(
      0,
      filteredTrends.reduce((sum, d) => sum + Math.max(0, d.count || 0), 0)
    );
  }, [filteredTrends]);

  const totalClicksAcrossLinks = useMemo(() => {
    return Math.max(
      0,
      links.reduce((sum, l) => sum + Math.max(0, l.clicks || 0), 0)
    );
  }, [links]);

  // Compact graph layout proportions
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
    if (filteredTrends.length === 0) return [];
    const n = filteredTrends.length;
    return filteredTrends.map((item, i) => {
      const count = Math.max(0, item.count || 0);
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      // Clamped to [padTop, zeroY] to guarantee no negative Y values
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / effectiveMax) * innerH));
      return {
        x,
        y,
        date: item.date || item.isoDate || `Day ${i + 1}`,
        count,
      };
    });
  }, [filteredTrends, effectiveMax, innerW, innerH, padLeft, padTop, zeroY]);

  // Monotone cubic Hermite spline interpolation (PCHIP) with strict baseline clamping.
  // Guarantees monotonicity: the line never overshoots or dips below zero between data points.
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

    // Tangents m[i] at each point
    const m = new Array(n);
    m[0] = secants[0];
    m[n - 1] = secants[n - 2];

    for (let i = 1; i < n - 1; i++) {
      const s0 = secants[i - 1];
      const s1 = secants[i];

      // If slopes have opposite signs or either is flat, set tangent to 0 to eliminate local extrema overshoot
      if (s0 * s1 <= 0) {
        m[i] = 0;
      } else {
        // Harmonic mean ensures strict monotonicity (PCHIP)
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

      // Hard clamp control points to the chart bounds [padTop, zeroY]
      // This strictly prevents the spline from dipping below the zero-line (zeroY)
      cp1y = Math.min(zeroY, Math.max(padTop, cp1y));
      cp2y = Math.min(zeroY, Math.max(padTop, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const area = `${d} L ${lastPt.x.toFixed(1)} ${zeroY.toFixed(1)} L ${firstPt.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

    return { linePath: d, areaPath: area };
  }, [points, padLeft, padRight, width, padTop, zeroY]);

  const hasData = points.length > 0;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-title-group">
          <h3>
            {isAllLinks
              ? "Clicks Overview — All Links"
              : `Clicks Overview — /${selectedLink.shortCode}`}
          </h3>
          <p>
            {isAllLinks
              ? `Combined performance across all ${links.length} link${links.length !== 1 ? "s" : ""} (${totalPeriodClicks.toLocaleString()} click${totalPeriodClicks !== 1 ? "s" : ""} in ${rangeLabel})`
              : `Daily performance for link /${selectedLink.shortCode} (${totalPeriodClicks.toLocaleString()} click${totalPeriodClicks !== 1 ? "s" : ""} in ${rangeLabel})`}
          </p>
        </div>

        <div className="chart-header-controls">
          {links && links.length > 0 && onSelectLink && (
            <select
              className="chart-link-dropdown"
              value={isAllLinks ? "__all__" : selectedLink.shortCode}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__all__") {
                  onSelectLink("__all__");
                } else {
                  const found = links.find((l) => l.shortCode === val);
                  if (found) onSelectLink(found);
                }
              }}
              title="Filter by link"
            >
              <option value="__all__">
                All Links ({totalClicksAcrossLinks.toLocaleString()} clicks)
              </option>
              {links.map((link) => (
                <option key={link.shortCode} value={link.shortCode}>
                  /{link.shortCode} ({link.clicks || 0} clicks)
                </option>
              ))}
            </select>
          )}

          <div className="time-filter-pills" role="radiogroup" aria-label="Time period">
            {[
              { id: "7d", label: "Last 7 days" },
              { id: "30d", label: "Last 30 days" },
              { id: "all", label: "All time" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`time-pill-btn ${activeTimeRange === t.id ? "active" : ""}`}
                onClick={() => handleRangeChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasData ? (
        <div className="chart-svg-container" onMouseLeave={() => setHoveredPoint(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
                <stop offset="65%" stopColor="#7C3AED" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
              <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#8B5CF6" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Horizontal Grid Lines & Readable Integer Y-Axis */}
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
            <path d={areaPath} fill="url(#chartAreaGradient)" />

            {/* Spline Line */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#chartLineGradient)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#purpleGlow)"
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
                  key={`col-${idx}`}
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
                <g key={`dot-${idx}`} style={{ pointerEvents: "none" }}>
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
                <strong>{Math.max(0, hoveredPoint.count).toLocaleString()}</strong> click{hoveredPoint.count !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="chart-empty-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="M19 9l-5 5-4-4-3 3" />
          </svg>
          <p>
            No click trends recorded for this period yet. Share your short link to view live audience velocity curves in IST.
          </p>
        </div>
      )}
    </div>
  );
}

export {
  ClicksOverviewChart,
  buildFilteredTrends,
  getTodayIST,
  getTodayISTStr,
  shiftISODate,
  getDaysBetween,
  formatISODate,
  formatDisplayDate,
  calculateNiceYAxis,
};
export default ClicksOverviewChart;

