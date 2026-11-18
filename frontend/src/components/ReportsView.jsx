// =============================================================================
// Stage 14: Automated Reports (PDF & CSV Export) View — 2026-11-19
// Allows authenticated users to select from 9 analytics report categories,
// choose IST date ranges, and download publication-ready PDF summaries and
// Excel-compatible CSV datasets with real-time feedback.
// =============================================================================

import React, { useState, useMemo } from "react";
import axios from "axios";

// -----------------------------------------------------------------------------
// Report Categories Configuration
// -----------------------------------------------------------------------------
export const REPORT_CATEGORIES = [
  {
    id: "overall",
    title: "Overall Dashboard Report",
    icon: "▦",
    tag: "Executive Summary",
    description:
      "Platform-wide executive overview with total short link volume, cumulative clicks, QR scan rates, and international geographic reach.",
    features: [
      "Total visits & unique links",
      "Top performing short links",
      "Global geographic distribution",
      "Device category breakdown",
    ],
  },
  {
    id: "links",
    title: "Individual Link Performance Report",
    icon: "🔗",
    tag: "Deep-Dive Audit",
    description:
      "Comprehensive link audit report detailing destination URLs, security access controls (password, expiration, max clicks), and visitor audit trails.",
    features: [
      "Per-link click metrics & QR split",
      "Security & access control audit",
      "Visitor audit trail log (up to 50)",
      "Optional single-link or all-links scope",
    ],
  },
  {
    id: "qr",
    title: "QR Analytics Report",
    icon: "📱",
    tag: "Mobile & Physical Media",
    description:
      "Detailed analysis of QR code scans versus direct web clicks, physical media campaign adoption, and daily scan timelines.",
    features: [
      "Total QR scan count & percentage",
      "QR adoption share vs direct clicks",
      "QR performance per short link",
      "Daily QR scan volume timeline",
    ],
  },
  {
    id: "geo",
    title: "Geo-Location Analytics Report",
    icon: "🌍",
    tag: "Global Audience",
    description:
      "Worldwide audience geographic reach identifying top visitor countries, ISO country codes, and metropolitan cities driving platform traffic.",
    features: [
      "Country-level visitor breakdown",
      "ISO 3166-1 alpha-2 codes",
      "Top metropolitan cities",
      "International share percentages",
    ],
  },
  {
    id: "devices",
    title: "Device & Browser Intelligence Report",
    icon: "💻",
    tag: "Hardware & Platform",
    description:
      "Granular breakdown of visitor hardware platforms, including mobile, desktop, and tablet distribution, operating systems, and web browsers.",
    features: [
      "Mobile / Desktop / Tablet split",
      "Operating systems (Windows, iOS, Android)",
      "Web browsers (Chrome, Safari, Firefox)",
      "Hardware manufacturers & vendors",
    ],
  },
  {
    id: "campaigns",
    title: "Campaign Analytics Report",
    icon: "📣",
    tag: "Marketing & Attribution",
    description:
      "Marketing campaign performance evaluation tracking standard UTM tags (utm_campaign, utm_source, utm_medium) across acquisition channels.",
    features: [
      "UTM campaign click volume",
      "Referral traffic sources",
      "Marketing channels & mediums",
      "Channel percentage attribution",
    ],
  },
  {
    id: "traffic",
    title: "Traffic Analytics Report",
    icon: "📈",
    tag: "Time & Peak Trends",
    description:
      "Temporal traffic pattern analysis tracking 24-hour hourly distributions in Indian Standard Time (IST) and historical volume trajectories.",
    features: [
      "24-Hour hourly distribution (IST)",
      "Peak traffic hour identification",
      "Daily traffic volume trajectory",
      "QR vs direct temporal split",
    ],
  },
  {
    id: "anomalies",
    title: "Anomaly Detection Report",
    icon: "⚠️",
    tag: "Threat & Spike Surveillance",
    description:
      "Statistical fleet health audit recording traffic surge spikes, sudden cliff drops, baseline deviations, and surveillance incident logs.",
    features: [
      "Fleet health score & rating",
      "Traffic surge spikes detected",
      "Traffic cliff drops detected",
      "Baseline click deviation audits",
    ],
  },
  {
    id: "experiments",
    title: "A/B Experiment Performance Report",
    icon: "⚖️",
    tag: "Optimization & Testing",
    description:
      "Statistical split testing report evaluating 50/50 Variant A and Variant B traffic distribution, lead margins, and winning variants.",
    features: [
      "Experiment status & routing",
      "Variant A vs Variant B click share",
      "Winning variant identification",
      "Fallback destination configuration",
    ],
  },
];

