import React from "react";
import MarketingLayout from "./MarketingLayout";
import { Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";

const RELEASES = [
  {
    version: "v2.4.0",
    date: "November 21, 2026",
    title: "Linear Design Overhaul & Multi-Preset Theme System",
    description: "Re-engineered the entire application with solid tokens, light Paper default theme, full dark mode, and an all-new 5-tab user settings suite.",
    changes: [
      "Eliminated heavy full-page gradients in favor of high-contrast solid surface tokens.",
      "Added multi-preset theme switcher (Midnight, Graphite, Slate, Ink presets and 6 accent colors).",
      "Created comprehensive Settings page: Appearance, Profile, Security sessions, Notifications, and Danger zone.",
      "Integrated public marketing portal with Landing, Pricing, and Interactive Developer Docs.",
    ],
  },
  {
    version: "v2.3.0",
    date: "November 20, 2026",
    title: "Specular Buttons & Spotlight Glass Cards",
    description: "Integrated React Bits Specular Button animations with cursor-following light reflections and tactile SpotlightCard physics across all analytics modules.",
    changes: [
      "Smooth specular light tracking on Primary, Secondary, Cyan, Success, and Ghost button variants.",
      "Accessible keyboard focus rings (:focus-visible) and mobile touch compatibility.",
      "Dynamic hover spotlights across KPI cards and quick analytics shortcuts.",
    ],
  },
  {
    version: "v2.2.0",
    date: "November 16, 2026",
    title: "Smart Traffic Anomaly Detection",
    description: "Real-time algorithmic detection of traffic surges, sudden drops, and bot spikes with acknowledgement workflows.",
    changes: [
      "Real-time standard deviation calculation against 30-day baseline click velocity.",
      "Acknowledge and Resolve triage states for security anomalies.",
      "Automated in-app notification alerts upon high-magnitude spike events.",
    ],
  },
  {
    version: "v2.1.0",
    date: "November 08, 2026",
    title: "Geo-Location Analytics & TopoJSON Mapping",
    description: "High-precision geographic visualization of visitor traffic across continents, countries, and metropolitan territories.",
    changes: [
      "Interactive world map choropleth powered by D3.js and TopoJSON client hints.",
      "Granular city and region breakdowns with click volume percentage distributions.",
      "Lightweight local IP geo-lookup without third-party network blocking.",
    ],
  },
];

export default function ChangelogPage({ token, onNavigate }) {
  return (
    <MarketingLayout
      title="Changelog — SmartLink Product Updates"
      description="Stay updated with the latest improvements, new analytics features, and performance enhancements across SmartLink."
      token={token}
      currentPath="/changelog"
      onNavigate={onNavigate}
    >
      <div className="mkt-container" style={{ padding: "72px 24px 96px", maxWidth: "800px" }}>
        <div style={{ marginBottom: "56px" }}>
          <div className="mkt-section-tag">Release History</div>
          <h1 className="mkt-section-title" style={{ fontSize: "40px", margin: "8px 0 14px" }}>
            Changelog & Product Evolution
          </h1>
          <p className="mkt-section-subtitle" style={{ margin: 0 }}>
            Every release, feature refinement, and engine optimization shipped to SmartLink.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
          {RELEASES.map((rel, idx) => (
            <section
              key={idx}
              style={{
                borderBottom: idx < RELEASES.length - 1 ? "1px solid var(--mkt-border)" : "none",
                paddingBottom: idx < RELEASES.length - 1 ? "48px" : "0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "13px",
                    fontWeight: "700",
                    background: "var(--mkt-accent-soft)",
                    color: "var(--mkt-accent)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {rel.version}
                </span>
                <span style={{ fontSize: "14px", color: "var(--mkt-muted)" }}>{rel.date}</span>
              </div>

              <h2 style={{ fontSize: "22px", fontWeight: "600", color: "var(--mkt-text)", margin: "0 0 10px" }}>
                {rel.title}
              </h2>
              <p style={{ fontSize: "15px", color: "var(--mkt-muted)", lineHeight: 1.6, margin: "0 0 18px" }}>
                {rel.description}
              </p>

              <ul style={{ listStyle: "disc", paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {rel.changes.map((ch, chIdx) => (
                  <li key={chIdx} style={{ fontSize: "14px", color: "var(--mkt-text)", lineHeight: 1.5 }}>
                    {ch}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </MarketingLayout>
  );
}
