import React, { useMemo } from "react";
import { Link2, MousePointerClick, TrendingUp, Zap } from "lucide-react";
import StatCard from "../../components/ui/StatCard";
import ClicksOverviewChart from "../../ClicksOverviewChart";
import "./HeroDashboardPreview.css";

// 7 Fixed Sample Links (matching 7 total links, 38 total clicks, 5.4 avg)
const SAMPLE_LINKS = [
  { _id: "sample_link_1", title: "Product Launch Page", shortCode: "launch", clicks: 14, active: true },
  { _id: "sample_link_2", title: "Documentation Guide", shortCode: "docs", clicks: 8, active: true },
  { _id: "sample_link_3", title: "Pricing & Plans", shortCode: "pricing", clicks: 6, active: true },
  { _id: "sample_link_4", title: "Twitter Promo", shortCode: "tw-promo", clicks: 4, active: true },
  { _id: "sample_link_5", title: "Newsletter Signup", shortCode: "news", clicks: 3, active: true },
  { _id: "sample_link_6", title: "Community Discord", shortCode: "discord", clicks: 2, active: true },
  { _id: "sample_link_7", title: "iOS App Store", shortCode: "app", clicks: 1, active: true },
];

export default function HeroDashboardPreview() {
  // Generate a realistic 30-day trend ending on current date (sum = 38 clicks)
  const sampleDailyTrends = useMemo(() => {
    const counts = [
      0, 0, 1, 0, 0, 1, 0,
      0, 2, 1, 0, 0, 1, 2,
      0, 1, 3, 1, 2, 0, 1,
      4, 2, 3, 1, 2, 4, 3, 2, 1,
    ]; // 30 daily buckets, exactly 38 clicks
    const today = new Date();
    return counts.map((count, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return { isoDate: `${y}-${m}-${day}`, count };
    });
  }, []);

  return (
    <div
      className="hero-dashboard-preview"
      aria-hidden="true"
      tabIndex={-1}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {/* 1. Header Greeting & Sample Controls */}
      <div className="hero-preview-greeting">
        <div className="hero-preview-greeting-text">
          <h2 className="hero-preview-title">Welcome back, Alex!</h2>
          <p className="hero-preview-subtitle">Here's an overview of your links and performance.</p>
        </div>

        <div className="hero-preview-controls">
          <div className="tab-sliding-pill-wrap" role="tablist">
            <div className="tab-sliding-pill-btn active">
              <span className="tab-sliding-pill-bg" />
              <span className="tab-sliding-pill-text">Overview</span>
            </div>
            <div className="tab-sliding-pill-btn">
              <span className="tab-sliding-pill-text">Activity</span>
            </div>
          </div>

          <span className="header-range-label">Timeframe:</span>
          <div className="time-range-toggle">
            <span className="time-range-btn">7D</span>
            <span className="time-range-btn active">30D</span>
            <span className="time-range-btn">All</span>
          </div>
        </div>
      </div>

      {/* 2. Top 4 Statistic Cards */}
      <div className="hero-preview-metrics-grid">
        <StatCard
          label="Total links"
          value={7}
          delta="+7 new vs previous 30 days"
          deltaType="positive"
          helper="7 active, 0 paused"
          icon={<Link2 size={18} />}
          sparklineData={[1, 2, 2, 3, 4, 5, 7]}
          sparklineColor="#7A4A2B"
        />
        <StatCard
          label="Total clicks"
          value={38}
          delta="+38 vs previous 30 days"
          deltaType="positive"
          helper="Total recorded link clicks"
          icon={<MousePointerClick size={18} />}
          sparklineData={[0, 1, 2, 3, 5, 8, 14]}
          sparklineColor="#7A4A2B"
        />
        <StatCard
          label="Avg clicks per link"
          value={5.4}
          decimals={1}
          delta="5.4 / active"
          deltaType="neutral"
          helper="5.4 per active link"
          icon={<TrendingUp size={18} />}
          sparklineData={[1, 2, 2, 3, 4, 5, 5]}
          sparklineColor="#7A4A2B"
        />
        <StatCard
          label="Active links"
          value={7}
          delta="100% capacity"
          deltaType="positive"
          helper="7 of 7 actively routing"
          icon={<Zap size={18} />}
        />
      </div>

      {/* 3. Clicks Overview Chart */}
      <div className="hero-preview-chart-wrap">
        <ClicksOverviewChart
          dailyTrends={sampleDailyTrends}
          links={SAMPLE_LINKS}
          timeRange="30d"
          selectedLink={null}
          onSelectLink={() => {}}
          loading={false}
        />
      </div>
    </div>
  );
}