// -----------------------------------------------------------------------------
// Component: ReportsView
// -----------------------------------------------------------------------------
export default function ReportsView({ links = [], token, apiBaseUrl }) {
  const [selectedCategory, setSelectedCategory] = useState("overall");
  const [selectedRange, setSelectedRange] = useState("all"); // "7d" | "30d" | "all"
  const [selectedLinkId, setSelectedLinkId] = useState(""); // "" for all links
  const [downloading, setDownloading] = useState(null); // "pdf" | "csv" | null
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const currentCategory = useMemo(() => {
    return (
      REPORT_CATEGORIES.find((c) => c.id === selectedCategory) ||
      REPORT_CATEGORIES[0]
    );
  }, [selectedCategory]);

  // Handle report file download (PDF or CSV)
  const handleDownload = async (format) => {
    if (!token || downloading) return;
    setDownloading(format);
    setErrorMsg("");

    try {
      let url = `${apiBaseUrl}/api/reports/${format}?type=${selectedCategory}&range=${selectedRange}`;
      if (selectedCategory === "links" && selectedLinkId) {
        url += `&linkId=${encodeURIComponent(selectedLinkId)}`;
      }

      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        withCredentials: true,
      });

      // Extract filename from Content-Disposition header if available
      let filename = `smartlink_${selectedCategory}_${selectedRange}_${new Date()
        .toISOString()
        .slice(0, 10)}.${format}`;

      const disposition = res.headers?.["content-disposition"];
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const mimeType =
        format === "pdf" ? "application/pdf" : "text/csv;charset=utf-8;";
      const blob = new Blob([res.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const linkEl = document.createElement("a");
      linkEl.href = downloadUrl;
      linkEl.setAttribute("download", filename);
      document.body.appendChild(linkEl);
      linkEl.click();
      document.body.removeChild(linkEl);

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 5000);

      setSuccessToast(
        `Successfully downloaded ${format.toUpperCase()} report: ${filename}`
      );
      setTimeout(() => setSuccessToast(""), 5000);
    } catch (err) {
      console.error(`Download ${format} error:`, err);
      let message = `Failed to generate ${format.toUpperCase()} report.`;
      if (err.code === "ERR_NETWORK" || !err.response) {
        message = `Unable to connect to the server. Please check your backend connection and try again.`;
      } else if (err.response?.data instanceof Blob) {
        try {
          const text = await (err.response.data.text
            ? err.response.data.text()
            : new Response(err.response.data).text());
          const parsed = JSON.parse(text);
          if (parsed.message) message = parsed.message;
        } catch (_) {}
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMsg(message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="reports-view-root">
      {/* View Header */}
      <div className="reports-header-row">
        <div>
          <h1 className="reports-page-title">
            <span className="reports-title-icon">📊</span>
            Automated Reports & Exports
          </h1>
          <p className="reports-page-subtitle">
            Generate and export presentation-ready PDF reports and Excel-compatible
            CSV datasets from actual MongoDB analytics.
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="reports-toast success" role="alert">
          <span className="reports-toast-icon">✓</span>
          <span>{successToast}</span>
          <button
            type="button"
            className="reports-toast-close"
            onClick={() => setSuccessToast("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="reports-toast error" role="alert">
          <span className="reports-toast-icon">⚠️</span>
          <span>{errorMsg}</span>
          <button
            type="button"
            className="reports-toast-close"
            onClick={() => setErrorMsg("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left Category Picker, Right Control & Export Panel */}
      <div className="reports-layout-grid">
        {/* Left Column: Categories Grid */}
        <div className="reports-categories-col">
          <div className="reports-section-header">
            <h3>1. Select Report Category</h3>
            <span className="reports-badge-count">
              {REPORT_CATEGORIES.length} Available
            </span>
          </div>

          <div className="reports-categories-grid">
            {REPORT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`reports-cat-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <div className="reports-cat-top">
                    <span className="reports-cat-icon">{cat.icon}</span>
                    <span className="reports-cat-tag">{cat.tag}</span>
                  </div>
                  <h4 className="reports-cat-title">{cat.title}</h4>
                  <p className="reports-cat-desc">{cat.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Parameters & Export Actions */}
        <div className="reports-actions-col">
          <div className="reports-section-header">
            <h3>2. Configure Parameters & Export</h3>
          </div>

          <div className="reports-card reports-config-card">
            {/* Active Category Overview */}
            <div className="reports-active-cat-box">
              <div className="reports-active-cat-header">
                <span className="reports-active-icon">
                  {currentCategory.icon}
                </span>
                <div>
                  <h4 className="reports-active-title">
                    {currentCategory.title}
                  </h4>
                  <span className="reports-active-tag">
                    {currentCategory.tag}
                  </span>
                </div>
              </div>
              <p className="reports-active-desc">
                {currentCategory.description}
              </p>

              {/* Feature Highlights */}
              <div className="reports-features-list">
                <span className="reports-features-label">Included in Report:</span>
                <ul>
                  {currentCategory.features.map((f, idx) => (
                    <li key={idx}>✓ {f}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="reports-config-group">
              <label className="reports-config-label">
                Select Evaluation Range (IST)
              </label>
              <div className="reports-range-buttons">
                <button
                  type="button"
                  className={`reports-btn-range ${
                    selectedRange === "7d" ? "active" : ""
                  }`}
                  onClick={() => setSelectedRange("7d")}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  className={`reports-btn-range ${
                    selectedRange === "30d" ? "active" : ""
                  }`}
                  onClick={() => setSelectedRange("30d")}
                >
                  30 Days
                </button>
                <button
                  type="button"
                  className={`reports-btn-range ${
                    selectedRange === "all" ? "active" : ""
                  }`}
                  onClick={() => setSelectedRange("all")}
                >
                  All Time
                </button>
              </div>
              <span className="reports-input-hint">
                Calculates metrics using strictly bounded Indian Standard Time
                calendar dates.
              </span>
            </div>

            {/* Optional Link Selector (Visible only when category is 'links') */}
            {selectedCategory === "links" && (
              <div className="reports-config-group">
                <label className="reports-config-label">
                  Link Scope Filter (Optional)
                </label>
                <select
                  className="reports-select-input"
                  value={selectedLinkId}
                  onChange={(e) => setSelectedLinkId(e.target.value)}
                >
                  <option value="">All Links (Comprehensive Report)</option>
                  {links.map((link) => {
                    const displayName =
                      link.name ||
                      link.title ||
                      link.utmCampaign ||
                      `Link /${link.shortCode}`;
                    return (
                      <option key={link._id || link.shortCode} value={link._id}>
                        /{link.shortCode} — {displayName} ({link.clicks || 0}{" "}
                        clicks)
                      </option>
                    );
                  })}
                </select>
                <span className="reports-input-hint">
                  Generate a deep-dive performance audit for a specific short
                  link or export all links.
                </span>
              </div>
            )}

            {/* Export Format Actions */}
            <div className="reports-download-section">
              <label className="reports-config-label">
                3. Choose Export Format
              </label>

              <div className="reports-download-buttons">
                {/* PDF Download Button */}
                <button
                  type="button"
                  className="reports-btn-download pdf"
                  onClick={() => handleDownload("pdf")}
                  disabled={Boolean(downloading)}
                >
                  {downloading === "pdf" ? (
                    <>
                      <div className="reports-btn-spinner" />
                      <span>Generating PDF…</span>
                    </>
                  ) : (
                    <>
                      <span className="reports-btn-icon">📄</span>
                      <div className="reports-btn-text">
                        <strong>Download PDF Report</strong>
                        <small>Formatted A4 document with KPI cards & tables</small>
                      </div>
                    </>
                  )}
                </button>

                {/* CSV Download Button */}
                <button
                  type="button"
                  className="reports-btn-download csv"
                  onClick={() => handleDownload("csv")}
                  disabled={Boolean(downloading)}
                >
                  {downloading === "csv" ? (
                    <>
                      <div className="reports-btn-spinner" />
                      <span>Generating CSV…</span>
                    </>
                  ) : (
                    <>
                      <span className="reports-btn-icon">📊</span>
                      <div className="reports-btn-text">
                        <strong>Download CSV Dataset</strong>
                        <small>Excel-compatible UTF-8 raw analytics export</small>
                      </div>
                    </>
                  )}
                </button>
              </div>

              {/* Data & Security Notice */}
              <div className="reports-security-note">
                <span className="note-icon">🔒</span>
                <span>
                  Reports strictly reflect your authenticated account data. Clicks
                  are deduplicated and verified. Formula injection protection is
                  automatically applied to cell contents.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
