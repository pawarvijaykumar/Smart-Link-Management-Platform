import React, { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { getCountryFlagEmoji } from "../data/geoLookup.js";
import "./OverviewBreakdownRow.css";

/**
 * OverviewBreakdownRow
 * 12-column breakdown section for the Dashboard Overview tab:
 * - Left (7 columns): 2x2 grid of cards:
 *     1. Device breakdown
 *     2. Browser breakdown
 *     3. Operating system
 *     4. Top countries
 * - Right (5 columns): Traffic source performance (equal height to left block)
 *
 * Each card features:
 * - Identical header: 15px/600 title, count right-aligned muted, 1px divider, 20px padding.
 * - Body: flex: 1 with justify-content: space-between so up to 5 rows distribute without empty space.
 * - Footer: margin-top: auto, 1px top border, plain insight sentence + "View all" link.
 * - Motion: Cards fade in with 60ms stagger; bars grow from 0 width (500ms) with 30ms stagger.
 * - Fully respects useReducedMotion.
 */
export default function OverviewBreakdownRow({
  dashboardAnalytics,
  deviceAnalytics,
  geoAnalytics,
  campaignAnalytics,
  loading = false,
  onNavigate,
  onCreateUtmLink,
}) {
  const shouldReduceMotion = useReducedMotion();

  // ---------------------------------------------------------------------------
  // 1. Device Breakdown Data (Top 5)
  // ---------------------------------------------------------------------------
  const { deviceRows, deviceTotal } = useMemo(() => {
    const raw =
      dashboardAnalytics?.devices && dashboardAnalytics.devices.length > 0
        ? dashboardAnalytics.devices
        : deviceAnalytics?.deviceTypes || [];

    const total =
      raw.reduce((sum, d) => sum + (Number(d.count || d.clicks || d.totalClicks || 0)), 0) ||
      dashboardAnalytics?.totalRecordedClicks ||
      dashboardAnalytics?.totalClicks ||
      0;

    const rows = raw
      .map((d) => {
        const label = d.name || d.label || d.device || d.type || "Unknown";
        const count = Number(d.count || d.clicks || d.totalClicks || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        return { label, count, pct: parseFloat(pct), pctStr: `${pct}%` };
      })
      .filter((d) => d.count > 0 || raw.length <= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { deviceRows: rows, deviceTotal: total };
  }, [dashboardAnalytics, deviceAnalytics]);

  // ---------------------------------------------------------------------------
  // 2. Browser Breakdown Data (Top 5)
  // ---------------------------------------------------------------------------
  const { browserRows, browserTotal } = useMemo(() => {
    const raw =
      dashboardAnalytics?.browsers && dashboardAnalytics.browsers.length > 0
        ? dashboardAnalytics.browsers
        : deviceAnalytics?.browsers || [];

    const total =
      raw.reduce((sum, b) => sum + (Number(b.count || b.clicks || b.totalClicks || 0)), 0) ||
      dashboardAnalytics?.totalRecordedClicks ||
      dashboardAnalytics?.totalClicks ||
      0;

    const rows = raw
      .map((b) => {
        const label = b.name || b.label || b.browser || "Unknown";
        const count = Number(b.count || b.clicks || b.totalClicks || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        return { label, count, pct: parseFloat(pct), pctStr: `${pct}%` };
      })
      .filter((b) => b.count > 0 || raw.length <= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { browserRows: rows, browserTotal: total };
  }, [dashboardAnalytics, deviceAnalytics]);

  // ---------------------------------------------------------------------------
  // 3. Operating System Data (Top 5)
  // ---------------------------------------------------------------------------
  const { osRows, osTotal } = useMemo(() => {
    const raw = deviceAnalytics?.operatingSystems || [];

    const total =
      raw.reduce((sum, o) => sum + (Number(o.totalClicks || o.clicks || o.count || 0)), 0) ||
      dashboardAnalytics?.totalRecordedClicks ||
      dashboardAnalytics?.totalClicks ||
      0;

    const rows = raw
      .map((o) => {
        const label = o.name || o.label || "Unknown";
        const count = Number(o.totalClicks || o.clicks || o.count || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : (o.percentage ? Number(o.percentage).toFixed(1) : "0.0");
        return { label, count, pct: parseFloat(pct), pctStr: `${pct}%` };
      })
      .filter((o) => o.count > 0 || raw.length <= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { osRows: rows, osTotal: total };
  }, [deviceAnalytics, dashboardAnalytics]);

  // ---------------------------------------------------------------------------
  // 4. Top Countries Data (Top 5) & Summary Stats
  // ---------------------------------------------------------------------------
  const { countryRows, countryTotal, countrySummary } = useMemo(() => {
    const raw = geoAnalytics?.topCountries || [];

    const total =
      raw.reduce((sum, c) => sum + (Number(c.totalClicks || c.clicks || 0)), 0) ||
      dashboardAnalytics?.totalRecordedClicks ||
      dashboardAnalytics?.totalClicks ||
      0;

    const rows = raw
      .map((c) => {
        const code = (c.countryCode || "").toUpperCase();
        const countryName = c.country || "Unknown";
        const flag = getCountryFlagEmoji(code);
        const displayLabel = code && code !== "UNKNOWN" ? `${flag} ${code} · ${countryName}` : countryName;
        const count = Number(c.totalClicks || c.clicks || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : (c.percentage ? Number(c.percentage).toFixed(1) : "0.0");
        return { label: displayLabel, rawName: countryName, count, pct: parseFloat(pct), pctStr: `${pct}%` };
      })
      .filter((c) => c.count > 0 || raw.length <= 5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const countCountries =
      geoAnalytics?.summary?.countriesCount ||
      geoAnalytics?.topCountries?.length ||
      rows.length ||
      0;
    const topName = rows[0]?.rawName || "—";
    const topPct = rows[0]?.pctStr || "0.0%";

    return {
      countryRows: rows,
      countryTotal: total,
      countrySummary: {
        totalCountries: countCountries,
        topCountry: topName,
        topShare: topPct,
      },
    };
  }, [geoAnalytics, dashboardAnalytics]);

  // ---------------------------------------------------------------------------
  // 5. Traffic Source Performance Data (Grouped Case-Insensitively, Top 5)
  // ---------------------------------------------------------------------------
  const { trafficRows, trafficSummary, trafficTotal } = useMemo(() => {
    const rawSources = campaignAnalytics?.sources || [];
    const summary = campaignAnalytics?.summary || {
      totalRecordedClicks: 0,
      attributedClicks: 0,
      unattributedClicks: 0,
    };

    // Group case-insensitively
    const map = new Map();

    for (const s of rawSources) {
      const rawName = String(s.source || s.name || "").trim();
      const clicks = Number(s.clicks || s.count || 0);
      const lower = rawName.toLowerCase();

      const isUntracked =
        !rawName ||
        lower === "direct" ||
        lower === "untracked" ||
        lower === "direct / untracked" ||
        lower === "direct/untracked" ||
        lower === "none" ||
        lower === "no source" ||
        lower === "unknown";

      const key = isUntracked ? "__untracked__" : lower;
      const displayName = isUntracked ? "No source (untracked)" : rawName;

      if (!map.has(key)) {
        map.set(key, {
          source: displayName,
          clicks: 0,
          isUntracked,
        });
      }
      const entry = map.get(key);
      entry.clicks += clicks;
    }

    // Fold in unattributedClicks from summary if not already included
    const unattributed = Number(summary.unattributedClicks || 0);
    if (unattributed > 0 && !map.has("__untracked__")) {
      map.set("__untracked__", {
        source: "No source (untracked)",
        clicks: unattributed,
        isUntracked: true,
      });
    }

    const list = Array.from(map.values()).sort((a, b) => b.clicks - a.clicks);

    const calcTotal =
      list.reduce((sum, s) => sum + s.clicks, 0) ||
      Number(summary.totalRecordedClicks || dashboardAnalytics?.totalClicks || 0);

    const rows = list.slice(0, 5).map((s) => {
      const pct = calcTotal > 0 ? ((s.clicks / calcTotal) * 100).toFixed(1) : "0.0";
      return {
        ...s,
        pct: parseFloat(pct),
        pctStr: `${pct}%`,
      };
    });

    const untrackedClicks = list.find((s) => s.isUntracked)?.clicks ?? Number(summary.unattributedClicks || 0);
    const attributedClicks = Math.max(0, calcTotal - untrackedClicks);

    return {
      trafficRows: rows,
      trafficSummary: {
        totalRecordedClicks: calcTotal,
        attributedClicks,
        unattributedClicks: untrackedClicks,
      },
      trafficTotal: calcTotal,
    };
  }, [campaignAnalytics, dashboardAnalytics]);

  // ---------------------------------------------------------------------------
  // Helper: Card Skeleton Loader
  // ---------------------------------------------------------------------------
  const renderSkeleton = () => (
    <div className="breakdown-card-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map((k) => (
        <div key={k} className="skeleton-row">
          <div className="skeleton-line skeleton-label" />
          <div className="skeleton-line skeleton-value" />
          <div className="skeleton-track" />
        </div>
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Dynamic Insights Generator
  // ---------------------------------------------------------------------------
  const getDeviceInsight = () => {
    if (deviceRows.length === 0 || deviceTotal === 0) return "No device visits recorded yet.";
    return `${deviceRows[0].label} leads with ${deviceRows[0].pctStr} of clicks.`;
  };

  const getBrowserInsight = () => {
    if (browserRows.length === 0 || browserTotal === 0) return "No browser visits recorded yet.";
    return `${browserRows[0].label} leads with ${browserRows[0].pctStr} of clicks.`;
  };

  const getOsInsight = () => {
    if (osRows.length === 0 || osTotal === 0) return "No operating system visits recorded yet.";
    return `${osRows[0].label} leads with ${osRows[0].pctStr} of clicks.`;
  };

  const getCountryInsight = () => {
    if (countryRows.length === 0 || countryTotal === 0) return "No country visits recorded yet.";
    return `${countryRows[0].rawName || "Top country"} leads with ${countryRows[0].pctStr} of clicks.`;
  };

  return (
    <div className="overview-breakdown-container">
      {/* ===================================================================
          ROW 1 (3 equal columns, align-items: stretch):
          Device breakdown, Browser breakdown, Operating system
          Footers pinned to bottom (margin-top: auto), rows packed at top
          =================================================================== */}
      <div className="breakdown-grid-row breakdown-row-1">
        {/* Card 1: Device breakdown (Row 1, Col 1) */}
        <motion.div
          className="breakdown-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="breakdown-card-header">
            <h4 className="breakdown-card-title">Device breakdown</h4>
            <span className="breakdown-card-count">
              {deviceTotal.toLocaleString()} {deviceTotal === 1 ? "click" : "clicks"}
            </span>
          </div>

          {loading ? (
            renderSkeleton()
          ) : deviceRows.length === 0 ? (
            <div className="breakdown-card-empty">No device data recorded yet.</div>
          ) : (
            <div className="breakdown-card-body">
              {deviceRows.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="breakdown-row-item">
                  <div className="breakdown-row-meta">
                    <span className="breakdown-row-label" title={row.label}>
                      {row.label}
                    </span>
                    <span className="breakdown-row-value">
                      {row.count.toLocaleString()} ({row.pctStr})
                    </span>
                  </div>
                  <div className="breakdown-bar-track">
                    <motion.div
                      className="breakdown-bar-fill"
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.5,
                        delay: shouldReduceMotion ? 0 : idx * 0.03,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="breakdown-card-footer">
            <span className="breakdown-card-insight" title={getDeviceInsight()}>
              {getDeviceInsight()}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="breakdown-view-all-btn"
                onClick={() => onNavigate("device-analytics")}
                aria-label="View all devices & OS"
              >
                <span>View all</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Card 2: Browser breakdown (Row 1, Col 2) */}
        <motion.div
          className="breakdown-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.05,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="breakdown-card-header">
            <h4 className="breakdown-card-title">Browser breakdown</h4>
            <span className="breakdown-card-count">
              {browserTotal.toLocaleString()} {browserTotal === 1 ? "click" : "clicks"}
            </span>
          </div>

          {loading ? (
            renderSkeleton()
          ) : browserRows.length === 0 ? (
            <div className="breakdown-card-empty">No browser data recorded yet.</div>
          ) : (
            <div className="breakdown-card-body">
              {browserRows.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="breakdown-row-item">
                  <div className="breakdown-row-meta">
                    <span className="breakdown-row-label" title={row.label}>
                      {row.label}
                    </span>
                    <span className="breakdown-row-value">
                      {row.count.toLocaleString()} ({row.pctStr})
                    </span>
                  </div>
                  <div className="breakdown-bar-track">
                    <motion.div
                      className="breakdown-bar-fill"
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.5,
                        delay: shouldReduceMotion ? 0 : 0.05 + idx * 0.03,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="breakdown-card-footer">
            <span className="breakdown-card-insight" title={getBrowserInsight()}>
              {getBrowserInsight()}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="breakdown-view-all-btn"
                onClick={() => onNavigate("device-analytics")}
                aria-label="View all browsers"
              >
                <span>View all</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Card 3: Operating system (Row 1, Col 3) */}
        <motion.div
          className="breakdown-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="breakdown-card-header">
            <h4 className="breakdown-card-title">Operating system</h4>
            <span className="breakdown-card-count">
              {osTotal.toLocaleString()} {osTotal === 1 ? "click" : "clicks"}
            </span>
          </div>

          {loading ? (
            renderSkeleton()
          ) : osRows.length === 0 ? (
            <div className="breakdown-card-empty">No operating system data recorded yet.</div>
          ) : (
            <div className="breakdown-card-body">
              {osRows.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="breakdown-row-item">
                  <div className="breakdown-row-meta">
                    <span className="breakdown-row-label" title={row.label}>
                      {row.label}
                    </span>
                    <span className="breakdown-row-value">
                      {row.count.toLocaleString()} ({row.pctStr})
                    </span>
                  </div>
                  <div className="breakdown-bar-track">
                    <motion.div
                      className="breakdown-bar-fill"
                      initial={shouldReduceMotion ? false : { width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.5,
                        delay: shouldReduceMotion ? 0 : 0.1 + idx * 0.03,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="breakdown-card-footer">
            <span className="breakdown-card-insight" title={getOsInsight()}>
              {getOsInsight()}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="breakdown-view-all-btn"
                onClick={() => onNavigate("device-analytics")}
                aria-label="View all operating systems in Devices & OS"
              >
                <span>View all</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* ===================================================================
          ROW 2 (Two equal columns 50%/50%, align-items: stretch):
          LEFT: Traffic source performance | RIGHT: Top countries
          Both cards same height, rows packed at top, footers pinned to bottom
          =================================================================== */}
      <div className="breakdown-grid-row breakdown-row-2">
        {/* Card 4: Traffic source performance (Row 2, Col 1 - LEFT) */}
        <motion.div
          className="breakdown-card traffic-source-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="breakdown-card-header">
            <h4 className="breakdown-card-title">Traffic source performance</h4>
            <span className="breakdown-card-count">
              {trafficTotal.toLocaleString()} {trafficTotal === 1 ? "click" : "clicks"}
            </span>
          </div>

          {loading ? (
            renderSkeleton()
          ) : trafficRows.length === 0 ? (
            <div className="breakdown-card-empty traffic-empty-wrap">
              <p>No traffic source attribution yet.</p>
              {onCreateUtmLink && (
                <button
                  type="button"
                  className="traffic-create-utm-btn"
                  onClick={onCreateUtmLink}
                >
                  + Create Link with UTM Tags
                </button>
              )}
            </div>
          ) : (
            <div className="breakdown-card-body traffic-card-body">
              <table className="traffic-source-table">
                <thead>
                  <tr>
                    <th className="th-source">Source</th>
                    <th className="th-clicks">Clicks</th>
                    <th className="th-share">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {trafficRows.map((row, idx) => (
                    <tr key={`${row.source}-${idx}`} className="traffic-source-row">
                      <td className="td-source">
                        <span className="traffic-source-name" title={row.source}>
                          {row.source}
                        </span>
                      </td>
                      <td className="td-clicks">
                        <span className="traffic-clicks-num">
                          {row.clicks.toLocaleString()}
                        </span>
                      </td>
                      <td className="td-share">
                        <div className="traffic-share-wrap">
                          <div className="breakdown-bar-track">
                            <motion.div
                              className="breakdown-bar-fill"
                              initial={shouldReduceMotion ? false : { width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                              transition={{
                                duration: shouldReduceMotion ? 0 : 0.5,
                                delay: shouldReduceMotion ? 0 : 0.15 + idx * 0.03,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          </div>
                          <span className="traffic-pct-num">{row.pctStr}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer with inline summary numbers & View all link */}
          <div className="breakdown-card-footer traffic-source-footer">
            <div className="traffic-summary-inline">
              <span className="summary-stat-tag">
                Total: <strong>{trafficTotal.toLocaleString()}</strong>
              </span>
              <span className="summary-dot">•</span>
              <span className="summary-stat-tag stat-accent">
                Attributed: <strong>{(trafficSummary.attributedClicks || 0).toLocaleString()}</strong>
              </span>
              <span className="summary-dot">•</span>
              <span className="summary-stat-tag stat-muted">
                Untracked: <strong>{(trafficSummary.unattributedClicks || 0).toLocaleString()}</strong>
              </span>
            </div>
            {onNavigate && (
              <button
                type="button"
                className="breakdown-view-all-btn"
                onClick={() => onNavigate("campaigns")}
                aria-label="View all campaign traffic sources"
              >
                <span>View all</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Card 5: Top countries (Row 2, Col 2 - RIGHT) */}
        <motion.div
          className="breakdown-card"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="breakdown-card-header">
            <h4 className="breakdown-card-title">Top countries</h4>
            <span className="breakdown-card-count">
              {countryTotal.toLocaleString()} {countryTotal === 1 ? "click" : "clicks"}
            </span>
          </div>

          {loading ? (
            renderSkeleton()
          ) : countryRows.length === 0 ? (
            <div className="breakdown-card-empty">No country data recorded yet.</div>
          ) : (
            <div className="breakdown-card-body">
              {/* Country rows packed at top with fixed gap */}
              <div className="country-rows-list">
                {countryRows.map((row, idx) => (
                  <div key={`${row.label}-${idx}`} className="breakdown-row-item">
                    <div className="breakdown-row-meta">
                      <span className="breakdown-row-label" title={row.label}>
                        {row.label}
                      </span>
                      <span className="breakdown-row-value">
                        {row.count.toLocaleString()} ({row.pctStr})
                      </span>
                    </div>
                    <div className="breakdown-bar-track">
                      <motion.div
                        className="breakdown-bar-fill"
                        initial={shouldReduceMotion ? false : { width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.5,
                          delay: shouldReduceMotion ? 0 : 0.2 + idx * 0.03,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Compact Summary Strip: 3 stat tiles */}
              <div className="country-summary-strip">
                <div className="country-summary-tile">
                  <span className="summary-tile-label">Countries</span>
                  <span className="summary-tile-value">{countrySummary.totalCountries}</span>
                </div>
                <div className="country-summary-tile">
                  <span className="summary-tile-label">Top country</span>
                  <span className="summary-tile-value" title={countrySummary.topCountry}>
                    {countrySummary.topCountry}
                  </span>
                </div>
                <div className="country-summary-tile">
                  <span className="summary-tile-label">Top share</span>
                  <span className="summary-tile-value">{countrySummary.topShare}</span>
                </div>
              </div>
            </div>
          )}

          <div className="breakdown-card-footer">
            <span className="breakdown-card-insight" title={getCountryInsight()}>
              {getCountryInsight()}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="breakdown-view-all-btn"
                onClick={() => onNavigate("geo-analytics")}
                aria-label="View Geo Analytics"
              >
                <span>View all</span>
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
