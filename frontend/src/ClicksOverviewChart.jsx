import { useState, useMemo } from "react";
// CHANGE: Main Dashboard + Sidebar UI Redesign (Dashboard 6 Comparison Mode) — 2026-11-19
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import SpecularButton from "./components/SpecularButton";

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
  const normTimeRange = String(timeRange || "30d").toLowerCase();

  if (normTimeRange === "7d" || normTimeRange === "30d") {
    const numDays = normTimeRange === "7d" ? 7 : 30;
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

  // All time: include every recorded date from earliest history up to today
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
// Helper: Calculate Spline Path from points
// -----------------------------------------------------------------------------
function computeMonotoneSpline(points, padLeft, padRight, width, padTop, zeroY) {
  if (!points || points.length === 0) return { linePath: "", areaPath: "" };

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
}

// -----------------------------------------------------------------------------
// Component: ClicksOverviewChart (React Bits Dashboard 6 Comparison Mode)
// -----------------------------------------------------------------------------
function ClicksOverviewChart({
  dailyTrends = [],
  history = [],
  selectedLink = null,
  links = [],
  onSelectLink,
  timeRange = "7d",
  onTimeRangeChange,
  loading = false,
}) {
  const isControlled = typeof onTimeRangeChange === "function";
  const [internalTimeRange, setInternalTimeRange] = useState(timeRange);
  const activeTimeRange = isControlled ? timeRange : internalTimeRange;

  const [comparisonMode, setComparisonMode] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleRangeChange = (newRange) => {
    if (isControlled) {
      onTimeRangeChange(newRange);
    } else {
      setInternalTimeRange(newRange);
    }
  };

  const isAllLinks =
    !selectedLink ||
    selectedLink === "__all__" ||
    selectedLink.shortCode === "__all__";

  const normActiveRange = String(activeTimeRange || "30d").toLowerCase();

  const rangeLabel =
    normActiveRange === "7d"
      ? "last 7 days"
      : normActiveRange === "30d"
      ? "last 30 days"
      : "all time";

  // Build full map of clicks by ISO date
  const countByIso = useMemo(() => {
    const map = {};
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
          map[key] = (map[key] || 0) + Math.max(0, item.count || 0);
        }
      });
    }

    if (Object.keys(map).length === 0 && Array.isArray(history) && history.length > 0) {
      const seenClickIds = new Set();
      history.forEach((click) => {
        if (!click?.clickedAt) return;
        if (click._id) {
          const idStr = String(click._id);
          if (seenClickIds.has(idStr)) return;
          seenClickIds.add(idStr);
        }
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
          map[iso] = (map[iso] || 0) + 1;
        }
      });
    }
    return map;
  }, [dailyTrends, history, isAllLinks, selectedLink]);

  const filteredTrends = useMemo(() => {
    return buildFilteredTrends(
      dailyTrends,
      history,
      activeTimeRange,
      selectedLink,
      links
    );
  }, [dailyTrends, history, activeTimeRange, selectedLink, links]);

  // Compute comparison trend data for 7d & 30d
  const comparisonData = useMemo(() => {
    if (normActiveRange !== "7d" && normActiveRange !== "30d") {
      return { previousTrends: [], hasPreviousData: false, previousTotal: 0 };
    }
    const todayIST = getTodayISTStr();
    const numDays = normActiveRange === "7d" ? 7 : 30;
    const prevTrends = [];
    let prevTotal = 0;

    for (let i = numDays - 1; i >= 0; i--) {
      const prevIso = shiftISODate(todayIST, -(i + numDays));
      const prevCount = Math.max(0, countByIso[prevIso] || 0);
      prevTrends.push({
        isoDate: prevIso,
        date: formatDisplayDate(prevIso),
        count: prevCount,
      });
      prevTotal += prevCount;
    }

    const hasPriorRecords =
      prevTotal > 0 ||
      Object.keys(countByIso).some((k) => k <= shiftISODate(todayIST, -numDays));

    return {
      previousTrends: prevTrends,
      hasPreviousData: hasPriorRecords,
      previousTotal: prevTotal,
    };
  }, [normActiveRange, countByIso]);

  const totalPeriodClicks = useMemo(() => {
    return Math.max(
      0,
      filteredTrends.reduce((sum, d) => sum + Math.max(0, d.count || 0), 0)
    );
  }, [filteredTrends]);

  const maxCount = useMemo(() => {
    const curMax = filteredTrends.length > 0 ? Math.max(0, ...filteredTrends.map((d) => d.count || 0)) : 0;
    const prevMax =
      comparisonMode && comparisonData.previousTrends.length > 0
        ? Math.max(0, ...comparisonData.previousTrends.map((d) => d.count || 0))
        : 0;
    return Math.max(curMax, prevMax);
  }, [filteredTrends, comparisonMode, comparisonData.previousTrends]);

  const { max: effectiveMax, ticks: yTicks } = useMemo(() => {
    return calculateNiceYAxis(maxCount);
  }, [maxCount]);

  const totalClicksAcrossLinks = useMemo(() => {
    return Math.max(
      0,
      links.reduce((sum, l) => sum + Math.max(0, l.clicks || 0), 0)
    );
  }, [links]);

  // Comparison metrics calculation
  const comparisonMetrics = useMemo(() => {
    if (normActiveRange === "all") {
      return {
        showBadge: false,
        text: "All-time total",
        type: "neutral",
        diff: 0,
      };
    }

    const prevTotal = comparisonData.previousTotal;
    const curTotal = totalPeriodClicks;

    if (!comparisonData.hasPreviousData && prevTotal === 0 && curTotal === 0) {
      return {
        showBadge: true,
        text: "No activity recorded",
        type: "neutral",
        diff: 0,
        pct: 0,
      };
    }

    if (!comparisonData.hasPreviousData || prevTotal === 0) {
      if (curTotal > 0) {
        return {
          showBadge: true,
          text: `+${curTotal} clicks (New traffic)`,
          type: "positive",
          diff: curTotal,
          pct: 100,
        };
      }
      return {
        showBadge: true,
        text: "No prior period data",
        type: "neutral",
        diff: 0,
        pct: 0,
      };
    }

    const diff = curTotal - prevTotal;
    const pct = Math.round((diff / prevTotal) * 100);

    if (diff > 0) {
      return {
        showBadge: true,
        text: `+${pct}% vs prior ${normActiveRange === "7d" ? "7 days" : "30 days"}`,
        type: "positive",
        diff,
        pct,
      };
    }
    if (diff < 0) {
      return {
        showBadge: true,
        text: `${pct}% vs prior ${normActiveRange === "7d" ? "7 days" : "30 days"}`,
        type: "negative",
        diff,
        pct,
      };
    }
    return {
      showBadge: true,
      text: `0% vs prior ${normActiveRange === "7d" ? "7 days" : "30 days"}`,
      type: "neutral",
      diff: 0,
      pct: 0,
    };
  }, [normActiveRange, comparisonData, totalPeriodClicks]);

  // Compact, professional graph dimensions (Dashboard 6)
  const width = 760;
  const height = 180;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 26;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = height - padBottom;

  // Current period points
  const points = useMemo(() => {
    if (filteredTrends.length === 0) return [];
    const n = filteredTrends.length;
    return filteredTrends.map((item, i) => {
      const count = Math.max(0, item.count || 0);
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (i / (n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / effectiveMax) * innerH));
      return {
        x,
        y,
        date: item.date || item.isoDate || `Day ${i + 1}`,
        isoDate: item.isoDate,
        count,
      };
    });
  }, [filteredTrends, effectiveMax, innerW, innerH, padLeft, padTop, zeroY]);

  // Previous period points
  const prevPoints = useMemo(() => {
    if (!comparisonMode || comparisonData.previousTrends.length === 0 || points.length === 0) return [];
    const n = comparisonData.previousTrends.length;
    return comparisonData.previousTrends.map((item, i) => {
      const count = Math.max(0, item.count || 0);
      // Align X directly with the corresponding current point
      const x = points[i] ? points[i].x : padLeft + (i / Math.max(1, n - 1)) * innerW;
      const y = Math.min(zeroY, Math.max(padTop, zeroY - (count / effectiveMax) * innerH));
      return {
        x,
        y,
        date: item.date || item.isoDate || `Prior Day ${i + 1}`,
        isoDate: item.isoDate,
        count,
      };
    });
  }, [comparisonMode, comparisonData.previousTrends, points, effectiveMax, innerW, innerH, padLeft, padTop, zeroY]);

  // Current curves
  const { linePath, areaPath } = useMemo(() => {
    return computeMonotoneSpline(points, padLeft, padRight, width, padTop, zeroY);
  }, [points, padLeft, padRight, width, padTop, zeroY]);

  // Previous curves
  const { linePath: prevLinePath } = useMemo(() => {
    if (!comparisonMode || prevPoints.length === 0) return { linePath: "" };
    return computeMonotoneSpline(prevPoints, padLeft, padRight, width, padTop, zeroY);
  }, [comparisonMode, prevPoints, padLeft, padRight, width, padTop, zeroY]);

  const hasData = points.length > 0;
  const showComparison = comparisonMode && normActiveRange !== "all" && prevPoints.length > 0;

  const currentHovered = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const prevHovered = hoveredIndex !== null && prevPoints[hoveredIndex] ? prevPoints[hoveredIndex] : null;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-title-group">
          <div className="chart-title-row">
            <h3>
              {isAllLinks
                ? "Clicks over time"
                : `Clicks over time — /${selectedLink.shortCode}`}
            </h3>
          </div>
          <p>
            {isAllLinks
              ? `Daily click performance across all ${links.length} links.`
              : `Daily click performance for /${selectedLink.shortCode}.`}
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
        </div>
      </div>

      {/* Comparison Legend Bar */}
      {showComparison && (
        <div className="chart-legend-bar">
          <div className="legend-item current">
            <span className="legend-indicator current-solid" />
            <span className="legend-label">Current Period:</span>
            <span className="legend-value">{totalPeriodClicks.toLocaleString()} clicks</span>
          </div>
          <div className="legend-item previous">
            <span className="legend-indicator prev-dashed" />
            <span className="legend-label">Previous Period:</span>
            <span className="legend-value">{comparisonData.previousTotal.toLocaleString()} clicks</span>
          </div>
        </div>
      )}

      {loading && !hasData ? (
        <div style={{ height: "260px", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "180px", width: "100%" }}>
            {[35, 60, 25, 80, 50, 90, 65].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: "var(--surface-2)",
                  borderRadius: "4px 4px 0 0",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
          <div style={{ height: "1px", background: "var(--border)", width: "100%", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ width: "60px", height: "12px", background: "var(--surface-2)", borderRadius: "4px" }} />
            <div style={{ width: "60px", height: "12px", background: "var(--surface-2)", borderRadius: "4px" }} />
            <div style={{ width: "60px", height: "12px", background: "var(--surface-2)", borderRadius: "4px" }} />
          </div>
        </div>
      ) : hasData ? (
        <div
          className="chart-svg-container"
          style={loading ? { opacity: 0.5, pointerEvents: "none", transition: "opacity 0.15s ease" } : undefined}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.0" />
              </linearGradient>
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
                    stroke={isBaseline ? "#232A34" : "#1B212A"}
                    strokeDasharray={isBaseline ? undefined : "3 3"}
                  />
                  <text
                    x={padLeft - 10}
                    y={yPos + 3.5}
                    fill="#8B95A5"
                    fontSize="10"
                    fontWeight="500"
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                    className="tabular-nums"
                  >
                    {tickVal.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* Gradient Area Fill (Current Period) */}
            <path d={areaPath} fill="url(#chartAreaGradient)" />

            {/* Previous Period Spline (Dashed curve) */}
            {showComparison && prevLinePath && (
              <path
                d={prevLinePath}
                fill="none"
                stroke="#606B7D"
                strokeWidth="1.8"
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Current Period Spline Line */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Crosshair Line */}
            {currentHovered && (
              <line
                x1={currentHovered.x}
                y1={padTop}
                x2={currentHovered.x}
                y2={zeroY}
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Previous Period Points (when hovered) */}
            {showComparison &&
              prevPoints.map((pt, idx) => {
                const isHovered = hoveredIndex === idx;
                if (!isHovered && points.length > 15) return null;
                return (
                  <circle
                    key={`prev-dot-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 4 : 2}
                    fill={isHovered ? "#94A3B8" : "transparent"}
                    stroke="#94A3B8"
                    strokeWidth={isHovered ? 2 : 1}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}

            {/* Current Period Points */}
            {points.map((pt, idx) => {
              const isHovered = hoveredIndex === idx;
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
                      r="8"
                      fill="var(--chart-1)"
                      fillOpacity="0.2"
                      stroke="var(--chart-1)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? "5" : points.length <= 10 ? "3.5" : "2.5"}
                    fill={isHovered ? "var(--surface)" : "var(--surface-2)"}
                    stroke="var(--chart-1)"
                    strokeWidth={isHovered ? "2.2" : "1.5"}
                  />
                  {/* Date labels along bottom */}
                  {showDateLabel && !isNearClash && (
                    <text
                      x={pt.x}
                      y={zeroY + 18}
                      fill={isHovered ? "#E6EAF0" : "#8B95A5"}
                      fontWeight={isHovered ? "600" : "500"}
                      fontSize="10"
                      textAnchor="middle"
                      fontFamily="var(--font-ui)"
                    >
                      {pt.date}
                    </text>
                  )}
                </g>
              );
            })}

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
                  onMouseEnter={() => setHoveredIndex(idx)}
                />
              );
            })}
          </svg>

          {/* Floating Dark-Navy Glassmorphic Tooltip */}
          {currentHovered && (
            <div
              className="chart-hover-tooltip"
              style={{
                left: `${Math.max(12, Math.min(88, (currentHovered.x / width) * 100))}%`,
                top: `${(currentHovered.y / height) * 100}%`,
                transform:
                  currentHovered.y < 50
                    ? "translate(-50%, 14px)"
                    : "translate(-50%, calc(-100% - 10px))",
              }}
            >
              <div className="tooltip-date-label">{currentHovered.date} (IST)</div>
              <div className="tooltip-clicks-val">
                <span className="tooltip-dot current" />
                <span>Current:</span>
                <strong>{Math.max(0, currentHovered.count).toLocaleString()}</strong> clicks
              </div>

              {showComparison && prevHovered && (
                <>
                  <div className="tooltip-clicks-val prev">
                    <span className="tooltip-dot previous" />
                    <span>Prior ({prevHovered.date}):</span>
                    <strong>{Math.max(0, prevHovered.count).toLocaleString()}</strong> clicks
                  </div>
                  <div className="tooltip-delta-row">
                    {currentHovered.count > prevHovered.count ? (
                      <span className="delta-pill positive">
                        +{currentHovered.count - prevHovered.count} clicks
                      </span>
                    ) : currentHovered.count < prevHovered.count ? (
                      <span className="delta-pill negative">
                        {currentHovered.count - prevHovered.count} clicks
                      </span>
                    ) : (
                      <span className="delta-pill neutral">Same as prior</span>
                    )}
                  </div>
                </>
              )}
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
