// CHANGE: Stage 15 Main Dashboard Redesign — Traffic Source Performance Card — 2026-11-19
import { useMemo } from "react";
import { Globe, ExternalLink, Compass, Radio, ArrowUpRight, ShieldCheck } from "lucide-react";
import CountUp from "./CountUp";

const getSourceIcon = (sourceName = "") => {
  const s = sourceName.toLowerCase();
  if (s.includes("google") || s.includes("bing") || s.includes("yahoo") || s.includes("search")) {
    return <Compass size={16} className="source-icon-svg text-cyan" />;
  }
  if (s.includes("twitter") || s.includes("x.com") || s.includes("t.co")) {
    return <Radio size={16} className="source-icon-svg text-purple" />;
  }
  if (s.includes("linkedin") || s.includes("github") || s.includes("slack")) {
    return <ArrowUpRight size={16} className="source-icon-svg text-emerald" />;
  }
  if (s.includes("direct") || s.includes("untracked")) {
    return <ShieldCheck size={16} className="source-icon-svg text-slate" />;
  }
  return <Globe size={16} className="source-icon-svg text-indigo" />;
};

export default function TrafficSourcesCard({
  campaignAnalytics,
  loading = false,
  onCreateUtmLink,
}) {
  const sources = useMemo(() => {
    return (campaignAnalytics?.sources || []).map((s) => ({
      source: s.source || s.name || "Direct / Untracked",
      clicks: typeof s.clicks === "number" ? s.clicks : (typeof s.count === "number" ? s.count : 0),
    }));
  }, [campaignAnalytics]);

  const summary = useMemo(() => {
    return campaignAnalytics?.summary || {
      totalRecordedClicks: 0,
      attributedClicks: 0,
      unattributedClicks: 0,
    };
  }, [campaignAnalytics]);

  const totalClicks = useMemo(() => {
    return sources.reduce((sum, s) => sum + (s.clicks || 0), 0) || summary.totalRecordedClicks || 0;
  }, [sources, summary]);

  const topSources = useMemo(() => {
    return [...sources].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 6);
  }, [sources]);

  return (
    <div className="traffic-sources-card">
      <div className="traffic-sources-header">
        <div className="traffic-sources-title-group">
          <div className="sources-header-icon-box">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="traffic-sources-title">Traffic Source Performance</h3>
            <p className="traffic-sources-subtitle">
              Attribution by UTM source & inbound channels
            </p>
          </div>
        </div>
        <div className="sources-badge-group">
          <span className="sources-count-badge">
            {sources.length} {sources.length === 1 ? "Channel" : "Channels"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="traffic-sources-loading">
          <div className="sources-spinner" />
          <span>Loading traffic source analytics...</span>
        </div>
      ) : topSources.length > 0 && totalClicks > 0 ? (
        <div className="traffic-sources-content">
          <div className="sources-table-wrapper">
            <table className="sources-table">
              <thead>
                <tr>
                  <th className="th-source">Source / Channel</th>
                  <th className="th-clicks text-right">Clicks</th>
                  <th className="th-share">Traffic Share</th>
                  <th className="th-percent text-right">Share %</th>
                  <th className="th-trend text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map((item, idx) => {
                  const sharePct =
                    totalClicks > 0
                      ? Math.round(((item.clicks || 0) / totalClicks) * 1000) / 10
                      : 0;

                  const trendBadge =
                    sharePct >= 35
                      ? { label: "Primary", type: "primary" }
                      : sharePct >= 15
                      ? { label: "High Volume", type: "high" }
                      : sharePct >= 5
                      ? { label: "Active", type: "active" }
                      : { label: "Steady", type: "steady" };

                  return (
                    <tr key={item.source || idx} className="source-row">
                      <td className="td-source">
                        <div className="source-name-cell">
                          <span className="source-icon-badge">
                            {getSourceIcon(item.source)}
                          </span>
                          <span className="source-name-text" title={item.source}>
                            {item.source}
                          </span>
                        </div>
                      </td>
                      <td className="td-clicks text-right">
                        <span className="source-clicks-num">
                          <CountUp to={item.clicks || 0} duration={1} />
                        </span>
                      </td>
                      <td className="td-share">
                        <div className="source-progress-track">
                          <div
                            className="source-progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(6, sharePct))}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="td-percent text-right">
                        <span className="source-pct-pill">{sharePct}%</span>
                      </td>
                      <td className="td-trend text-right">
                        <span className={`source-trend-pill ${trendBadge.type}`}>
                          {trendBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sources-summary-bar">
            <div className="summary-stat">
              <span className="stat-label">Total Volume</span>
              <span className="stat-value">
                <CountUp to={totalClicks} duration={1} /> clicks
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Attributed</span>
              <span className="stat-value text-cyan">
                <CountUp to={summary.attributedClicks || 0} duration={1} /> clicks
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Direct / Untracked</span>
              <span className="stat-value text-muted">
                <CountUp to={summary.unattributedClicks || 0} duration={1} /> clicks
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="traffic-sources-empty">
          <div className="sources-empty-icon-wrap">
            <Compass size={28} className="text-purple" />
          </div>
          <h4>No Traffic Source Attribution Yet</h4>
          <p>
            Visitor clicks with UTM parameters (e.g. <code>?utm_source=twitter</code>) or inbound referrers will appear here automatically.
          </p>
          {onCreateUtmLink && (
            <button
              type="button"
              className="btn-create-utm-link"
              onClick={onCreateUtmLink}
            >
              <span>+ Create Link with UTM Tags</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
