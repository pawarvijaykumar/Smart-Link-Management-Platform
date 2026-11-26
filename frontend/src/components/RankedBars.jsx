import React, { useState, useMemo } from "react";
import "./RankedBars.css";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

/**
 * RankedBars component replacing circular donut/pie charts with a clean,
 * production SaaS horizontal bar list.
 *
 * @param {string} title - Card header title
 * @param {React.ReactNode} icon - Optional icon node in card header
 * @param {Array} data - Array of items: [{ name/label, count/clicks/value, color? }]
 * @param {string} emptyMessage - Message displayed when total === 0 or data is empty
 * @param {string} totalLabel - Unit label after count (e.g. "clicks", "scans")
 * @param {boolean} distinguishColors - If true, cycles through --chart-1..4 or uses item.color
 * @param {number} maxInitial - Maximum rows to show initially before "View all" (default 5)
 * @param {string} className - Optional wrapper class name
 */
export default function RankedBars({
  title,
  icon,
  data = [],
  emptyMessage = "No data recorded yet",
  totalLabel = "clicks",
  distinguishColors = false,
  maxInitial = 5,
  loading = false,
  className = "",
}) {
  const [showAll, setShowAll] = useState(false);

  // Normalize, calculate total, and sort items descending
  const { normalizedItems, total } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { normalizedItems: [], total: 0 };
    }

    const items = data
      .map((item, idx) => {
        const rawLabel =
          item?.name ??
          item?.label ??
          item?.category ??
          item?.key ??
          item?.source ??
          item?.medium ??
          `Item ${idx + 1}`;
        const rawCount = Number(
          item?.count ?? item?.clicks ?? item?.value ?? item?.total ?? 0
        );
        const count = isNaN(rawCount) || rawCount < 0 ? 0 : rawCount;
        const color =
          item?.color ||
          (distinguishColors
            ? CHART_PALETTE[idx % CHART_PALETTE.length]
            : "var(--chart-1)");

        return {
          label: String(rawLabel),
          count,
          color,
        };
      })
      .filter((item) => item.count > 0 || data.length <= maxInitial) // keep items if all are 0 so empty message or 0 states render appropriately
      .sort((a, b) => b.count - a.count);

    const calculatedTotal = items.reduce((sum, it) => sum + it.count, 0);

    return { normalizedItems: items, total: calculatedTotal };
  }, [data, distinguishColors, maxInitial]);

  const hasData = total > 0 && normalizedItems.length > 0;
  const visibleItems = showAll
    ? normalizedItems
    : normalizedItems.slice(0, maxInitial);
  const hasMore = normalizedItems.length > maxInitial;

  return (
    <div className={`ranked-bars-card ${className}`}>
      <div className="ranked-bars-header">
        <h4 className="ranked-bars-title">
          {icon && <span className="ranked-bars-icon">{icon}</span>}
          <span>{title}</span>
        </h4>
        <span className="ranked-bars-total">
          {total.toLocaleString()} {totalLabel}
        </span>
      </div>

      {loading ? (
        <div className="ranked-bars-list" style={{ padding: "8px 0" }}>
          {[1, 2, 3].map((k) => (
            <div key={k} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ width: "40%", height: "14px", background: "var(--surface-2)", borderRadius: "4px" }} />
                <div style={{ width: "20%", height: "14px", background: "var(--surface-2)", borderRadius: "4px" }} />
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--surface-2)", borderRadius: "3px" }} />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <div className="ranked-bars-empty">{emptyMessage}</div>
      ) : (
        <div className="ranked-bars-list">
          {visibleItems.map((item, idx) => {
            const pct =
              total > 0 ? ((item.count / total) * 100).toFixed(1) : "0.0";

            return (
              <div key={`${item.label}-${idx}`} className="ranked-bars-item">
                <div className="ranked-bars-row">
                  <span className="ranked-bars-label" title={item.label}>
                    {item.label}
                  </span>
                  <div className="ranked-bars-stats">
                    <span>{item.count.toLocaleString()}</span>
                    <span className="ranked-bars-pct">({pct}%)</span>
                  </div>
                </div>
                <div className="ranked-bars-track">
                  <div
                    className="ranked-bars-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, parseFloat(pct)))}%`,
                      backgroundColor: item.color,
                    }}
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin="0"
                    aria-valuemax={total}
                    aria-label={`${item.label}: ${item.count} (${pct}%)`}
                  />
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              type="button"
              className="ranked-bars-view-all"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll
                ? "Show less"
                : `View all (${normalizedItems.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
