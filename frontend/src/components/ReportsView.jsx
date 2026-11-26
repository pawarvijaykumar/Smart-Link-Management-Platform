// =============================================================================
// Stage 14: Automated Reports (PDF & CSV Export) View — 2026-11-19
// Allows authenticated users to select from 9 analytics report categories,
// choose IST date ranges, and download publication-ready PDF summaries and
// Excel-compatible CSV datasets with real-time feedback.
// =============================================================================

import React, { useState, useMemo } from "react";
import axios from "axios";
import SpecularButton from "./SpecularButton";
import { SegmentedControl } from "./ui/SegmentedControl";
import TimeRangeToggle from "./ui/TimeRangeToggle";
import { useTimeRange } from "../context/TimeRangeContext";
import {
  LayoutDashboard,
  Link2,
  QrCode,
  Globe,
  Smartphone,
  Megaphone,
  Activity,
  ShieldAlert,
  GitFork,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  Download,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Report Categories Configuration
// -----------------------------------------------------------------------------
export const REPORT_CATEGORIES = [
  {
    id: "overall",
    title: "Overall dashboard report",
    icon: <LayoutDashboard size={18} style={{ color: "var(--accent)" }} />,
    tag: "Executive summary",
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
    title: "Link performance report",
    icon: <Link2 size={18} style={{ color: "var(--accent)" }} />,
    tag: "Deep-dive audit",
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
    title: "QR analytics report",
    icon: <QrCode size={18} style={{ color: "var(--accent)" }} />,
    tag: "Mobile & QR",
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
    title: "Geo-location report",
    icon: <Globe size={18} style={{ color: "var(--accent)" }} />,
    tag: "Global audience",
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
    title: "Device & browser report",
    icon: <Smartphone size={18} style={{ color: "var(--accent)" }} />,
    tag: "Hardware & platform",
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
    title: "Campaign analytics report",
    icon: <Megaphone size={18} style={{ color: "var(--accent)" }} />,
    tag: "Marketing & attribution",
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
    title: "Traffic analytics report",
    icon: <Activity size={18} style={{ color: "var(--accent)" }} />,
    tag: "Time & peak trends",
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
    title: "Anomaly detection report",
    icon: <ShieldAlert size={18} style={{ color: "var(--accent)" }} />,
    tag: "Threat surveillance",
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
    title: "A/B experiment report",
    icon: <GitFork size={18} style={{ color: "var(--accent)" }} />,
    tag: "Split testing",
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
  const { timeRange, setTimeRange, apiRange } = useTimeRange();
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
      let url = `${apiBaseUrl}/api/reports/${format}?type=${selectedCategory}&range=${apiRange}`;
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
      let filename = `smartlink_${selectedCategory}_${apiRange}_${new Date()
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
          <h1 className="reports-page-title">Reports & export</h1>
          <p className="reports-page-subtitle">
            Export formatted PDF summaries and CSV datasets.
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="reports-toast success" role="alert">
          <Check size={14} style={{ color: "var(--success)" }} />
          <span>{successToast}</span>
          <button
            type="button"
            className="reports-toast-close"
            onClick={() => setSuccessToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="reports-toast error" role="alert">
          <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
          <span>{errorMsg}</span>
          <button
            type="button"
            className="reports-toast-close"
            onClick={() => setErrorMsg("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Grid: Left Category Picker, Right Control & Export Panel */}
      <div className="reports-layout-grid">
        {/* Left Column: Categories Grid */}
        <div className="reports-categories-col">
          <div className="reports-section-header">
            <h3>Select report category</h3>
            <span className="reports-badge-count">
              {REPORT_CATEGORIES.length} available
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
            <h3>Configure parameters & export</h3>
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
                <span className="reports-features-label">Included in report:</span>
                <ul>
                  {currentCategory.features.map((f, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Check size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Date Range Selection */}
            <div className="reports-config-group">
              <label className="reports-config-label">
                Select evaluation range (IST)
              </label>
              <TimeRangeToggle
                value={timeRange}
                onChange={setTimeRange}
                ariaLabel="Select Evaluation Range (IST)"
              />
              <span className="reports-input-hint">
                Calculates metrics using strictly bounded Indian Standard Time
                calendar dates.
              </span>
            </div>

            {/* Optional Link Selector (Visible only when category is 'links') */}
            {selectedCategory === "links" && (
              <div className="reports-config-group">
                <label className="reports-config-label">
                  Link scope filter (optional)
                </label>
                <select
                  className="reports-select-input"
                  value={selectedLinkId}
                  onChange={(e) => setSelectedLinkId(e.target.value)}
                >
                  <option value="">All links (comprehensive report)</option>
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
                Choose export format
              </label>

              <div className="reports-download-buttons">
                {/* PDF Download Button */}
                <SpecularButton
                  type="button"
                  variant="primary"
                  size="md"
                  className="reports-btn-download pdf"
                  onClick={() => handleDownload("pdf")}
                  disabled={Boolean(downloading)}
                  loading={downloading === "pdf"}
                >
                  {downloading === "pdf" ? (
                    <>
                      <div className="reports-btn-spinner" />
                      <span>Generating PDF…</span>
                    </>
                  ) : (
                    <>
                      <span className="reports-btn-icon"><FileText size={16} /></span>
                      <div className="reports-btn-text">
                        <strong>Download PDF report</strong>
                        <small>Formatted document with KPI cards and tables</small>
                      </div>
                    </>
                  )}
                </SpecularButton>

                {/* CSV Download Button */}
                <SpecularButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="reports-btn-download csv"
                  onClick={() => handleDownload("csv")}
                  disabled={Boolean(downloading)}
                  loading={downloading === "csv"}
                >
                  {downloading === "csv" ? (
                    <>
                      <div className="reports-btn-spinner" />
                      <span>Generating CSV…</span>
                    </>
                  ) : (
                    <>
                      <span className="reports-btn-icon"><Download size={16} /></span>
                      <div className="reports-btn-text">
                        <strong>Download CSV dataset</strong>
                        <small>Excel-compatible raw analytics export</small>
                      </div>
                    </>
                  )}
                </SpecularButton>
              </div>

              {/* Data & Security Notice */}
              <div className="reports-security-note">
                <span className="note-icon"><ShieldCheck size={15} style={{ color: "var(--accent)" }} /></span>
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
